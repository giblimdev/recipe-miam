/*
path :           app/admin/ingredients/_components/IngredientTypeFilter.tsx
tag :            ["admin", "ingredient", "filter", "type", "client", "ui", "url-param"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Select de filtre par type d'ingrédient. Source de
                 vérité : l'URL (?type=). Au change, pousse une
                 nouvelle route via router.push EN PRÉSERVANT les
                 autres paramètres (notamment ?q=). Affiche
                 optionnellement le nombre d'ingrédients par type.
                 Affiche un spinner pendant la transition.

flow:            Reçoit currentType + countsByType? + totalCount? →
                 rend un <select> stylé mobile-first → onChange :
                   construit URLSearchParams depuis useSearchParams
                   → set/delete "type" → router.push(URL).

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

relatedFiles:    ["@/lib/labels.ts",
                  "@/lib/generated/prisma/enums"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "@/lib/generated/prisma/enums",
                  "@/lib/labels"]

exports:         ["IngredientTypeFilter",
                  "IngredientTypeFilterProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientToolbar.tsx"]

userStories:     ["*en tant qu'admin je veux filtrer les ingrédients par type"]

status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useRouter, useSearchParams, useTransition.

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, LoaderCircle } from "lucide-react";

import { IngredientType } from "@/lib/generated/prisma/enums";
import {
  INGREDIENT_TYPE_LABELS,
  type IngredientTypeLabel,
} from "@/lib/labels";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientTypeFilterProps {
  readonly currentType: string | null;
  readonly countsByType?: Readonly<Record<string, number>>;
  readonly totalCount?: number;
}

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
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
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "") params.delete("type");
    else params.set("type", value);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
    });
  }

  function countFor(key: string): number | undefined {
    return countsByType?.[key];
  }

  const allCount = totalCount ?? countFor("all");
  const noneCount = countFor("none");

  return (
    <div className="flex items-center gap-1.5">
      <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <select
        id="ingredient-type-filter"
        aria-label="Filtrer les ingrédients par type"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-56"
        value={currentType ?? ""}
        onChange={(event) => navigate(event.target.value)}
        disabled={isPending}
      >
        <option value="">
          Tous les types{allCount !== undefined ? ` (${allCount})` : ""}
        </option>
        <option value="none">
          Non classé{noneCount !== undefined ? ` (${noneCount})` : ""}
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
  );
}