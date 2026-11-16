/*
path:            app/admin/recipes/_actions.ts
tag:             ["admin", "recipes", "crud", "server-action", "prisma", "json-export"]
projectId:       <recipe-miam>
type:            action
generic:         false

role:            Server Actions de création et de modification des recettes.
                 Valide les données avec Zod, vérifie les références aux
                 ingrédients, catégories et tags, puis enregistre les
                 relations dans une opération Prisma atomique. Après chaque
                 mutation réussie, déclenche un export JSON best-effort
                 (miroir versionné sous data/recipes/[slug]/[slug].json) :
                 une erreur d'écriture JSON n'invalide JAMAIS la mutation
                 DB — la DB reste la source de vérité.

relatedFiles:    ["@/lib/prisma",
                  "@/lib/validations/recipe",
                  "@/lib/json/storage",
                  "@/lib/json/serialize",
                  "@/app/admin/recipes/new/page.tsx",
                  "@/app/admin/recipes/[id]/edit/page.tsx"]

imports:         ["next/cache",
                  "@/lib/prisma",
                  "@/lib/validations/recipe",
                  "@/lib/json/serialize",
                  "@/lib/json/storage"]

exports:         ["RecipeActionResult",
                  "createRecipeAction",
                  "updateRecipeAction"]

useBy:           ["@/app/admin/recipes/_components/RecipeForm.tsx"]
*/

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  recipeFormSchema,
  recipeIdSchema,
} from "@/lib/validations/recipe";
import { recipeToJson } from "@/lib/json/serialize";
import { writeRecipeFile } from "@/lib/json/storage";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RecipeActionResult =
  | {
      readonly ok: true;
      readonly data: { readonly id: string };
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function toUserMessage(error: unknown): string {
  if (isUniqueError(error)) {
    return "Ce slug est déjà utilisé par une autre recette.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur inattendue est survenue.";
}

async function validateRelations(
  ingredientIds: readonly string[],
  categoryIds: readonly string[],
  tagIds: readonly string[],
): Promise<void> {
  const [ingredients, categories, tags] = await Promise.all([
    prisma.ingredient.findMany({
      where: { id: { in: [...ingredientIds] } },
      select: { id: true },
    }),
    prisma.category.findMany({
      where: { id: { in: [...categoryIds] } },
      select: { id: true },
    }),
    prisma.tag.findMany({
      where: { id: { in: [...tagIds] } },
      select: { id: true },
    }),
  ]);

  if (ingredients.length !== ingredientIds.length) {
    throw new Error("Un ou plusieurs ingrédients sont introuvables.");
  }

  if (categories.length !== categoryIds.length) {
    throw new Error("Une ou plusieurs catégories sont introuvables.");
  }

  if (tags.length !== tagIds.length) {
    throw new Error("Un ou plusieurs tags sont introuvables.");
  }
}

/**
 * Écrit le miroir JSON d'une recette (best-effort). Ne lève jamais :
 * une erreur d'I/O JSON ne doit pas invalider une mutation DB réussie.
 * Recharge la recette avec toutes les relations pour produire un JSON
 * complet et cohérent avec l'état DB post-mutation.
 */
async function syncRecipeJson(recipeId: string): Promise<void> {
  try {
    const row = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        recipeIngredients: {
          orderBy: { position: "asc" },
          include: { ingredient: { select: { slugIngredient: true } } },
        },
        steps: { orderBy: { stepNumber: "asc" } },
        categories: {
          include: { category: { select: { slugCategory: true } } },
        },
        tags: { include: { tag: { select: { slugTag: true } } } },
      },
    });

    if (!row) return;

    const json = recipeToJson(row);
    await writeRecipeFile(json.slug, json);
  } catch (error) {
    console.error("[recipes:syncRecipeJson]", error);
  }
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export async function createRecipeAction(
  input: unknown,
): Promise<RecipeActionResult> {
  try {
    const data = recipeFormSchema.parse(input);

    await validateRelations(
      data.ingredients.map((item) => item.ingredientId),
      data.categoryIds,
      data.tagIds,
    );

    const lastRecipe = await prisma.recipe.aggregate({
      _max: { displayOrder: true },
    });

    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        slugRecipe: data.slugRecipe,
        description: data.description,
        image: data.image || null,
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        servings: data.servings,
        difficulty: data.difficulty,
        calories: data.calories,

        displayOrder: (lastRecipe._max.displayOrder ?? -1) + 1,

        recipeIngredients: {
          create: data.ingredients.map((item, index) => ({
            ingredientId: item.ingredientId,
            amount: item.amount,
            unit: item.unit,
            note: item.note || null,
            position: index,
          })),
        },

        steps: {
          create: data.steps.map((step, index) => ({
            stepNumber: index + 1,
            instruction: step.instruction,
            image: step.image || null,
          })),
        },

        categories: {
          create: data.categoryIds.map((categoryId) => ({
            category: {
              connect: { id: categoryId },
            },
          })),
        },

        tags: {
          create: data.tagIds.map((tagId) => ({
            tag: {
              connect: { id: tagId },
            },
          })),
        },
      },

      select: { id: true },
    });

    // Miroir JSON (best-effort — n'invalide pas la création DB).
    await syncRecipeJson(recipe.id);

    revalidatePath("/admin/recipes");
    revalidatePath("/recipes");

    return {
      ok: true,
      data: { id: recipe.id },
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserMessage(error),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Modification                                                        */
/* ------------------------------------------------------------------ */

export async function updateRecipeAction(
  id: string,
  input: unknown,
): Promise<RecipeActionResult> {
  try {
    const parsedId = recipeIdSchema.parse({ id });
    const data = recipeFormSchema.parse(input);

    await validateRelations(
      data.ingredients.map((item) => item.ingredientId),
      data.categoryIds,
      data.tagIds,
    );

    const existing = await prisma.recipe.findUnique({
      where: { id: parsedId.id },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Cette recette n'existe plus.");
    }

    const recipe = await prisma.recipe.update({
      where: { id: parsedId.id },

      data: {
        title: data.title,
        slugRecipe: data.slugRecipe,
        description: data.description,
        image: data.image || null,
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        servings: data.servings,
        difficulty: data.difficulty,
        calories: data.calories,

        recipeIngredients: {
          deleteMany: {},
          create: data.ingredients.map((item, index) => ({
            ingredientId: item.ingredientId,
            amount: item.amount,
            unit: item.unit,
            note: item.note || null,
            position: index,
          })),
        },

        steps: {
          deleteMany: {},
          create: data.steps.map((step, index) => ({
            stepNumber: index + 1,
            instruction: step.instruction,
            image: step.image || null,
          })),
        },

        categories: {
          deleteMany: {},
          create: data.categoryIds.map((categoryId) => ({
            category: {
              connect: { id: categoryId },
            },
          })),
        },

        tags: {
          deleteMany: {},
          create: data.tagIds.map((tagId) => ({
            tag: {
              connect: { id: tagId },
            },
          })),
        },
      },

      select: { id: true },
    });

    // Miroir JSON (best-effort — n'invalide pas la mise à jour DB).
    await syncRecipeJson(recipe.id);

    revalidatePath("/admin/recipes");
    revalidatePath(`/admin/recipes/${parsedId.id}/edit`);
    revalidatePath("/recipes");

    return {
      ok: true,
      data: { id: recipe.id },
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserMessage(error),
    };
  }
}