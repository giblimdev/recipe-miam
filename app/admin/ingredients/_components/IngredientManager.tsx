/*
path :           app/admin/ingredients/_components/IngredientManager.tsx
tag :            ["admin", "ingredient", "crud", "ui", "client", "studio", "filter", "accordion"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur client de la page /admin/ingredients
                 (refonte UX). Trois zones :
                 1. <IngredientToolbar /> : recherche debouncée (?q=),
                    filtre par type (?type=), boutons Nouveau + JSON.
                 2. Liste : ACCORDÉON groupé par type quand aucun
                    filtre/recherche ; liste plate quand filtre actif.
                 3. 4 Dialogs contrôlés : create (Studio multi),
                    edit (single item), import JSON, delete.
                 Le Studio n'est PLUS inline : il vit dans le Dialog
                 create. L'édition passe par IngredientEditDialog
                 (IngredientDraftCard direct). Le Studio reçoit
                 TOUS les existingRows (détection de conflits).

flow:            Props initialIngredients + filteredIngredients +
                 currentType + currentQuery + countsByType +
                 totalCount → useState (deleting, editing, createOpen,
                 importOpen) → useMemo groupedByType (si pas de filtre)
                 → rend Toolbar → zone list (accordion OU flat OU
                 empty state) → dialogs.

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

relatedFiles:    ["@/app/admin/ingredients/_actions.ts",
                  "@/app/admin/ingredients/_components/IngredientToolbar.tsx",
                  "@/app/admin/ingredients/_components/IngredientGroup.tsx",
                  "@/app/admin/ingredients/_components/IngredientListItem.tsx",
                  "@/app/admin/ingredients/_components/IngredientCreateDialog.tsx",
                  "@/app/admin/ingredients/_components/IngredientEditDialog.tsx",
                  "@/app/admin/ingredients/_components/IngredientJsonImportDialog.tsx",
                  "@/lib/validations/ingredient-filter.ts"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/ingredients/_actions",
                  "@/app/admin/ingredients/_components/IngredientToolbar",
                  "@/app/admin/ingredients/_components/IngredientGroup",
                  "@/app/admin/ingredients/_components/IngredientListItem",
                  "@/app/admin/ingredients/_components/IngredientCreateDialog",
                  "@/app/admin/ingredients/_components/IngredientEditDialog",
                  "@/app/admin/ingredients/_components/IngredientJsonImportDialog",
                  "@/app/admin/ingredients/_components/IngredientDraftCard",
                  "@/lib/validations/ingredient-filter",
                  "@/lib/labels",
                  "@/components/ui/accordion",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog"]

exports:         ["IngredientManager",
                  "IngredientManagerProps",
                  "IngredientRow"]

useBy:           ["@/app/admin/ingredients/page.tsx",
                  "@/app/admin/ingredients/_components/IngredientListItem.tsx",
                  "@/app/admin/ingredients/_components/IngredientGroup.tsx"]

userStories:     ["*en tant qu'admin je veux ajouter un ingrédient via un bouton",
                  "*en tant qu'admin je veux éditer un ingrédient dans un Dialog",
                  "*en tant qu'admin je veux filtrer et rechercher les ingrédients",
                  "*en tant qu'admin je veux voir les ingrédients groupés par type"]

status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useMemo, useTransition, interactions.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Carrot,
  FilterX,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { deleteIngredientAction } from "@/app/admin/ingredients/_actions";
import { IngredientToolbar } from "@/app/admin/ingredients/_components/IngredientToolbar";
import { IngredientGroup } from "@/app/admin/ingredients/_components/IngredientGroup";
import { IngredientListItem } from "@/app/admin/ingredients/_components/IngredientListItem";
import { IngredientCreateDialog } from "@/app/admin/ingredients/_components/IngredientCreateDialog";
import { IngredientEditDialog } from "@/app/admin/ingredients/_components/IngredientEditDialog";
import { IngredientJsonImportDialog } from "@/app/admin/ingredients/_components/IngredientJsonImportDialog";
import type { ExistingIngredientRow } from "@/app/admin/ingredients/_components/IngredientDraftCard";
import {
  INGREDIENT_TYPE_VALUES,
} from "@/lib/validations/ingredient-filter";
import {
  INGREDIENT_TYPE_LABELS,
  type IngredientTypeLabel,
} from "@/lib/labels";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientRow {
  readonly id: string;
  readonly name: string;
  readonly slugIngredient: string;
  readonly type: string | null;
  readonly image: string | null;
  readonly calories: number | null;
  readonly protein: number | null;
  readonly carbohydrates: number | null;
  readonly sugars: number | null;
  readonly fat: number | null;
  readonly saturatedFat: number | null;
  readonly fiber: number | null;
  readonly salt: number | null;
  readonly allergenIds: readonly string[];
  readonly allergenCodes: readonly string[];
  readonly recipeCount: number;
  /** Recettes liées (titre + slug) — pour le panneau détail. */
  readonly recipes: readonly {
    readonly slugRecipe: string;
    readonly title: string;
  }[];
}

export interface IngredientManagerProps {
  /** Tous les ingrédients (non filtrés) — Studio + comptage. */
  readonly initialIngredients: readonly IngredientRow[];
  /** Ingrédients correspondant au filtre et à la recherche. */
  readonly filteredIngredients: readonly IngredientRow[];
  /** Filtre type actif : null = tous, "none" = non classés, sinon enum. */
  readonly currentType: string | null;
  /** Recherche active (?q=) — chaîne vide si aucune. */
  readonly currentQuery: string;
  readonly countsByType?: Readonly<Record<string, number>>;
  readonly totalCount?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function groupByType(rows: readonly IngredientRow[]) {
  const map = new Map<string, IngredientRow[]>();
  for (const row of rows) {
    const key = row.type ?? "none";
    const arr = map.get(key);
    if (arr) arr.push(row);
    else map.set(key, [row]);
  }

  const ordered: {
    value: string;
    type: string | null;
    label: string;
    items: IngredientRow[];
  }[] = [];

  for (const typeValue of INGREDIENT_TYPE_VALUES) {
    const items = map.get(typeValue);
    if (items && items.length > 0) {
      ordered.push({
        value: typeValue,
        type: typeValue,
        label:
          INGREDIENT_TYPE_LABELS[typeValue as IngredientTypeLabel] ??
          typeValue,
        items,
      });
    }
  }

  const none = map.get("none");
  if (none && none.length > 0) {
    ordered.push({
      value: "none",
      type: null,
      label: "Non classé",
      items: none,
    });
  }

  return ordered;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientManager({
  initialIngredients,
  filteredIngredients,
  currentType,
  currentQuery,
  countsByType,
  totalCount,
}: IngredientManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [deleting, setDeleting] = useState<IngredientRow | null>(null);
  const [editing, setEditing] = useState<IngredientRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // ⚠️ Toujours TOUS les ingrédients → détection de conflits Studio.
  const existingRows: ExistingIngredientRow[] = useMemo(
    () =>
      initialIngredients.map((row) => ({
        id: row.id,
        name: row.name,
        slugIngredient: row.slugIngredient,
        type: row.type,
        image: row.image,
        calories: row.calories,
        protein: row.protein,
        carbohydrates: row.carbohydrates,
        sugars: row.sugars,
        fat: row.fat,
        saturatedFat: row.saturatedFat,
        fiber: row.fiber,
        salt: row.salt,
        allergenCodes: row.allergenCodes,
      })),
    [initialIngredients],
  );

  const editingAsExisting: ExistingIngredientRow | null = useMemo(
    () =>
      editing
        ? {
            id: editing.id,
            name: editing.name,
            slugIngredient: editing.slugIngredient,
            type: editing.type,
            image: editing.image,
            calories: editing.calories,
            protein: editing.protein,
            carbohydrates: editing.carbohydrates,
            sugars: editing.sugars,
            fat: editing.fat,
            saturatedFat: editing.saturatedFat,
            fiber: editing.fiber,
            salt: editing.salt,
            allergenCodes: editing.allergenCodes,
          }
        : null,
    [editing],
  );

  const hasActiveFilter =
    currentType !== null || currentQuery.trim() !== "";

  const groups = useMemo(
    () => (hasActiveFilter ? [] : groupByType(filteredIngredients)),
    [filteredIngredients, hasActiveFilter],
  );

  const isDatabaseEmpty = initialIngredients.length === 0;
  const isFilterEmpty =
    !isDatabaseEmpty && filteredIngredients.length === 0;

  /* --------------------------- Suppression ----------------------- */

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const response = await deleteIngredientAction(target.id);
      if (response.ok) {
        toast.success(`Ingrédient « ${target.name} » supprimé.`);
        setDeleting(null);
        router.refresh();
      } else {
        toast.error(response.error);
      }
    });
  }

  /* --------------------------- Reset filtres --------------------- */

  function handleResetFilters() {
    startTransition(() => {
      router.push("/admin/ingredients");
    });
  }

  /* ------------------------------ Rendu -------------------------- */

  return (
    <section className="space-y-4">
      <IngredientToolbar
        currentType={currentType}
        countsByType={countsByType}
        totalCount={totalCount}
        currentQuery={currentQuery}
        onCreateClick={() => setCreateOpen(true)}
        onImportClick={() => setImportOpen(true)}
      />

      {/* Bandeau compteur */}
      {!isDatabaseEmpty && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {filteredIngredients.length} ingrédient
              {filteredIngredients.length > 1 ? "s" : ""}
            </Badge>
            {hasActiveFilter && (
              <span>
                sur {initialIngredients.length} au total
              </span>
            )}
          </span>
        </div>
      )}

      {/* Contenu */}
      {isDatabaseEmpty ? (
        <EmptyList
          onCreate={() => setCreateOpen(true)}
          onImport={() => setImportOpen(true)}
        />
      ) : isFilterEmpty ? (
        <EmptyFilterState
          onReset={handleResetFilters}
          isPending={isPending}
        />
      ) : hasActiveFilter ? (
        // Filtre actif → liste plate
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {filteredIngredients.map((row) => (
            <IngredientListItem
              key={row.id}
              ingredient={row}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
        </ul>
      ) : (
        // Aucun filtre → accordéon groupé par type (tout fermé par défaut)
        <Accordion type="multiple" defaultValue={[]} className="space-y-2">
          {groups.map((group) => (
            <IngredientGroup
              key={group.value}
              value={group.value}
              type={group.type}
              label={group.label}
              count={group.items.length}
              items={group.items}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
        </Accordion>
      )}

      {/* Dialogs */}
      <IngredientCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingRows={existingRows}
        onSaved={() => router.refresh()}
      />

      <IngredientEditDialog
        ingredient={editingAsExisting}
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        onSaved={() => router.refresh()}
      />

      <IngredientJsonImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />

      {/* Dialog suppression */}
      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next && !isPending) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert
                className="size-5 text-destructive"
                aria-hidden
              />
              Supprimer l&apos;ingrédient ?
            </DialogTitle>
            <DialogDescription>
              {deleting && deleting.recipeCount > 0
                ? `Cet ingrédient est lié à ${deleting.recipeCount} recette${deleting.recipeCount > 1 ? "s" : ""}. La suppression sera refusée tant qu'il est utilisé.`
                : "Cet ingrédient n'est lié à aucune recette."}
            </DialogDescription>
          </DialogHeader>

          {deleting && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{deleting.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                /ingredients/{deleting.slugIngredient}
              </p>
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || (deleting?.recipeCount ?? 0) > 0}
            >
              {isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  États vides                                                        */
/* ------------------------------------------------------------------ */

function EmptyList({
  onCreate,
  onImport,
}: {
  readonly onCreate: () => void;
  readonly onImport: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <Carrot
        className="mx-auto mb-3 size-8 text-muted-foreground"
        aria-hidden
      />
      <h3 className="text-base font-semibold text-foreground">
        Aucun ingrédient en base
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Créez votre premier ingrédient via le formulaire, ou importez un
        JSON existant.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onImport}>
          Importer JSON
        </Button>
        <Button type="button" size="sm" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          Nouvel ingrédient
        </Button>
      </div>
    </div>
  );
}

function EmptyFilterState({
  onReset,
  isPending,
}: {
  readonly onReset: () => void;
  readonly isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <FilterX
        className="mx-auto mb-3 size-8 text-muted-foreground"
        aria-hidden
      />
      <h3 className="text-base font-semibold text-foreground">
        Aucun ingrédient ne correspond
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Essayez un autre type, une autre recherche, ou réinitialisez tous
        les filtres.
      </p>
      <div className="mt-4 flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isPending}
        >
          <FilterX className="size-4" aria-hidden />
          Réinitialiser les filtres
        </Button>
      </div>
    </div>
  );
}