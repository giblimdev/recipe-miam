/*
path :           app/admin/ingredients/_components/IngredientGroup.tsx
tag :            ["admin", "ingredient", "group", "accordion", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Section accordéon d'un type d'ingrédient dans la
                 liste groupée. Rend un AccordionItem avec un trigger
                 (label + count) et un contenu (liste de
                 IngredientListItem). Aucun état local : l'ouverture
                 est gérée par l'Accordion parent (IngredientManager).
                 Les types vides ne sont pas rendus par le parent.

flow:            Props value (clé Accordion), type (null = non
                 classé), label, count, items, onEdit, onDelete → rend
                 <AccordionItem value> → <AccordionTrigger> (label +
                 Badge count) → <AccordionContent> → <ul> de
                 IngredientListItem.

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
                  "@/app/admin/ingredients/_components/IngredientListItem.tsx",
                  "@/components/ui/accordion.tsx"]

imports:         ["@/app/admin/ingredients/_components/IngredientListItem",
                  "@/app/admin/ingredients/_components/IngredientManager",
                  "@/components/ui/accordion",
                  "@/components/ui/badge"]

exports:         ["IngredientGroup",
                  "IngredientGroupProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux voir les ingrédients groupés par type"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : AccordionItem est un composant client.

import { IngredientListItem } from "@/app/admin/ingredients/_components/IngredientListItem";
import type { IngredientRow } from "@/app/admin/ingredients/_components/IngredientManager";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientGroupProps {
  /** Clé d'accordéon : code enum ou "none". */
  readonly value: string;
  /** Type Prisma (null = non classé) — informatif. */
  readonly type: string | null;
  /** Label affiché dans le trigger. */
  readonly label: string;
  readonly count: number;
  readonly items: readonly IngredientRow[];
  readonly onEdit: (row: IngredientRow) => void;
  readonly onDelete: (row: IngredientRow) => void;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientGroup({
  value,
  label,
  count,
  items,
  onEdit,
  onDelete,
}: IngredientGroupProps) {
  return (
    <AccordionItem value={value} className="rounded-lg border border-border/60 bg-card">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <span className="flex flex-1 items-center gap-2 text-left">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {items.map((row) => (
            <IngredientListItem
              key={row.id}
              ingredient={row}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}