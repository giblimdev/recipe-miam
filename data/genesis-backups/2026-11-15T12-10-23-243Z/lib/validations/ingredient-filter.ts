/*
path :           lib/validations/ingredient-filter.ts
tag :            ["validation", "zod", "ingredient", "filter", "url-param"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Schéma Zod du paramètre d'URL ?type= qui filtre la
                 liste des ingrédients par IngredientType. Accepte :
                 - une valeur de l'enum Prisma (ex. "LEGUME", "FRUIT"),
                 - la sentinelle "none" (ingrédients non classés,
                   type Prisma = null),
                 - undefined (pas de filtre → tous les ingrédients).
                 Exposé isolément pour ne pas coupler la validation de
                 l'URL au schéma de formulaire de
                 lib/validations/ingredient.ts.

flow:            Module pur → INGREDIENT_TYPE_VALUES (dérivé de l'enum
                 Prisma) + ingredientTypeFilterSchema (z.string().refine
                 acceptant enum OU "none") + normalizeTypeFilter(raw)
                 (safeParse → valeur typée | undefined, jamais throw).

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/_components/IngredientStudio.tsx",
                   "@/app/admin/ingredients/_components/IngredientTypeFilter.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient-filter.ts",
                   "@/lib/validations/ingredient-paste.ts",
                   "@/lib/validations/ingredient.ts",
                 ]

relatedFiles:    ["@/lib/validations/ingredient.ts",
                  "@/lib/generated/prisma/enums"]

imports:         ["zod", "@/lib/generated/prisma/enums"]

exports:         ["INGREDIENT_TYPE_VALUES",
                  "IngredientTypeFilterValue",
                  "ingredientTypeFilterSchema",
                  "normalizeTypeFilter"]

useBy:           ["@/app/admin/ingredients/page.tsx",
                  "@/app/admin/ingredients/_components/IngredientTypeFilter.tsx"]

userStories:     ["*en tant qu'admin je veux filtrer les ingrédients par type"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { z } from "zod";

import { IngredientType } from "@/lib/generated/prisma/enums";

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

/**
 * Toutes les valeurs de l'enum Prisma `IngredientType`, dans l'ordre
 * de déclaration du schéma. Utilisé par le composant de filtre pour
 * générer les options du <select>.
 */
export const INGREDIENT_TYPE_VALUES = Object.values(
  IngredientType,
) as readonly (typeof IngredientType)[keyof typeof IngredientType][];

/**
 * Valeur acceptée par le filtre :
 * - un code enum (`"LEGUME"`, `"FRUIT"`…),
 * - la sentinelle `"none"` pour cibler les ingrédients `type = null`.
 */
export type IngredientTypeFilterValue =
  | (typeof IngredientType)[keyof typeof IngredientType]
  | "none";

/* ------------------------------------------------------------------ */
/*  Schéma                                                             */
/* ------------------------------------------------------------------ */

const VALID_VALUES = new Set<string>([
  ...INGREDIENT_TYPE_VALUES,
  "none",
]);

/**
 * Valide la valeur brute du paramètre d'URL `?type=`. Tolère
 * `undefined` (pas de filtre). Refuse tout le reste (retourne une
 * issue d'erreur que `normalizeTypeFilter` convertit en `undefined`).
 */
export const ingredientTypeFilterSchema = z
  .string()
  .refine(
    (value): value is IngredientTypeFilterValue => VALID_VALUES.has(value),
    {
      message:
        "Type d'ingrédient inconnu. Attendu : une valeur d'IngredientType ou \"none\".",
    },
  )
  .optional();

/* ------------------------------------------------------------------ */
/*  Normalisation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Convertit une valeur brute (issue de `searchParams`) en valeur typée
 * exploitable par Prisma, sans jamais lever. Toute valeur invalide est
 * silencieusement ignorée → le filtre retombe sur "tous".
 */
export function normalizeTypeFilter(
  raw: unknown,
): IngredientTypeFilterValue | undefined {
  const parsed = ingredientTypeFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}