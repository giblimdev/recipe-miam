/*
path :           app/admin/ingredients/_components/IngredientManager.tsx
tag :            ["admin", "ingredient", "crud", "ui", "client", "studio", "filter"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur client de la page /admin/ingredients.
                 Une seule zone principale :
                 - <IngredientStudio /> qui gère l'ajout multi-items
                   (formulaire + JSON bidirectionnel + bouton Enregistrer),
                 - <IngredientTypeFilter /> au-dessus de la liste pour
                   filtrer par type via l'URL (?type=),
                 - la liste des ingrédients existants (filtrée), avec
                   édition (charge l'existant dans le Studio) et
                   suppression (Dialog).
                 ⚠️ Le Studio reçoit TOUJOURS tous les ingrédients
                 (initialIngredients) pour la détection de conflits de
                 slug, indépendamment du filtre appliqué à la liste.

flow:            Props initialIngredients + filteredIngredients +
                 currentType + countsByType? + totalCount? → useState
                 (deleting, isPending, studioKey, prefill) → rend
                 <IngredientStudio /> puis <IngredientTypeFilter /> puis
                 la liste filtrée. Éditer → prefill via studioKey.
                 Supprimer → deleteIngredientAction dans Dialog.
                 État vide : distingue "base vide" de "aucun résultat
                 pour ce filtre".

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

relatedFiles:    ["@/app/admin/ingredients/_actions.ts",
                  "@/app/admin/ingredients/_components/IngredientStudio.tsx",
                  "@/app/admin/ingredients/_components/IngredientTypeFilter.tsx",
                  "@/lib/labels.ts"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/ingredients/_actions",
                  "@/app/admin/ingredients/_components/IngredientStudio",
                  "@/app/admin/ingredients/_components/IngredientTypeFilter",
                  "@/app/admin/ingredients/_components/IngredientDraftCard",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog"]

exports:         ["IngredientManager",
                  "IngredientManagerProps",
                  "IngredientRow"]

useBy:           ["@/app/admin/ingredients/page.tsx"]

userStories:     ["*en tant qu'admin je veux ajouter et gérer les ingrédients sur une seule page",
                  "*en tant qu'admin je veux éditer un ingrédient existant en le chargeant dans le formulaire",
                  "*en tant qu'admin je veux filtrer les ingrédients par type"]
status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useTransition, interactions, router, toasts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Carrot,
  FilterX,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { deleteIngredientAction } from "@/app/admin/ingredients/_actions";
import { IngredientStudio } from "@/app/admin/ingredients/_components/IngredientStudio";
import { IngredientTypeFilter } from "@/app/admin/ingredients/_components/IngredientTypeFilter";
import type {
  ExistingIngredientRow,
  IngredientDraft,
} from "@/app/admin/ingredients/_components/IngredientDraftCard";
import { rowToDraft } from "@/app/admin/ingredients/_components/IngredientDraftCard";
import {
  INGREDIENT_TYPE_LABELS,
  type IngredientTypeLabel,
} from "@/lib/labels";
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
}

export interface IngredientManagerProps {
  /**
   * Tous les ingrédients (non filtrés). Sert au Studio pour la
   * détection de conflits de slug et à l'affichage "X sur Y".
   */
  readonly initialIngredients: readonly IngredientRow[];
  /**
   * Ingrédients correspondant au filtre actif (peut être égal à
   * initialIngredients si aucun filtre).
   */
  readonly filteredIngredients: readonly IngredientRow[];
  /**
   * Filtre actif : `null` = tous, `"none"` = non classés, sinon un
   * code d'IngredientType. Reflète le paramètre d'URL ?type=.
   */
  readonly currentType: string | null;
  /** Nombre d'ingrédients par clé (facultatif, pour badges du select). */
  readonly countsByType?: Readonly<Record<string, number>>;
  /** Total d'ingrédients (facultatif, pour l'option "Tous"). */
  readonly totalCount?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function typeLabel(type: string | null): string {
  if (!type) return "Non classé";
  return INGREDIENT_TYPE_LABELS[type as IngredientTypeLabel] ?? type;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientManager({
  initialIngredients,
  filteredIngredients,
  currentType,
  countsByType,
  totalCount,
}: IngredientManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [deleting, setDeleting] = useState<IngredientRow | null>(null);

  // Clé de remontage du Studio : change quand on clique "Éditer" sur une
  // ligne existante → pré-remplit le formulaire avec cette ligne.
  const [studioKey, setStudioKey] = useState(0);
  const [prefill, setPrefill] = useState<IngredientDraft[] | null>(null);

  // ⚠️ Toujours TOUS les ingrédients → détection de conflits correcte.
  const existingRows: ExistingIngredientRow[] = initialIngredients.map(
    (row) => ({
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
    }),
  );

  const filterActive = currentType !== null;
  const isDatabaseEmpty = initialIngredients.length === 0;
  const isFilterEmpty =
    !isDatabaseEmpty && filteredIngredients.length === 0;

  /* --------------------------- Édition --------------------------- */

  function handleEdit(row: IngredientRow) {
    setPrefill([
      rowToDraft({
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
      }),
    ]);
    setStudioKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  /* --------------------------- Reset filtre ---------------------- */

  function handleResetFilter() {
    startTransition(() => {
      router.push("/admin/ingredients");
    });
  }

  /* ------------------------------ Rendu -------------------------- */

  return (
    <section className="space-y-8">
      {/* Studio d'ajout / édition */}
      <IngredientStudio
        key={studioKey}
        existingRows={existingRows}
        initialDrafts={prefill ?? undefined}
        onSaved={() => {
          setPrefill(null);
          router.refresh();
        }}
      />

      {/* Liste des existants */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            Ingrédients existants
          </h2>
          <Badge variant="secondary" className="tabular-nums">
            {filteredIngredients.length} ingrédient
            {filteredIngredients.length > 1 ? "s" : ""}
            {filterActive && (
              <span className="ml-1 font-normal text-muted-foreground">
                sur {initialIngredients.length}
              </span>
            )}
          </Badge>
        </div>

        <IngredientTypeFilter
          currentType={currentType}
          countsByType={countsByType}
          totalCount={totalCount}
        />

        {isDatabaseEmpty ? (
          <EmptyList />
        ) : isFilterEmpty ? (
          <EmptyFilterState onReset={handleResetFilter} isPending={isPending} />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {filteredIngredients.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <Carrot
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="truncate">{row.name}</span>
                    <Badge variant="outline" className="font-normal">
                      {typeLabel(row.type)}
                    </Badge>
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    /ingredients/{row.slugIngredient}
                  </p>
                  {row.allergenCodes.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {row.allergenCodes.length} allergène
                      {row.allergenCodes.length > 1 ? "s" : ""} :{" "}
                      {row.allergenCodes.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <Badge variant="outline" className="tabular-nums">
                    {row.recipeCount} recette
                    {row.recipeCount > 1 ? "s" : ""}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(row)}
                    aria-label={`Éditer ${row.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleting(row)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Supprimer ${row.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
/*  État vide — base vide                                              */
/* ------------------------------------------------------------------ */

function EmptyList() {
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
        Utilisez le formulaire ci-dessus pour ajouter un ou plusieurs
        ingrédients, ou collez directement du JSON.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  État vide — filtre sans résultat                                   */
/* ------------------------------------------------------------------ */

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
        Aucun ingrédient pour ce type
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Aucun ingrédient ne correspond au filtre sélectionné. Essayez un
        autre type ou réinitialisez le filtre.
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
          Réinitialiser le filtre
        </Button>
      </div>
    </div>
  );
}