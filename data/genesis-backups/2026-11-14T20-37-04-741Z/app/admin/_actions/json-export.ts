/*
path :           app/admin/_actions/json-export.ts
tag :            ["admin", "json", "export", "import", "preview", "server-action"]
projectId:       <recipe-miam>
type:            action
generic:         false

role:            Server Actions de synchronisation DB ↔ JSON miroir.
                 Export unitaire (ingrédient, recette), export global,
                 import (ingrédients, recette), suppression du dossier
                 JSON d'une recette, et lecture en lecture seule du fichier
                 ingrédients pour aperçu UI. Chaque action retourne
                 ActionResult et ne revalide QUE les routes utiles.
                 Les scripts CLI (scripts/export-to-json.ts,
                 scripts/import-from-json.ts) réutilisent exactement ces
                 mêmes actions.

flow:            exportIngredientJsonAction(id) → findUnique (avec
                 allergens.allergen) → ingredientToJson → readIngredientsFile
                 (existant) → merge par slug + tri displayOrder/slug →
                 writeIngredientsFile → revalidate.
                 exportRecipeJsonAction(id) → findUnique (relations) →
                 recipeToJson → writeRecipeFile(slug) → revalidate.
                 exportAllJsonAction() → findMany × 2 → writeIngredientsFile
                 + boucle writeRecipeFile + writeRecipeIndex → revalidate.
                 reimportIngredientsJsonAction() → readIngredientsFile →
                 Zod.parse → boucle upsert Ingredient (par slug) + replace
                 IngredientAllergen (deleteMany + createMany) → revalidate.
                 reimportRecipeJsonAction(slug) → readRecipeFile →
                 Zod.parse → resolve refs par slug → upsert Recipe +
                 recreate relations (ingredients, steps, categories, tags)
                 en transaction → revalidate.
                 deleteRecipeJsonAction(slug) → deleteRecipeDir → revalidate.
                 readIngredientsJsonForPreviewAction() → readIngredientsFile
                 → JSON.stringify (lecture seule).

ecosystem:       Json = [
                   "@/lib/json/types.ts",
                   "@/lib/json/paths.ts",
                   "@/lib/json/serialize.ts",
                   "@/lib/json/storage.ts",
                   "@/lib/validations/json-files.ts",
                   "@/app/admin/_actions/json-export.ts",
                   "@/app/admin/sync/page.tsx",
                   "@/app/admin/sync/_components/SyncPanel.tsx",
                   "@/scripts/export-to-json.ts",
                   "@/scripts/import-from-json.ts",
                 ]

relatedFiles:    ["@/lib/prisma",
                  "@/lib/json/storage",
                  "@/lib/json/serialize",
                  "@/lib/validations/json-files"]

imports:         ["next/cache",
                  "@/lib/prisma",
                  "@/lib/json/storage",
                  "@/lib/json/serialize",
                  "@/lib/validations/json-files"]

exports:         ["JsonActionResult",
                  "exportIngredientJsonAction",
                  "exportRecipeJsonAction",
                  "exportAllJsonAction",
                  "reimportIngredientsJsonAction",
                  "reimportRecipeJsonAction",
                  "deleteRecipeJsonAction",
                  "readIngredientsJsonForPreviewAction"]

useBy:           ["@/app/admin/ingredients/_actions.ts",
                  "@/app/admin/recipes/_actions.ts",
                  "@/app/recipes/_actions.ts",
                  "@/app/admin/ingredients/_components/IngredientManager.tsx",
                  "@/app/admin/sync/_components/SyncPanel.tsx",
                  "@/scripts/export-to-json.ts",
                  "@/scripts/import-from-json.ts"]

userStories:     ["*en tant qu'admin je veux exporter la base en JSON",
                  "*en tant qu'admin je veux réimporter un JSON en base",
                  "*en tant qu'admin je veux prévisualiser le JSON ingrédients"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  deleteRecipeDir,
  listRecipeSlugs,
  readIngredientsFile,
  readRecipeFile,
  writeIngredientsFile,
  writeRecipeIndex,
  writeRecipeFile,
} from "@/lib/json/storage";
import {
  ingredientToJson,
  ingredientsFileToJson,
  recipeToJson,
} from "@/lib/json/serialize";
import {
  ingredientsFileSchema,
  recipeFileSchema,
} from "@/lib/validations/json-files";
import type { IngredientsFileJson } from "@/lib/json/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type JsonActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erreur inconnue.";
}

/* ------------------------------------------------------------------ */
/*  Sélecteurs Prisma réutilisables                                    */
/* ------------------------------------------------------------------ */

const ingredientJsonInclude = {
  allergens: { include: { allergen: { select: { code: true } } } },
} as const;

const recipeJsonInclude = {
  recipeIngredients: {
    orderBy: { position: "asc" as const },
    include: { ingredient: { select: { slugIngredient: true } } },
  },
  steps: { orderBy: { stepNumber: "asc" as const } },
  categories: { include: { category: { select: { slugCategory: true } } } },
  tags: { include: { tag: { select: { slugTag: true } } } },
} as const;

/* ------------------------------------------------------------------ */
/*  Export — Ingredient (unitaire)                                     */
/* ------------------------------------------------------------------ */

export async function exportIngredientJsonAction(
  id: string,
): Promise<JsonActionResult<{ slug: string }>> {
  try {
    const row = await prisma.ingredient.findUnique({
      where: { id },
      include: ingredientJsonInclude,
    });
    if (!row) throw new Error("Ingrédient introuvable.");

    const json = ingredientToJson(row);
    const existing = await readIngredientsFile();

    const next: IngredientsFileJson = existing
      ? {
          ...existing,
          updatedAt: new Date().toISOString(),
          count: 0, // recalcul juste après
          ingredients: [
            ...existing.ingredients.filter((i) => i.slug !== json.slug),
            json,
          ],
        }
      : {
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          count: 1,
          ingredients: [json],
        };

    const sorted = [...next.ingredients].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.slug.localeCompare(b.slug);
    });

    await writeIngredientsFile({
      ...next,
      count: sorted.length,
      ingredients: sorted,
    });

    revalidatePath("/admin/ingredients");
    return { ok: true, data: { slug: json.slug } };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Export — Recipe (unitaire)                                         */
/* ------------------------------------------------------------------ */

export async function exportRecipeJsonAction(
  id: string,
): Promise<JsonActionResult<{ slug: string }>> {
  try {
    const row = await prisma.recipe.findUnique({
      where: { id },
      include: recipeJsonInclude,
    });
    if (!row) throw new Error("Recette introuvable.");

    const json = recipeToJson(row);
    await writeRecipeFile(json.slug, json);

    revalidatePath("/admin/recipes");
    return { ok: true, data: { slug: json.slug } };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Export — All                                                       */
/* ------------------------------------------------------------------ */

export async function exportAllJsonAction(): Promise<
  JsonActionResult<{ ingredients: number; recipes: number }>
> {
  try {
    const [ingredients, recipes] = await Promise.all([
      prisma.ingredient.findMany({
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        include: ingredientJsonInclude,
      }),
      prisma.recipe.findMany({
        orderBy: { displayOrder: "asc" },
        include: recipeJsonInclude,
      }),
    ]);

    await writeIngredientsFile(ingredientsFileToJson(ingredients));

    const indexEntries: {
      slug: string;
      title: string;
      displayOrder: number;
      image: string | null;
    }[] = [];

    for (const recipe of recipes) {
      const json = recipeToJson(recipe);
      await writeRecipeFile(json.slug, json);
      indexEntries.push({
        slug: json.slug,
        title: json.title,
        displayOrder: json.displayOrder,
        image: json.image,
      });
    }
    await writeRecipeIndex(indexEntries);

    revalidatePath("/admin/ingredients");
    revalidatePath("/admin/recipes");
    revalidatePath("/recipes");
    revalidatePath("/");

    return {
      ok: true,
      data: { ingredients: ingredients.length, recipes: recipes.length },
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Import — Ingredients                                               */
/* ------------------------------------------------------------------ */

export async function reimportIngredientsJsonAction(): Promise<
  JsonActionResult<{ upserted: number }>
> {
  try {
    const raw = await readIngredientsFile();
    if (!raw) {
      throw new Error("data/ingredients/ingredients.json introuvable.");
    }

    const parsed = ingredientsFileSchema.parse(raw);

    // Récupérer les codes → ids d'allergènes (une seule requête).
    const allergenRows = await prisma.allergen.findMany({
      select: { id: true, code: true },
    });
    const allergenIdByCode = new Map(
      allergenRows.map((a) => [a.code, a.id] as const),
    );

    let upserted = 0;

    for (const item of parsed.ingredients) {
      const allergenIds = item.allergens
        .map((code) => allergenIdByCode.get(code))
        .filter((id): id is string => Boolean(id));

      const data = {
        name: item.name,
        displayOrder: item.displayOrder,
        type: item.type,
        image: item.image,
        calories: item.nutrition.calories,
        protein: item.nutrition.protein,
        carbohydrates: item.nutrition.carbohydrates,
        sugars: item.nutrition.sugars,
        fat: item.nutrition.fat,
        saturatedFat: item.nutrition.saturatedFat,
        fiber: item.nutrition.fiber,
        salt: item.nutrition.salt,
      };

      const ingredient = await prisma.ingredient.upsert({
        where: { slugIngredient: item.slug },
        create: { slugIngredient: item.slug, ...data },
        update: data,
        select: { id: true },
      });

      // Remplacer les liens allergènes (deleteMany + createMany).
      await prisma.ingredientAllergen.deleteMany({
        where: { ingredientId: ingredient.id },
      });

      if (allergenIds.length > 0) {
        await prisma.ingredientAllergen.createMany({
          data: allergenIds.map((allergenId) => ({
            ingredientId: ingredient.id,
            allergenId,
          })),
        });
      }

      upserted += 1;
    }

    revalidatePath("/admin/ingredients");
    return { ok: true, data: { upserted } };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Import — Recipe                                                    */
/* ------------------------------------------------------------------ */

export async function reimportRecipeJsonAction(
  slug: string,
): Promise<JsonActionResult<{ slug: string }>> {
  try {
    const raw = await readRecipeFile(slug);
    if (!raw) {
      throw new Error(`Fichier JSON introuvable pour slug "${slug}".`);
    }

    const parsed = recipeFileSchema.parse(raw);

    // Résoudre les références par slug → id.
    const [ingredientRows, categoryRows, tagRows] = await Promise.all([
      prisma.ingredient.findMany({
        where: {
          slugIngredient: {
            in: parsed.ingredients.map((i) => i.ingredient),
          },
        },
        select: { id: true, slugIngredient: true },
      }),
      prisma.category.findMany({
        where: { slugCategory: { in: [...parsed.categories] } },
        select: { id: true, slugCategory: true },
      }),
      prisma.tag.findMany({
        where: { slugTag: { in: [...parsed.tags] } },
        select: { id: true, slugTag: true },
      }),
    ]);

    if (ingredientRows.length !== parsed.ingredients.length) {
      throw new Error(
        "Un ou plusieurs ingrédients sont introuvables en base (import préalable requis).",
      );
    }
    if (categoryRows.length !== parsed.categories.length) {
      throw new Error("Une ou plusieurs catégories sont introuvables en base.");
    }
    if (tagRows.length !== parsed.tags.length) {
      throw new Error("Un ou plusieurs tags sont introuvables en base.");
    }

    const ingredientIdBySlug = new Map(
      ingredientRows.map((r) => [r.slugIngredient, r.id] as const),
    );
    const categoryIdBySlug = new Map(
      categoryRows.map((r) => [r.slugCategory, r.id] as const),
    );
    const tagIdBySlug = new Map(tagRows.map((r) => [r.slugTag, r.id] as const));

    const baseData = {
      displayOrder: parsed.displayOrder,
      title: parsed.title,
      description: parsed.description,
      image: parsed.image,
      prepTime: parsed.prepTime,
      cookTime: parsed.cookTime,
      servings: parsed.servings,
      difficulty: parsed.difficulty,
      calories: parsed.calories,
    };

    const recipe = await prisma.recipe.upsert({
      where: { slugRecipe: parsed.slug },
      create: { slugRecipe: parsed.slug, ...baseData },
      update: baseData,
      select: { id: true, slugRecipe: true },
    });

    // Recreate relations : d'abord purger, puis recréer en transaction.
    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } }),
      prisma.step.deleteMany({ where: { recipeId: recipe.id } }),
      prisma.categoryToRecipe.deleteMany({ where: { recipeId: recipe.id } }),
      prisma.tagToRecipe.deleteMany({ where: { recipeId: recipe.id } }),
    ]);

    await prisma.$transaction([
      prisma.recipeIngredient.createMany({
        data: parsed.ingredients.map((line) => ({
          recipeId: recipe.id,
          ingredientId: ingredientIdBySlug.get(line.ingredient)!,
          amount: line.amount,
          unit: line.unit,
          note: line.note,
          position: line.position,
        })),
      }),
      prisma.step.createMany({
        data: parsed.steps.map((step) => ({
          recipeId: recipe.id,
          stepNumber: step.stepNumber,
          instruction: step.instruction,
          image: step.image,
        })),
      }),
      prisma.categoryToRecipe.createMany({
        data: parsed.categories.map((slugCategory) => ({
          recipeId: recipe.id,
          categoryId: categoryIdBySlug.get(slugCategory)!,
        })),
      }),
      prisma.tagToRecipe.createMany({
        data: parsed.tags.map((slugTag) => ({
          recipeId: recipe.id,
          tagId: tagIdBySlug.get(slugTag)!,
        })),
      }),
    ]);

    revalidatePath("/admin/recipes");
    revalidatePath("/recipes");
    revalidatePath(`/recipes/${parsed.slug}`);

    return { ok: true, data: { slug: recipe.slugRecipe } };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete — fichier JSON d'une recette                                */
/* ------------------------------------------------------------------ */

/**
 * Supprime le dossier JSON miroir d'une recette (utilisé par
 * app/recipes/_actions.ts::deleteRecipeAction). Best-effort côté
 * appelant : une erreur d'I/O n'invalide jamais la suppression DB.
 */
export async function deleteRecipeJsonAction(
  slug: string,
): Promise<JsonActionResult> {
  try {
    await deleteRecipeDir(slug);
    // Rafraîchir l'index (le slug supprimé ne doit plus apparaître).
    const slugs = await listRecipeSlugs();
    void slugs;
    revalidatePath("/admin/recipes");
    revalidatePath("/recipes");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Preview — lecture seule du fichier JSON ingrédients                */
/* ------------------------------------------------------------------ */

/**
 * Retourne le JSON brut du fichier `data/ingredients/ingredients.json`
 * pour affichage en lecture seule (Dialog aperçu côté client). Retourne
 * une chaîne vide et `exists: false` si le fichier n'existe pas encore.
 */
export async function readIngredientsJsonForPreviewAction(): Promise<
  JsonActionResult<{ json: string; exists: boolean; size: number }>
> {
  try {
    const raw = await readIngredientsFile();
    if (!raw) {
      return { ok: true, data: { json: "", exists: false, size: 0 } };
    }
    const json = JSON.stringify(raw, null, 2);
    return { ok: true, data: { json, exists: true, size: json.length } };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}