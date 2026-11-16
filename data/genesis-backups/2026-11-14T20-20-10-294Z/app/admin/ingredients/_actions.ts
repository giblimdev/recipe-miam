/*
path :           app/admin/ingredients/_actions.ts
tag :            ["admin", "ingredient", "crud", "server-action"]
projectId:       <recipe-miam>
type:            action
generic:         false

role:            Server Actions CRUD pour le catalogue d'ingrédients.
                 Expose create, update, delete et un seed d'exemples.
                 Chaque action valide son payload via Zod, vérifie les
                 allergènes référencés, gère la jointure
                 IngredientAllergen, capture P2002 (slug unique) et les
                 suppressions bloquées par des recettes liées, puis
                 revalide /admin/ingredients. displayOrder auto-incrémenté
                 à la création.

flow:            create(input) → ingredientFormSchema.parse →
                 validateAllergens → aggregate max displayOrder →
                 prisma.ingredient.create (+ allergens) → revalidatePath.
                 update(id, input) → id + form → validateAllergens →
                 deleteMany allergens + create → update champs →
                 revalidatePath.
                 delete(id) → idSchema → prisma.delete (échec si recettes
                 liées via Restrict) → revalidatePath.
                 seedExample() → boucle d'exemples, ignore P2002 →
                 { created, skipped }.

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                 ]

relatedFiles:    ["@/lib/prisma.ts",
                  "@/lib/validations/ingredient.ts"]

imports:         ["next/cache",
                  "@/lib/prisma",
                  "@/lib/validations/ingredient"]

exports:         ["ActionResult",
                  "createIngredientAction",
                  "updateIngredientAction",
                  "deleteIngredientAction",
                  "seedExampleIngredientsAction"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux créer, éditer et supprimer des ingrédients"]
status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  ingredientFormSchema,
  ingredientIdSchema,
} from "@/lib/validations/ingredient";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

const REVALIDATE_PATH = "/admin/ingredients";

/* ------------------------------------------------------------------ */
/*  Erreurs                                                            */
/* ------------------------------------------------------------------ */

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** FK Restrict : ingrédient encore référencé par une recette. */
function isRestrictError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2003"
  );
}

function toUserMessage(error: unknown): string {
  if (isUniqueError(error)) {
    return "Ce nom de slug est déjà utilisé par un autre ingrédient.";
  }
  if (isRestrictError(error)) {
    return "Impossible de supprimer : cet ingrédient est encore utilisé dans une ou plusieurs recettes.";
  }
  if (error instanceof Error) return error.message;
  return "Erreur inconnue.";
}

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

async function validateAllergenIds(
  allergenIds: readonly string[],
): Promise<void> {
  if (allergenIds.length === 0) return;

  const allergens = await prisma.allergen.findMany({
    where: { id: { in: [...allergenIds] } },
    select: { id: true },
  });

  if (allergens.length !== allergenIds.length) {
    throw new Error("Un ou plusieurs allergènes sont introuvables.");
  }
}

function toPrismaData(
  data: ReturnType<typeof ingredientFormSchema.parse>,
) {
  return {
    name: data.name,
    slugIngredient: data.slugIngredient,
    type: data.type,
    image: data.image ?? null,
    calories: data.calories,
    protein: data.protein,
    carbohydrates: data.carbohydrates,
    sugars: data.sugars,
    fat: data.fat,
    saturatedFat: data.saturatedFat,
    fiber: data.fiber,
    salt: data.salt,
  };
}

/* ------------------------------------------------------------------ */
/*  Create                                                             */
/* ------------------------------------------------------------------ */

export async function createIngredientAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = ingredientFormSchema.parse(input);
    await validateAllergenIds(data.allergenIds);

    const last = await prisma.ingredient.aggregate({
      _max: { displayOrder: true },
    });

    const ingredient = await prisma.ingredient.create({
      data: {
        ...toPrismaData(data),
        displayOrder: (last._max.displayOrder ?? -1) + 1,
        allergens: {
          create: data.allergenIds.map((allergenId) => ({
            allergenId,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { id: ingredient.id } };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Update                                                             */
/* ------------------------------------------------------------------ */

export async function updateIngredientAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsedId = ingredientIdSchema.parse({ id });
    const data = ingredientFormSchema.parse(input);
    await validateAllergenIds(data.allergenIds);

    const existing = await prisma.ingredient.findUnique({
      where: { id: parsedId.id },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Cet ingrédient n'existe plus.");
    }

    await prisma.ingredient.update({
      where: { id: parsedId.id },
      data: {
        ...toPrismaData(data),
        allergens: {
          deleteMany: {},
          create: data.allergenIds.map((allergenId) => ({
            allergenId,
          })),
        },
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete                                                             */
/* ------------------------------------------------------------------ */

export async function deleteIngredientAction(
  id: string,
): Promise<ActionResult> {
  try {
    const parsedId = ingredientIdSchema.parse({ id });

    // Restrict côté RecipeIngredient : échec explicite si encore lié.
    const usage = await prisma.recipeIngredient.count({
      where: { ingredientId: parsedId.id },
    });

    if (usage > 0) {
      return {
        ok: false,
        error: `Impossible de supprimer : utilisé dans ${usage} recette${usage > 1 ? "s" : ""}.`,
      };
    }

    await prisma.ingredient.delete({ where: { id: parsedId.id } });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Seed exemples                                                      */
/* ------------------------------------------------------------------ */

const EXAMPLE_INGREDIENTS = [
  {
    name: "Farine de blé T55",
    slugIngredient: "farine-de-ble-t55",
    type: "FECULENT" as const,
    image: null,
    calories: 364,
    protein: 10,
    carbohydrates: 76,
    sugars: 0.5,
    fat: 1,
    saturatedFat: 0.2,
    fiber: 2.7,
    salt: 0,
  },
  {
    name: "Beurre doux",
    slugIngredient: "beurre-doux",
    type: "PRODUITS_LAITIERS" as const,
    image: null,
    calories: 717,
    protein: 0.7,
    carbohydrates: 0.1,
    sugars: 0.1,
    fat: 81,
    saturatedFat: 51,
    fiber: 0,
    salt: 0.02,
  },
  {
    name: "Œuf",
    slugIngredient: "oeuf",
    type: "OEUF" as const,
    image: null,
    calories: 155,
    protein: 13,
    carbohydrates: 1.1,
    sugars: 1.1,
    fat: 11,
    saturatedFat: 3.3,
    fiber: 0,
    salt: 0.12,
  },
  {
    name: "Sucre en poudre",
    slugIngredient: "sucre-en-poudre",
    type: "SUCRE" as const,
    image: null,
    calories: 400,
    protein: 0,
    carbohydrates: 100,
    sugars: 100,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: 0,
  },
  {
    name: "Lait entier",
    slugIngredient: "lait-entier",
    type: "PRODUITS_LAITIERS" as const,
    image: null,
    calories: 64,
    protein: 3.2,
    carbohydrates: 4.8,
    sugars: 4.8,
    fat: 3.6,
    saturatedFat: 2.3,
    fiber: 0,
    salt: 0.1,
  },
  {
    name: "Huile d'olive",
    slugIngredient: "huile-d-olive",
    type: "MATIERE_GRASSE" as const,
    image: null,
    calories: 884,
    protein: 0,
    carbohydrates: 0,
    sugars: 0,
    fat: 100,
    saturatedFat: 14,
    fiber: 0,
    salt: 0,
  },
  {
    name: "Tomate",
    slugIngredient: "tomate",
    type: "LEGUME" as const,
    image: null,
    calories: 18,
    protein: 0.9,
    carbohydrates: 3.9,
    sugars: 2.6,
    fat: 0.2,
    saturatedFat: 0,
    fiber: 1.2,
    salt: 0.01,
  },
  {
    name: "Ail",
    slugIngredient: "ail",
    type: "CONDIMENT" as const,
    image: null,
    calories: 149,
    protein: 6.4,
    carbohydrates: 33,
    sugars: 1,
    fat: 0.5,
    saturatedFat: 0.1,
    fiber: 2.1,
    salt: 0.02,
  },
] as const;

export async function seedExampleIngredientsAction(): Promise<
  ActionResult<{ created: number; skipped: number }>
> {
  try {
    let created = 0;
    let skipped = 0;

    const last = await prisma.ingredient.aggregate({
      _max: { displayOrder: true },
    });
    let nextOrder = (last._max.displayOrder ?? -1) + 1;

    for (const example of EXAMPLE_INGREDIENTS) {
      try {
        await prisma.ingredient.create({
          data: {
            ...example,
            displayOrder: nextOrder,
          },
        });
        created += 1;
        nextOrder += 1;
      } catch (error) {
        if (isUniqueError(error)) skipped += 1;
        else throw error;
      }
    }

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { created, skipped } };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}