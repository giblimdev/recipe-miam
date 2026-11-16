/*
path :           app/admin/ingredients/_components/IngredientTypeFilter.tsx
tag :            ["admin", "ingredient", "filter", "type", "client", "ui"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Select de filtre par type d'ingrédient. Composant
                 purement présentationnel : la seule source de vérité
                 est l'URL (`?type=`). Au change, il pousse une nouvelle
                 route via router.push. Affiche optionnellement le
                 nombre d'ingrédients par type (badge dans l'option).
                 Affiche un spinner discret pendant la transition.
                 Aucune logique métier : la validation du paramètre se
                 fait côté page via normalizeTypeFilter.

flow:            Reçoit currentType (null = tous, "none" = non classé,
                 sinon code enum) + countsByType? + totalCount? → rend
                 un <select> stylé mobile-first → onChange(value) :
                   "" → /admin/ingredients
                   "none" | enum → /admin/ingredients?type=<value>
                 useTransition(isPending) pour désactiver + spinner.

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

relatedFiles:    ["@/lib/labels.ts",
                  "@/lib/generated/prisma/enums",
                  "@/lib/validations/ingredient-filter.ts",
                  "@/components/ui/label.tsx"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "@/lib/generated/prisma/enums",
                  "@/lib/labels",
                  "@/components/ui/label"]

exports:         ["IngredientTypeFilter",
                  "IngredientTypeFilterProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux filtrer les ingrédients par type"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useRouter, useTransition, handler onChange.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Filter, LoaderCircle } from "lucide-react";

import { IngredientType } from "@/lib/generated/prisma/enums";
import {
  INGREDIENT_TYPE_LABELS,
  type IngredientTypeLabel,
} from "@/lib/labels";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientTypeFilterProps {
  /**
   * Type actif : `null` = tous, `"none"` = non classés (type Prisma
   * null), sinon un code d'`IngredientType`.
   */
  readonly currentType: string | null;
  /**
   * Nombre d'ingrédients par clé (`"LEGUME"`, `"FRUIT"`, …,
   * `"none"`, `"all"`). Optionnel : si absent, aucun compteur affiché.
   */
  readonly countsByType?: Readonly<Record<string, number>>;
  /**
   * Nombre total d'ingrédients (toutes catégories confondues). Affiché
   * sur l'option "Tous les types" si fourni.
   */
  readonly totalCount?: number;
}

/* ------------------------------------------------------------------ */
/*  Constantes internes                                                */
/* ------------------------------------------------------------------ */

const TYPE_VALUES = Object.values(IngredientType);

const BASE_PATH = "/admin/ingredients";

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientTypeFilter({
  currentType,
  countsByType,
  totalCount,
}: IngredientTypeFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(value: string) {
    const nextHref = value === "" ? BASE_PATH : `${BASE_PATH}?type=${value}`;
    startTransition(() => {
      router.push(nextHref);
    });
  }

  function countFor(key: string): number | undefined {
    if (!countsByType) return undefined;
    return countsByType[key];
  }

  const allCount = totalCount ?? countFor("all");
  const noneCount = countFor("none");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground" aria-hidden />
        <Label htmlFor="ingredient-type-filter" className="text-sm">
          Filtrer par type
        </Label>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <select
          id="ingredient-type-filter"
          aria-label="Filtrer les ingrédients par type"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-72"
          value={currentType ?? ""}
          onChange={(event) => navigate(event.target.value)}
          disabled={isPending}
        >
          <option value="">
            Tous les types
            {allCount !== undefined ? ` (${allCount})` : ""}
          </option>

          <option value="none">
            Non classé
            {noneCount !== undefined ? ` (${noneCount})` : ""}
          </option>

          {TYPE_VALUES.map((value) => {
            const c = countFor(value);
            const label =
              INGREDIENT_TYPE_LABELS[value as IngredientTypeLabel] ?? value;
            return (
              <option key={value} value={value}>
                {label}
                {c !== undefined ? ` (${c})` : ""}
              </option>
            );
          })}
        </select>

        {isPending && (
          <LoaderCircle
            className="size-4 shrink-0 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}