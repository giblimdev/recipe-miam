/*
path :           app/admin/ingredients/_components/IngredientListItem.tsx
tag :            ["admin", "ingredient", "list-item", "collapsible", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Ligne compacte d'un ingrédient dans la liste, avec
                 panneau de détail expandable (Collapsible). Header :
                 nom cliquable + badge type + compte allergènes +
                 compte recettes + boutons Éditer / Supprimer.
                 Panneau : slug, nutrition (8 valeurs pour 100 g),
                 allergènes (chips), recettes liées (liens cliquables,
                 max 5 + "…et N autres").

flow:            Reçoit ingredient (IngredientRow) + onEdit + onDelete
                 → useState(open) → rend <Collapsible> avec header +
                 CollapsibleContent. Le trigger est un bouton nom
                 (n'entraîne pas les actions Éditer/Supprimer qui ont
                 stopPropagation implicite car boutons distincts).

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

relatedFiles:    ["@/app/admin/ingredients/_components/IngredientManager.tsx",
                  "@/lib/labels.ts",
                  "@/components/ui/badge.tsx",
                  "@/components/ui/button.tsx",
                  "@/components/ui/collapsible.tsx"]

imports:         ["react",
                  "next/link",
                  "lucide-react",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/collapsible"]

exports:         ["IngredientListItem",
                  "IngredientListItemProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientGroup.tsx",
                  "@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux voir le détail d'un ingrédient sans quitter la page",
                  "*en tant qu'admin je veux éditer ou supprimer un ingrédient depuis la liste"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState (Collapsible contrôlé), interactions.

import { useState } from "react";
import Link from "next/link";
import {
  Carrot,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  ALLERGEN_LABELS,
  INGREDIENT_TYPE_LABELS,
  type IngredientTypeLabel,
} from "@/lib/labels";
import type { IngredientRow } from "@/app/admin/ingredients/_components/IngredientManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientListItemProps {
  readonly ingredient: IngredientRow;
  readonly onEdit: (row: IngredientRow) => void;
  readonly onDelete: (row: IngredientRow) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function typeLabel(type: string | null): string {
  if (!type) return "Non classé";
  return INGREDIENT_TYPE_LABELS[type as IngredientTypeLabel] ?? type;
}

function nutritionValue(value: number | null, unit: string): string {
  return value === null ? "—" : `${value} ${unit}`;
}

const NUTRITION_ROWS = [
  { key: "calories" as const, label: "Calories", unit: "kcal" },
  { key: "protein" as const, label: "Protéines", unit: "g" },
  { key: "carbohydrates" as const, label: "Glucides", unit: "g" },
  { key: "sugars" as const, label: "dont sucres", unit: "g" },
  { key: "fat" as const, label: "Lipides", unit: "g" },
  { key: "saturatedFat" as const, label: "dont saturés", unit: "g" },
  { key: "fiber" as const, label: "Fibres", unit: "g" },
  { key: "salt" as const, label: "Sel", unit: "g" },
];

const MAX_RECIPES_SHOWN = 5;

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientListItem({
  ingredient,
  onEdit,
  onDelete,
}: IngredientListItemProps) {
  const [open, setOpen] = useState(false);

  const allergenCount = ingredient.allergenCodes.length;
  const recipeCount = ingredient.recipeCount;
  const extraRecipes = Math.max(0, ingredient.recipes.length - MAX_RECIPES_SHOWN);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <li className="bg-card">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Carrot
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group inline-flex min-w-0 items-center gap-1.5 rounded-md text-left text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:bg-muted/60 focus-visible:outline-none"
                aria-expanded={open}
              >
                <span className="truncate">{ingredient.name}</span>
                <ChevronDown
                  className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <Badge variant="outline" className="shrink-0 font-normal">
              {typeLabel(ingredient.type)}
            </Badge>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="tabular-nums">
              {allergenCount} allerg.
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {recipeCount} recette{recipeCount > 1 ? "s" : ""}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(ingredient)}
              aria-label={`Éditer ${ingredient.name}`}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(ingredient)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Supprimer ${ingredient.name}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        {/* Détail */}
        <CollapsibleContent>
          <div className="space-y-4 border-t border-border/60 bg-muted/10 px-4 py-4 text-sm">
            {/* Slug */}
            <code className="block truncate font-mono text-[11px] text-muted-foreground">
              /ingredients/{ingredient.slugIngredient}
            </code>

            {/* Nutrition */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nutrition (pour 100 g)
              </h4>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
                {NUTRITION_ROWS.map(({ key, label, unit }) => (
                  <div key={key} className="flex flex-col">
                    <dt className="text-[11px] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="text-xs font-medium tabular-nums text-foreground">
                      {nutritionValue(ingredient[key], unit)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Allergènes */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Allergènes INCO
              </h4>
              {allergenCount === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  Aucun allergène déclaré.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {ingredient.allergenCodes.map((code) => (
                    <Badge
                      key={code}
                      variant="outline"
                      className="border-destructive/40 bg-destructive/5 text-[10px] text-destructive"
                    >
                      {ALLERGEN_LABELS[code as keyof typeof ALLERGEN_LABELS] ?? code}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Recettes liées */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recettes liées ({recipeCount})
              </h4>
              {recipeCount === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  Aucune recette n&apos;utilise cet ingrédient.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {ingredient.recipes.slice(0, MAX_RECIPES_SHOWN).map((r) => (
                    <Link
                      key={r.slugRecipe}
                      href={`/recipes/${r.slugRecipe}`}
                      className="inline-flex items-center rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {r.title}
                    </Link>
                  ))}
                  {extraRecipes > 0 && (
                    <span className="inline-flex items-center px-1 text-[11px] text-muted-foreground">
                      …et {extraRecipes} autre{extraRecipes > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}