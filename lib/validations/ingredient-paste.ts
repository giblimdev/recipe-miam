/*
path :           lib/validations/ingredient-paste.ts
tag :            ["validation", "zod", "ingredient", "paste", "import"]
projectId:       <recipe-miam>
type:            config
generic:         true

role:            Schéma Zod du payload "Coller du JSON" sur la page
                 /admin/ingredients. Accepte DEUX formes d'entrée :
                 - un TABLEAU NU       → [ {...}, {...} ]
                 - un OBJET ENVELOPPE  → { "ingredients": [ {...}, ... ] }
                 (typiquement un export du fichier
                 data/ingredients/ingredients.json).
                 Chaque item accepte la nutrition en objet imbriqué
                 ({ nutrition: { calories, ... } }) OU en champs plats
                 (calories, protein, ...), pour tolérer indifféremment
                 les deux formats. Tolère aussi "slugIngredient" comme
                 alias de "slug" (rétro-compat avec le schéma Prisma).
                 Rejette : id (non fiable), schéma inconnu, codes
                 allergènes inconnus, doublons de slug dans le tableau.
                 Mode strict côté valeurs (bornes nutrition, longueurs,
                 regex slug).

flow:            Module TypeScript pur → export de ingredientPasteItemSchema,
                 ingredientPasteSchema et du type IngredientPasteItem.
                 Aucun effet.

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientForm.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/_components/IngredientPasteDialog.tsx",
                   "@/app/admin/ingredients/new/page.tsx",
                   "@/app/admin/ingredients/[id]/edit/page.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                   "@/lib/validations/ingredient-paste.ts",
                 ]

relatedFiles:    ["@/lib/validations/ingredient.ts",
                  "@/lib/generated/prisma/enums"]

imports:         ["zod"]

exports:         ["ingredientPasteItemSchema",
                  "ingredientPasteSchema",
                  "IngredientPasteItem"]

useBy:           ["@/app/admin/_actions/json-export.ts",
                  "@/app/admin/ingredients/_components/IngredientPasteDialog.tsx"]

userStories:     ["*en tant qu'admin je veux coller un tableau JSON d'ingrédients et l'importer"]
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
  .min(1, "Slug requis.")
  .max(120, "120 caractères maximum.")
  .regex(SLUG_REGEX, "Format kebab-case strict attendu.");

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
  .number({ error: "Nombre invalide." })
  .min(0, "Valeur ≥ 0 attendue.")
  .max(100_000, "Valeur trop élevée.")
  .nullable();

/* ------------------------------------------------------------------ */
/*  Item                                                               */
/* ------------------------------------------------------------------ */

/**
 * Forme "canonique" attendue après parsing : nutrition à plat + allergens
 * en codes + displayOrder optionnel. Le préprocesseur accepte les deux
 * formes (objet `nutrition` imbriqué OU champs plats) et les fusionne.
 * Accepte aussi "slugIngredient" comme alias de "slug" et ignore "id".
 */
export const ingredientPasteItemSchema = z.preprocess(
  (raw) => {
    if (typeof raw !== "object" || raw === null) return raw;

    const input = raw as Record<string, unknown>;
    const nutrition =
      input.nutrition && typeof input.nutrition === "object"
        ? (input.nutrition as Record<string, unknown>)
        : {};

    const pick = (key: string): unknown => {
      const fromNutrition = nutrition[key];
      if (fromNutrition !== undefined) return fromNutrition;
      return input[key];
    };

    return {
      slug: input.slug ?? input.slugIngredient,
      name: input.name,
      type: input.type ?? null,
      image: input.image ?? null,
      displayOrder: input.displayOrder,
      calories: pick("calories"),
      protein: pick("protein"),
      carbohydrates: pick("carbohydrates"),
      sugars: pick("sugars"),
      fat: pick("fat"),
      saturatedFat: pick("saturatedFat"),
      fiber: pick("fiber"),
      salt: pick("salt"),
      allergens: input.allergens ?? [],
    };
  },
  z
    .object({
      slug: slugSchema,
      name: z
        .string()
        .trim()
        .min(1, "Nom requis.")
        .max(120, "120 caractères maximum."),
      type: ingredientTypeSchema.nullable(),
      image: z
        .string()
        .trim()
        .max(200, "200 caractères maximum.")
        .nullable(),
      displayOrder: z.number().int().min(0).optional(),
      calories: nutritionNumber,
      protein: nutritionNumber,
      carbohydrates: nutritionNumber,
      sugars: nutritionNumber,
      fat: nutritionNumber,
      saturatedFat: nutritionNumber,
      fiber: nutritionNumber,
      salt: nutritionNumber,
      allergens: z.array(allergenCodeSchema).default([]),
    })
    .strict(),
);

export type IngredientPasteItem = z.output<typeof ingredientPasteItemSchema>;

/* ------------------------------------------------------------------ */
/*  Payload global                                                     */
/* ------------------------------------------------------------------ */

/**
 * Accepte :
 *   - un tableau nu                 → [ {...}, {...} ]
 *   - un objet { ingredients: [ ] } → même enveloppe que le fichier miroir
 */
export const ingredientPasteSchema = z.preprocess(
  (raw) => {
    if (Array.isArray(raw)) return { ingredients: raw };
    return raw;
  },
  z
    .object({
      ingredients: z
        .array(ingredientPasteItemSchema)
        .min(1, "Le tableau doit contenir au moins un ingrédient.")
        .max(200, "200 ingrédients maximum par import."),
    })
    .strict()
    .superRefine((data, ctx) => {
      const slugs = data.ingredients.map((i) => i.slug);
      if (new Set(slugs).size !== slugs.length) {
        ctx.addIssue({
          code: "custom",
          path: ["ingredients"],
          message: "Slugs en double dans le tableau.",
        });
      }
    }),
);