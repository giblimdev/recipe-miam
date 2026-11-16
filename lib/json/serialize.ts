/*
path :           lib/json/serialize.ts
tag :            ["json", "serialize", "helper", "pure", "prisma"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Fonctions PURES de conversion Prisma → JSON miroir.
                 Aucune I/O, aucun effet : prennent un payload Prisma
                 (avec ses relations incluses) et retournent un objet
                 JSON stable, référencé par slug. Utilisées par
                 storage.ts (écriture) et par les scripts d'export.

flow:            ingredientToJson(row) → { slug, name, type, image,
                 displayOrder, nutrition: {...}, allergens: code[] }.
                 recipeToJson(row) → { schemaVersion, updatedAt, slug,
                 title, ..., ingredients: [{ingredient: slug, ...}],
                 steps: [...], categories: slug[], tags: slug[] }.

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

relatedFiles:    ["@/lib/json/types.ts",
                  "@/lib/prisma"]

imports:         ["@/lib/json/types"]

exports:         ["ingredientToJson",
                  "recipeToJson",
                  "ingredientsFileToJson",
                  "nowIso"]

useBy:           ["@/lib/json/storage.ts",
                  "@/app/admin/_actions/json-export.ts"]

userStories:     ["*en tant que développeur je veux convertir une row Prisma en JSON stable"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import {
  JSON_SCHEMA_VERSION,
  type IngredientJson,
  type IngredientsFileJson,
  type RecipeJson,
} from "@/lib/json/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/*  Ingredient                                                         */
/* ------------------------------------------------------------------ */

/**
 * Structure Prisma attendue : Ingredient avec `allergens` inclus et
 * `allergens.allergen` inclus (code + name).
 */
export interface IngredientPrismaRow {
  readonly slugIngredient: string;
  readonly name: string;
  readonly type: IngredientJson["type"];
  readonly image: string | null;
  readonly displayOrder: number;
  readonly calories: number | null;
  readonly protein: number | null;
  readonly carbohydrates: number | null;
  readonly sugars: number | null;
  readonly fat: number | null;
  readonly saturatedFat: number | null;
  readonly fiber: number | null;
  readonly salt: number | null;
  readonly allergens: readonly {
    readonly allergen: { readonly code: IngredientJson["allergens"][number] };
  }[];
}

export function ingredientToJson(row: IngredientPrismaRow): IngredientJson {
  return {
    slug: row.slugIngredient,
    name: row.name,
    type: row.type,
    image: row.image,
    displayOrder: row.displayOrder,
    nutrition: {
      calories: row.calories,
      protein: row.protein,
      carbohydrates: row.carbohydrates,
      sugars: row.sugars,
      fat: row.fat,
      saturatedFat: row.saturatedFat,
      fiber: row.fiber,
      salt: row.salt,
    },
    allergens: row.allergens.map((link) => link.allergen.code),
  };
}

export function ingredientsFileToJson(
  rows: readonly IngredientPrismaRow[],
): IngredientsFileJson {
  const ingredients = rows
    .map(ingredientToJson)
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.slug.localeCompare(b.slug);
    });

  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    updatedAt: nowIso(),
    count: ingredients.length,
    ingredients,
  };
}

/* ------------------------------------------------------------------ */
/*  Recipe                                                             */
/* ------------------------------------------------------------------ */

/**
 * Structure Prisma attendue : Recipe avec `recipeIngredients.ingredient`,
 * `steps`, `categories.category`, `tags.tag` inclus.
 */
export interface RecipePrismaRow {
  readonly slugRecipe: string;
  readonly displayOrder: number;
  readonly title: string;
  readonly description: string;
  readonly image: string | null;
  readonly prepTime: number;
  readonly cookTime: number;
  readonly servings: number;
  readonly difficulty: RecipeJson["difficulty"];
  readonly calories: number | null;
  readonly recipeIngredients: readonly {
    readonly position: number;
    readonly amount: number | null;
    readonly unit: RecipeJson["ingredients"][number]["unit"];
    readonly note: string | null;
    readonly ingredient: { readonly slugIngredient: string };
  }[];
  readonly steps: readonly {
    readonly stepNumber: number;
    readonly instruction: string;
    readonly image: string | null;
  }[];
  readonly categories: readonly {
    readonly category: { readonly slugCategory: string };
  }[];
  readonly tags: readonly {
    readonly tag: { readonly slugTag: string };
  }[];
}

export function recipeToJson(row: RecipePrismaRow): RecipeJson {
  const ingredients = [...row.recipeIngredients]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({
      ingredient: line.ingredient.slugIngredient,
      amount: line.amount,
      unit: line.unit,
      note: line.note,
      position: line.position,
    }));

  const steps = [...row.steps]
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((step) => ({
      stepNumber: step.stepNumber,
      instruction: step.instruction,
      image: step.image,
    }));

  const categories = [...row.categories]
    .map((link) => link.category.slugCategory)
    .sort();

  const tags = [...row.tags].map((link) => link.tag.slugTag).sort();

  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    updatedAt: nowIso(),
    slug: row.slugRecipe,
    displayOrder: row.displayOrder,
    title: row.title,
    description: row.description,
    image: row.image,
    prepTime: row.prepTime,
    cookTime: row.cookTime,
    servings: row.servings,
    difficulty: row.difficulty,
    calories: row.calories,
    ingredients,
    steps,
    categories,
    tags,
  };
}