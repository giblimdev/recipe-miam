/*
path :           lib/validations/ingredient.ts
tag :            ["validation", "zod", "ingredient", "nutrition", "allergen", "bulk"]
projectId:       <recipe-miam>
type:            config
generic:         true

role:            Schémas Zod pour le CRUD des ingrédients du catalogue.
                 Couvre le formulaire create/update (identité, type, image,
                 nutrition pour 100 g, allergènes INCO liés), les
                 identifiants de suppression, et l'upsert bulk via un
                 tableau JSON (id optionnel : update si existant, sinon
                 create). Normalise les chaînes vides du champ image en
                 undefined. Mode strict partout pour rejeter les clés
                 inconnues côté Server Action.

flow:            Module TypeScript pur → export de ingredientFormSchema,
                 ingredientIdSchema, ingredientBulkItemSchema,
                 ingredientBulkSchema et types associés.
                 Aucun effet de bord.

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                 ]

relatedFiles:    ["@/app/admin/ingredients/_actions.ts",
                  "@/app/admin/ingredients/_components/IngredientManager.tsx",
                  "@/lib/labels.ts",
                  "@/lib/validations/taxonomy.ts"]

imports:         ["zod"]

exports:         ["ingredientFormSchema",
                  "ingredientIdSchema",
                  "ingredientBulkItemSchema",
                  "ingredientBulkSchema",
                  "IngredientFormInput",
                  "IngredientBulkItem",
                  "IngredientBulkInput",
                  "INGREDIENT_TYPE_VALUES"]

useBy:           ["@/app/admin/ingredients/_actions.ts",
                  "@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux valider un ingrédient avant écriture",
                  "*en tant qu'admin je veux upsert des ingrédients via un tableau JSON"]
status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugField = z
  .string()
  .trim()
  .min(1, "Slug requis.")
  .max(80, "80 caractères maximum.")
  .regex(
    SLUG_REGEX,
    "Format kebab-case attendu : minuscules, chiffres et tirets.",
  );

const nameField = z
  .string()
  .trim()
  .min(1, "Nom requis.")
  .max(120, "120 caractères maximum.");

const optionalImageField = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(200, "200 caractères maximum.").optional(),
);

/** Valeur nutritionnelle pour 100 g — nombre ≥ 0 ou null. */
const nutritionField = z
  .number({ error: "Nombre invalide." })
  .min(0, "La valeur ne peut pas être négative.")
  .max(100_000, "Valeur trop élevée.")
  .nullable();

const idSchema = z
  .object({
    id: z.string().trim().min(1, "Identifiant requis."),
  })
  .strict();

/* ------------------------------------------------------------------ */
/*  IngredientType (aligné sur prisma/schema.prisma)                   */
/* ------------------------------------------------------------------ */

/**
 * Valeurs exactes de l'enum Prisma `IngredientType`.
 * Source de vérité : prisma/schema.prisma — ne pas diverger.
 */
export const INGREDIENT_TYPE_VALUES = [
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
] as const;

const ingredientTypeSchema = z.enum(INGREDIENT_TYPE_VALUES);

/* ------------------------------------------------------------------ */
/*  Formulaire create / update                                         */
/* ------------------------------------------------------------------ */

/**
 * Payload du formulaire admin d'ingrédient.
 * - `displayOrder` n'est pas géré ici : assigné côté Server Action
 *   (max + 1 à la création, inchangé à l'édition sauf reorder dédié).
 * - `allergenIds` : ids des lignes `Allergen` à lier (table de jointure).
 */
export const ingredientFormSchema = z
  .object({
    name: nameField,

    slugIngredient: slugField,

    type: ingredientTypeSchema.nullable(),

    image: optionalImageField,

    // ——— Nutrition pour 100 g ———
    calories: nutritionField,
    protein: nutritionField,
    carbohydrates: nutritionField,
    sugars: nutritionField,
    fat: nutritionField,
    saturatedFat: nutritionField,
    fiber: nutritionField,
    salt: nutritionField,

    allergenIds: z
      .array(z.string().trim().min(1, "Identifiant allergène invalide."))
      .default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.allergenIds).size !== data.allergenIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["allergenIds"],
        message: "Allergènes en double.",
      });
    }
  });

export type IngredientFormInput = z.input<typeof ingredientFormSchema>;

/* ------------------------------------------------------------------ */
/*  Identifiant (delete / get)                                         */
/* ------------------------------------------------------------------ */

export const ingredientIdSchema = idSchema;

/* ------------------------------------------------------------------ */
/*  Ligne bulk (upsert)                                                */
/* ------------------------------------------------------------------ */

/**
 * Une entrée du tableau JSON :
 * - avec `id` présent et existant en base → update
 * - sans `id` (ou id inconnu) → create
 *
 * Note : `and` évite la dépendance à Zod `.safeExtend` (versions variables).
 */
export const ingredientBulkItemSchema = ingredientFormSchema.and(
  z
    .object({
      id: z.string().trim().min(1).optional(),
    })
    .strict(),
);

export const ingredientBulkSchema = z
  .object({
    items: z
      .array(ingredientBulkItemSchema)
      .min(1, "Au moins un ingrédient requis.")
      .max(200, "200 ingrédients maximum par envoi."),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = data.items
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));

    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "IDs en double dans le tableau JSON.",
      });
    }

    const slugs = data.items.map((item) => item.slugIngredient);
    if (new Set(slugs).size !== slugs.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Slugs en double dans le tableau JSON.",
      });
    }
  });

export type IngredientBulkItem = z.input<typeof ingredientBulkItemSchema>;
export type IngredientBulkInput = z.input<typeof ingredientBulkSchema>;