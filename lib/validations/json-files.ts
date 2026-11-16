/*
path :           lib/validations/json-files.ts
tag :            ["validation", "zod", "json", "import", "helper"]
projectId:       <recipe-miam>
type:            config
generic:         true

role:            Schémas Zod pour valider les fichiers JSON miroirs
                 AVANT un import DB (évite qu'un JSON corrompu ou
                 édité à la main corrompe la base). Alignés sur les
                 enums Prisma et sur les contraintes du schéma
                 (longueurs, slugs, positions ≥ 0). Mode strict.

flow:            Module TypeScript pur → export de ingredientJsonSchema,
                 ingredientsFileSchema, recipeJsonSchema,
                 recipeFileSchema et des types inférés. Aucun effet.

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
                  "@/lib/generated/prisma/enums"]

imports:         ["zod"]

exports:         ["ingredientJsonSchema",
                  "ingredientsFileSchema",
                  "recipeJsonSchema",
                  "recipeFileSchema"]

useBy:           ["@/app/admin/_actions/json-export.ts",
                  "@/scripts/import-from-json.ts"]

userStories:     ["*en tant qu'admin je veux importer un JSON validé dans la base"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Enums (alignés sur prisma/schema.prisma)                           */
/* ------------------------------------------------------------------ */

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(SLUG_REGEX, "Format kebab-case strict attendu.");

const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

const unitSchema = z.enum([
  "GRAM",
  "KILOGRAM",
  "MILLILITER",
  "CENTILITER",
  "LITER",
  "TEASPOON",
  "TABLESPOON",
  "CUP",
  "PIECE",
  "PINCH",
  "CLOVE",
  "SLICE",
  "BUNCH",
]);

const ingredientTypeSchema = z.enum([
  "LEGUME",
  "FRUIT",
  "VIANDE",
  "POISSON",
  "FRUITS_DE_MER",
  "OEUF",
  "PRODUITS_LAITIERS",
  "FECULENT",
  "LEGUMINEUSE",
  "FRUITS_A_COQUE_GRAINES",
  "EPICE",
  "HERBE",
  "MATIERE_GRASSE",
  "SUCRE",
  "CONDIMENT",
  "LIQUIDE",
  "AUTRE",
]);

const allergenCodeSchema = z.enum([
  "GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOYBEANS",
  "MILK",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
]);

const nutritionNumber = z
  .number()
  .min(0)
  .max(100_000)
  .nullable();

/* ------------------------------------------------------------------ */
/*  Ingredient                                                         */
/* ------------------------------------------------------------------ */

export const ingredientJsonSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(120),
    type: ingredientTypeSchema.nullable(),
    image: z.string().trim().max(200).nullable(),
    displayOrder: z.number().int().min(0),
    nutrition: z
      .object({
        calories: nutritionNumber,
        protein: nutritionNumber,
        carbohydrates: nutritionNumber,
        sugars: nutritionNumber,
        fat: nutritionNumber,
        saturatedFat: nutritionNumber,
        fiber: nutritionNumber,
        salt: nutritionNumber,
      })
      .strict(),
    allergens: z.array(allergenCodeSchema).default([]),
  })
  .strict();

export const ingredientsFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: z.string().min(1),
    count: z.number().int().min(0),
    ingredients: z.array(ingredientJsonSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.count !== data.ingredients.length) {
      ctx.addIssue({
        code: "custom",
        path: ["count"],
        message: "count ne correspond pas au nombre d'ingrédients.",
      });
    }
    const slugs = data.ingredients.map((i) => i.slug);
    if (new Set(slugs).size !== slugs.length) {
      ctx.addIssue({
        code: "custom",
        path: ["ingredients"],
        message: "Slugs d'ingrédients en double.",
      });
    }
  });

/* ------------------------------------------------------------------ */
/*  Recipe                                                             */
/* ------------------------------------------------------------------ */

const recipeIngredientLineSchema = z
  .object({
    ingredient: slugSchema,
    amount: z.number().positive().nullable(),
    unit: unitSchema.nullable(),
    note: z.string().trim().max(200).nullable(),
    position: z.number().int().min(0),
  })
  .strict();

const recipeStepSchema = z
  .object({
    stepNumber: z.number().int().min(1),
    instruction: z.string().trim().min(1).max(3000),
    image: z.string().trim().max(500).nullable(),
  })
  .strict();

export const recipeJsonSchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: z.string().min(1),
    slug: slugSchema,
    displayOrder: z.number().int().min(0),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().min(1).max(3000),
    image: z.string().trim().max(500).nullable(),
    prepTime: z.number().int().min(0).max(1440),
    cookTime: z.number().int().min(0).max(1440),
    servings: z.number().int().min(1).max(1000),
    difficulty: difficultySchema,
    calories: z.number().int().min(0).max(10000).nullable(),
    ingredients: z.array(recipeIngredientLineSchema).min(1),
    steps: z.array(recipeStepSchema).min(1),
    categories: z.array(slugSchema).default([]),
    tags: z.array(slugSchema).default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = data.ingredients.map((i) => i.ingredient);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["ingredients"],
        message: "Un même ingrédient ne peut apparaître qu'une fois.",
      });
    }
    const numbers = data.steps.map((s) => s.stepNumber);
    if (new Set(numbers).size !== numbers.length) {
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: "stepNumber en double.",
      });
    }
  });

export const recipeFileSchema = recipeJsonSchema;