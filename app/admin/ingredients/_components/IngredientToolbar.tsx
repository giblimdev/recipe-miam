/*
path :           app/admin/ingredients/_components/IngredientToolbar.tsx
tag :            ["admin", "ingredient", "toolbar", "filter", "search", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Barre d'actions de la page /admin/ingredients :
                 - recherche debouncée (IngredientSearchInput),
                 - filtre par type (IngredientTypeFilter),
                 - bouton "Nouvel ingrédient" → ouvre Dialog create,
                 - bouton "Importer JSON" → ouvre Dialog import JSON.
                 Layout mobile-first : empilé verticalement sur mobile,
                 en ligne dès sm:. Ne porte aucune logique métier :
                 les callbacks sont fournis par le parent
                 (IngredientManager).

flow:            Reçoit currentType + countsByType + totalCount +
                 currentQuery + callbacks onCreateClick /
                 onImportClick → rend une section flex (col mobile,
                 row sm:) composée des 4 sous-éléments.

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

relatedFiles:    ["@/app/admin/ingredients/_components/IngredientSearchInput.tsx",
                  "@/app/admin/ingredients/_components/IngredientTypeFilter.tsx",
                  "@/components/ui/button.tsx"]

imports:         ["lucide-react",
                  "@/app/admin/ingredients/_components/IngredientSearchInput",
                  "@/app/admin/ingredients/_components/IngredientTypeFilter",
                  "@/components/ui/button"]

exports:         ["IngredientToolbar",
                  "IngredientToolbarProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux filtrer et rechercher les ingrédients",
                  "*en tant qu'admin je veux ajouter un ingrédient via un bouton"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : reçoit des callbacks d'ouverture de Dialog,
// utilise des composants client (SearchInput, TypeFilter).

import { FileJson2, Plus } from "lucide-react";

import { IngredientSearchInput } from "@/app/admin/ingredients/_components/IngredientSearchInput";
import { IngredientTypeFilter } from "@/app/admin/ingredients/_components/IngredientTypeFilter";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientToolbarProps {
  readonly currentType: string | null;
  readonly countsByType?: Readonly<Record<string, number>>;
  readonly totalCount?: number;
  readonly currentQuery: string;
  readonly onCreateClick: () => void;
  readonly onImportClick: () => void;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientToolbar({
  currentType,
  countsByType,
  totalCount,
  currentQuery,
  onCreateClick,
  onImportClick,
}: IngredientToolbarProps) {
  return (
    <section
      aria-label="Recherche et actions"
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
    >
      {/* Recherche + filtre (flexible) */}
      <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
        <div className="sm:max-w-sm sm:flex-1">
          <IngredientSearchInput initialValue={currentQuery} />
        </div>
        <div className="sm:shrink-0">
          <IngredientTypeFilter
            currentType={currentType}
            countsByType={countsByType}
            totalCount={totalCount}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onImportClick}
        >
          <FileJson2 className="size-4" aria-hidden />
          Importer JSON
        </Button>
        <Button type="button" size="sm" onClick={onCreateClick}>
          <Plus className="size-4" aria-hidden />
          Nouvel ingrédient
        </Button>
      </div>
    </section>
  );
}