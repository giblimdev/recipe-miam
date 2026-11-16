/*
path :           app/admin/ingredients/_components/IngredientManager.tsx
tag :            ["admin", "ingredient", "crud", "ui", "client", "json", "paste"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur client de la page LISTE des ingrédients.
                 Toolbar : compteur, Voir le JSON, Exporter en JSON,
                 Coller du JSON, Seed exemples, Nouvel ingrédient.
                 Liste : nom, type, slug, allergènes, recettes liées.
                 Dialogs : suppression, aperçu JSON, collage JSON
                 (IngredientPasteDialog). La création/édition se font sur
                 des pages dédiées (/admin/ingredients/new et
                 /admin/ingredients/[id]/edit).

flow:            initialIngredients → useState(deleting, isPending,
                 jsonPreview*, pasteOpen) → boutons toolbar → Dialog
                 suppression / aperçu JSON / collage. Collage → mutation
                 via importIngredientsFromPasteAction (dans le Dialog
                 dédié) puis onSuccess → router.refresh().

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientForm.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/_components/IngredientPasteDialog.tsx",
                   "@/app/admin/ingredients/new/page.tsx",
                   "@/app/admin/ingredients/[id]/edit/page.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                   "@/lib/validations/ingredient-paste.ts",
                 ]

relatedFiles:    ["@/app/admin/ingredients/_actions.ts",
                  "@/app/admin/_actions/json-export.ts",
                  "@/lib/labels.ts"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/ingredients/_actions",
                  "@/app/admin/_actions/json-export",
                  "@/app/admin/ingredients/_components/IngredientPasteDialog",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog",
                  "@/components/ui/textarea"]

exports:         ["IngredientManager",
                  "IngredientManagerProps",
                  "IngredientRow"]

useBy:           ["@/app/admin/ingredients/page.tsx"]

userStories:     ["*en tant qu'admin je veux lister, exporter et supprimer les ingrédients",
                  "*en tant qu'admin je veux voir le JSON des ingrédients",
                  "*en tant qu'admin je veux coller un tableau JSON d'ingrédients et l'importer"]
status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useTransition, interactions, router, clipboard, toasts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Carrot,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  FileJson2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteIngredientAction,
  seedExampleIngredientsAction,
} from "@/app/admin/ingredients/_actions";
import {
  exportAllJsonAction,
  readIngredientsJsonForPreviewAction,
} from "@/app/admin/_actions/json-export";
import { IngredientPasteDialog } from "@/app/admin/ingredients/_components/IngredientPasteDialog";
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
import { Textarea } from "@/components/ui/textarea";

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
  readonly recipeCount: number;
}

export interface IngredientManagerProps {
  readonly initialIngredients: readonly IngredientRow[];
}

/* ------------------------------------------------------------------ */
/*  Helpers purs                                                       */
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
}: IngredientManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [deleting, setDeleting] = useState<IngredientRow | null>(null);

  // Aperçu JSON
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
  const [jsonPreviewContent, setJsonPreviewContent] = useState<string>("");
  const [jsonPreviewExists, setJsonPreviewExists] = useState(false);
  const [jsonPreviewLoading, setJsonPreviewLoading] = useState(false);

  // Dialog collage
  const [pasteOpen, setPasteOpen] = useState(false);

  const empty = initialIngredients.length === 0;

  /* --------------------------- Navigation ------------------------ */

  function goToNew() {
    router.push("/admin/ingredients/new");
  }

  function goToEdit(row: IngredientRow) {
    router.push(`/admin/ingredients/${row.id}/edit`);
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

  /* --------------------------- Seed ------------------------------ */

  function handleSeed() {
    startTransition(async () => {
      const response = await seedExampleIngredientsAction();
      if (response.ok) {
        const { created, skipped } = response.data;
        toast.success(
          `${created} ingrédient${created > 1 ? "s" : ""} créé${created > 1 ? "s" : ""}${
            skipped > 0
              ? ` · ${skipped} déjà existant${skipped > 1 ? "s" : ""}`
              : ""
          }.`,
        );
        router.refresh();
      } else {
        toast.error(response.error);
      }
    });
  }

  /* --------------------------- JSON ------------------------------ */

  function handlePreviewJson() {
    setJsonPreviewOpen(true);
    setJsonPreviewLoading(true);
    startTransition(async () => {
      const response = await readIngredientsJsonForPreviewAction();
      setJsonPreviewLoading(false);
      if (response.ok) {
        setJsonPreviewContent(response.data.json);
        setJsonPreviewExists(response.data.exists);
      } else {
        toast.error(response.error);
        setJsonPreviewOpen(false);
      }
    });
  }

  function handleExportJson() {
    startTransition(async () => {
      const response = await exportAllJsonAction();
      if (response.ok) {
        toast.success(
          `${response.data.ingredients} ingrédient(s) et ${response.data.recipes} recette(s) exportés dans data/.`,
        );
        router.refresh();
      } else {
        toast.error(response.error);
      }
    });
  }

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(jsonPreviewContent);
      toast.success("JSON copié dans le presse-papier.");
    } catch {
      toast.error("Impossible de copier le JSON.");
    }
  }

  /* ------------------------------ Rendu -------------------------- */

  return (
    <section className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {initialIngredients.length} ingrédient
            {initialIngredients.length > 1 ? "s" : ""}
          </Badge>
          {empty && (
            <Badge variant="outline" className="text-muted-foreground">
              base vide
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreviewJson}
            disabled={isPending}
          >
            <Eye className="size-4" aria-hidden />
            Voir le JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            disabled={isPending}
          >
            <Download className="size-4" aria-hidden />
            Exporter en JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPasteOpen(true)}
            disabled={isPending}
          >
            <ClipboardPaste className="size-4" aria-hidden />
            Coller du JSON
          </Button>
          {empty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSeed}
              disabled={isPending}
            >
              <Sparkles className="size-4" aria-hidden />
              Seed 8 exemples
            </Button>
          )}
          <Button type="button" size="sm" onClick={goToNew}>
            <Plus className="size-4" aria-hidden />
            Nouvel ingrédient
          </Button>
        </div>
      </div>

      {/* Liste / vide */}
      {empty ? (
        <EmptyState
          onSeed={handleSeed}
          onCreate={goToNew}
          isPending={isPending}
        />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {initialIngredients.map((row) => (
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
                {row.allergenIds.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {row.allergenIds.length} allergène
                    {row.allergenIds.length > 1 ? "s" : ""}
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
                  onClick={() => goToEdit(row)}
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

      {/* Dialog aperçu JSON */}
      <Dialog open={jsonPreviewOpen} onOpenChange={setJsonPreviewOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson2 className="size-5 text-chart-2" aria-hidden />
              data/ingredients/ingredients.json
            </DialogTitle>
            <DialogDescription>
              {jsonPreviewLoading && <>Chargement…</>}
              {!jsonPreviewLoading && !jsonPreviewExists && (
                <>
                  Le fichier n&apos;existe pas encore. Cliquez sur
                  « Exporter en JSON » pour le créer.
                </>
              )}
              {!jsonPreviewLoading && jsonPreviewExists && (
                <>
                  Aperçu en lecture seule ·{" "}
                  {jsonPreviewContent.length.toLocaleString("fr-FR")}{" "}
                  caractères.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1">
            {jsonPreviewLoading ? (
              <div className="grid h-64 place-items-center rounded-lg border border-border/60 bg-muted/20 text-sm text-muted-foreground">
                Chargement du JSON…
              </div>
            ) : jsonPreviewExists ? (
              <Textarea
                readOnly
                value={jsonPreviewContent}
                spellCheck={false}
                rows={18}
                className="h-[400px] w-full resize-none overflow-y-auto font-mono text-xs"
              />
            ) : (
              <div className="grid h-64 place-items-center rounded-lg border border-dashed border-border/60 bg-muted/20">
                <div className="space-y-2 text-center text-sm text-muted-foreground">
                  <FileJson2
                    className="mx-auto size-8 opacity-50"
                    aria-hidden
                  />
                  <p>Aucun fichier JSON ingrédients.</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setJsonPreviewOpen(false)}
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handleCopyJson}
              disabled={!jsonPreviewExists || jsonPreviewContent.length === 0}
            >
              <Copy className="mr-2 size-4" aria-hidden />
              Copier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog collage JSON */}
      <IngredientPasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onSuccess={() => router.refresh()}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  État vide                                                          */
/* ------------------------------------------------------------------ */

function EmptyState({
  onSeed,
  onCreate,
  isPending,
}: {
  readonly onSeed: () => void;
  readonly onCreate: () => void;
  readonly isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <Carrot
        className="mx-auto mb-3 size-8 text-muted-foreground"
        aria-hidden
      />
      <h2 className="text-base font-semibold text-foreground">
        Aucun ingrédient
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Créez votre premier ingrédient ou partez de 8 exemples courants
        (farine, beurre, œuf…).
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSeed}
          disabled={isPending}
        >
          <Sparkles className="size-4" aria-hidden />
          Seed 8 exemples
        </Button>
        <Button type="button" size="sm" onClick={onCreate} disabled={isPending}>
          <Plus className="size-4" aria-hidden />
          Nouvel ingrédient
        </Button>
      </div>
    </div>
  );
}