/*
path :           lib/json/types.ts
tag :            ["json", "types", "serialization", "helper", "config"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Types stables des fichiers JSON miroirs (ingrédients et
                 recettes). Versionnés via `schemaVersion` pour permettre
                 des migrations futures. Les références entre fichiers se
                 font PAR SLUG (jamais par cuid) → fichiers portables,
                 lisibles en Git, réutilisables comme seed ou contexte IA.

flow:            Module TypeScript pur → export des interfaces IngredientJson,
                 RecipeJson, RecipeIndexEntry et de la constante
                 JSON_SCHEMA_VERSION.

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

relatedFiles:    ["@/lib/validations/json-files.ts",
                  "@/lib/generated/prisma/enums"]

imports:         ["@/lib/generated/prisma/enums"]

exports:         ["JSON_SCHEMA_VERSION",
                  "IngredientJson",
                  "RecipeJson",
                  "RecipeIndexEntry",
                  "IngredientsFileJson",
                  "RecipeFileJson"]

useBy:           ["@/lib/json/serialize.ts",
                  "@/lib/json/storage.ts",
                  "@/lib/validations/json-files.ts",
                  "@/app/admin/_actions/json-export.ts",
                  "@/app/admin/sync/_components/SyncPanel.tsx"]

userStories:     ["*en tant que développeur je veux des types JSON stables et versionnés"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import type {
  AllergenCode,
  Difficulty,
  IngredientType,
  Unit,
} from "@/lib/generated/prisma/enums";

/* ------------------------------------------------------------------ */
/*  Version                                                            */
/* ------------------------------------------------------------------ */

/**
 * Version du format JSON. Incrémenter à chaque changement structurel
 * cassant. Les scripts d'import peuvent refuser ou migrer une version
 * antérieure.
 */
export const JSON_SCHEMA_VERSION = 1 as const;

/* ------------------------------------------------------------------ */
/*  Ingredient                                                         */
/* ------------------------------------------------------------------ */

export interface IngredientNutritionJson {
  readonly calories: number | null;
  readonly protein: number | null;
  readonly carbohydrates: number | null;
  readonly sugars: number | null;
  readonly fat: number | null;
  readonly saturatedFat: number | null;
  readonly fiber: number | null;
  readonly salt: number | null;
}

export interface IngredientJson {
  readonly slug: string;
  readonly name: string;
  readonly type: IngredientType | null;
  readonly image: string | null;
  readonly displayOrder: number;
  readonly nutrition: IngredientNutritionJson;
  /** Codes INCO (ex. ["GLUTEN", "MILK"]) — stables et lisibles. */
  readonly allergens: readonly AllergenCode[];
}

export interface IngredientsFileJson {
  readonly schemaVersion: typeof JSON_SCHEMA_VERSION;
  readonly updatedAt: string;
  readonly count: number;
  readonly ingredients: readonly IngredientJson[];
}

/* ------------------------------------------------------------------ */
/*  Recipe                                                             */
/* ------------------------------------------------------------------ */

export interface RecipeIngredientJson {
  /** Slug de l'ingrédient référencé (pas l'id cuid). */
  readonly ingredient: string;
  readonly amount: number | null;
  readonly unit: Unit | null;
  readonly note: string | null;
  readonly position: number;
}

export interface RecipeStepJson {
  readonly stepNumber: number;
  readonly instruction: string;
  readonly image: string | null;
}

export interface RecipeJson {
  readonly schemaVersion: typeof JSON_SCHEMA_VERSION;
  readonly updatedAt: string;

  readonly slug: string;
  readonly displayOrder: number;
  readonly title: string;
  readonly description: string;
  readonly image: string | null;

  readonly prepTime: number;
  readonly cookTime: number;
  readonly servings: number;
  readonly difficulty: Difficulty;
  readonly calories: number | null;

  readonly ingredients: readonly RecipeIngredientJson[];
  readonly steps: readonly RecipeStepJson[];

  /** Slugs des catégories. */
  readonly categories: readonly string[];
  /** Slugs des tags. */
  readonly tags: readonly string[];
}

/**
 * Format du fichier `data/recipes/[slug]/[slug].json`.
 * Identique à `RecipeJson` (nommage sémantique pour les lectures de fichier).
 */
export type RecipeFileJson = RecipeJson;

/* ------------------------------------------------------------------ */
/*  Index global des recettes (optionnel, pour listing rapide)         */
/* ------------------------------------------------------------------ */

export interface RecipeIndexEntry {
  readonly slug: string;
  readonly title: string;
  readonly displayOrder: number;
  readonly image: string | null;
}