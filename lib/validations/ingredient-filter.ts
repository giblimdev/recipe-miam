/*
path :           lib/validations/ingredient-filter.ts
tag :            ["validation", "zod", "ingredient", "filter", "url-param", "search"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Schémas Zod des paramètres d'URL de la page
                 /admin/ingredients : ?type= (IngredientType ou
                 "none") et ?q= (recherche libre, 120 car max).
                 Expose aussi INGREDIENT_TYPE_VALUES (ordre enum)
                 utilisé pour trier les groupes. Aucune logique
                 métier : uniquement validation + normalisation.

flow:            Module pur → INGREDIENT_TYPE_VALUES +
                 ingredientTypeFilterSchema + ingredientSearchSchema
                 + normalizeTypeFilter(raw) + normalizeSearchQuery(raw)
                 (safeParse → valeur typée | undefined, jamais throw).

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientCreateDialog.tsx",
                   "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                   "@/app/admin/ingredients/_components/IngredientEditDialog.tsx",
                   "@/app/admin/ingredients/_components/IngredientGroup.tsx",
                   "@/app/admin/ingredients/_components/IngredientJsonImportDialog.tsx",
                   "@/app/admin/ingredients/_components/IngredientListItem.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/_components/IngredientSearchInput.tsx",
                   "@/app/admin/ingredients/_components/IngredientStudio.tsx",
                   "@/app/admin/ingredients/_components/IngredientToolbar.tsx",
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
                  "ingredientSearchSchema",
                  "normalizeTypeFilter",
                  "normalizeSearchQuery"]

useBy:           ["@/app/admin/ingredients/page.tsx",
                  "@/app/admin/ingredients/_components/IngredientTypeFilter.tsx"]

userStories:     ["*en tant qu'admin je veux filtrer les ingrédients par type",
                  "*en tant qu'admin je veux rechercher un ingrédient par nom"]

status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { z } from "zod";

import { IngredientType } from "@/lib/generated/prisma/enums";

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

export const INGREDIENT_TYPE_VALUES = Object.values(
  IngredientType,
) as readonly (typeof IngredientType)[keyof typeof IngredientType][];

export type IngredientTypeFilterValue =
  | (typeof IngredientType)[keyof typeof IngredientType]
  | "none";

/* ------------------------------------------------------------------ */
/*  Filtre type                                                        */
/* ------------------------------------------------------------------ */

const VALID_TYPE_VALUES = new Set<string>([...INGREDIENT_TYPE_VALUES, "none"]);

export const ingredientTypeFilterSchema = z
  .string()
  .refine(
    (value): value is IngredientTypeFilterValue => VALID_TYPE_VALUES.has(value),
    {
      message:
        "Type d'ingrédient inconnu. Attendu : une valeur d'IngredientType ou \"none\".",
    },
  )
  .optional();

export function normalizeTypeFilter(
  raw: unknown,
): IngredientTypeFilterValue | undefined {
  const parsed = ingredientTypeFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/* ------------------------------------------------------------------ */
/*  Recherche                                                          */
/* ------------------------------------------------------------------ */

export const ingredientSearchSchema = z
  .string()
  .trim()
  .max(120, "Recherche trop longue (max 120 caractères).")
  .optional();

export function normalizeSearchQuery(raw: unknown): string | undefined {
  const parsed = ingredientSearchSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const value = parsed.data;
  return value && value.length > 0 ? value : undefined;
}