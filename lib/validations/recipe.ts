
/*
path:            lib/validations/recipe.ts
tag:             ["recipe", "validation", "zod", "ingredients", "steps"]
projectId:       <recipe-miam>
type:            config
generic:         true

role:            Schémas Zod des formulaires de création et de modification
                 des recettes. Valide les informations générales, les
                 ingrédients, les étapes, les catégories et les tags.

relatedFiles:    ["@/app/admin/recipes/_actions.ts",
                  "@/app/admin/recipes/_components/RecipeForm.tsx"]

imports:         ["zod"]

exports:         ["recipeFormSchema", "recipeIdSchema",
                  "RecipeFormInput"]

useBy:           ["@/app/admin/recipes/_actions.ts",
                  "@/app/admin/recipes/_components/RecipeForm.tsx"]
*/

import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const recipeIdSchema = z
  .object({
    id: z.string().trim().min(1, "Identifiant requis."),
  })
  .strict();

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

const ingredientLineSchema = z
  .object({
    ingredientId: z.string().trim().min(1, "Ingrédient requis."),
    amount: z.number().positive().nullable(),
    unit: unitSchema.nullable(),
    note: z.string().trim().max(200).nullable(),
  })
  .strict();

const stepSchema = z
  .object({
    instruction: z
      .string()
      .trim()
      .min(1, "L'instruction est obligatoire.")
      .max(3000, "3000 caractères maximum."),
    image: z.string().trim().max(500).nullable(),
  })
  .strict();

export const recipeFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Le titre doit contenir au moins 2 caractères.")
      .max(120, "120 caractères maximum."),

    slugRecipe: z
      .string()
      .trim()
      .min(1, "Le slug est obligatoire.")
      .max(150)
      .regex(slugRegex, "Format kebab-case attendu."),

    description: z
      .string()
      .trim()
      .min(1, "La description est obligatoire.")
      .max(3000),

    image: z.string().trim().max(500).nullable(),

    prepTime: z.number().int().min(0).max(1440),
    cookTime: z.number().int().min(0).max(1440),
    servings: z.number().int().min(1).max(1000),

    difficulty: difficultySchema,
    calories: z.number().int().min(0).max(10000).nullable(),

    ingredients: z
      .array(ingredientLineSchema)
      .min(1, "Ajoutez au moins un ingrédient."),

    steps: z
      .array(stepSchema)
      .min(1, "Ajoutez au moins une étape."),

    categoryIds: z.array(z.string().min(1)).default([]),
    tagIds: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ingredientIds = data.ingredients.map(
      (ingredient) => ingredient.ingredientId,
    );

    if (new Set(ingredientIds).size !== ingredientIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["ingredients"],
        message: "Un même ingrédient ne peut apparaître qu'une fois.",
      });
    }

    if (new Set(data.categoryIds).size !== data.categoryIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryIds"],
        message: "Catégories en double.",
      });
    }

    if (new Set(data.tagIds).size !== data.tagIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["tagIds"],
        message: "Tags en double.",
      });
    }
  });

export type RecipeFormInput = z.infer<typeof recipeFormSchema>;
