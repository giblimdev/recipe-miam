/*
path :           app/admin/tag/_components/TagManager.tsx
tag :            ["admin", "tag", "crud", "ui", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur client du CRUD des tags. Reçoit la liste
                 initiale du Server Component et gère :
                 - la création (Dialog + formulaire),
                 - l'édition (Dialog + formulaire pré-rempli),
                 - la suppression (Dialog de confirmation avec compte
                   de recettes liées),
                 - le seed de 12 exemples quand la table est vide.
                 Auto-slugification du nom au changement. Aucune
                 logique métier : tout passe par les Server Actions
                 (_actions.ts).

flow:            Reçoit initialTags → useState (mode, editingId,
                 deletingId, isPending, error) + champs contrôlés
                 (name, slug) → bouton Nouveau ouvre le Dialog create
                 → clic Enregistrer → createTagAction | updateTagAction
                 → toast + router.refresh. Suppression → confirmation
                 → deleteTagAction. Seed → seedExampleTagsAction.

ecosystem:       Admin = [
                   "@/app/admin/allergen/page.tsx",
                   "@/app/admin/category/_actions.ts",
                   "@/app/admin/category/_components/CategoryManager.tsx",
                   "@/app/admin/category/page.tsx",
                   "@/app/admin/page.tsx",
                   "@/app/admin/tag/_actions.ts",
                   "@/app/admin/tag/_components/TagManager.tsx",
                   "@/app/admin/tag/page.tsx",
                 ]

relatedFiles:    ["@/app/admin/tag/_actions.ts",
                  "@/lib/validations/taxonomy"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/tag/_actions",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog",
                  "@/components/ui/input",
                  "@/components/ui/label"]

exports:         ["TagManager", "TagManagerProps", "TagRow"]

useBy:           ["@/app/admin/tag/page.tsx"]

userStories:     ["*en tant qu'admin je veux gérer les tags de recettes"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, interactions, router.refresh, toasts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Plus,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  createTagAction,
  deleteTagAction,
  seedExampleTagsAction,
  updateTagAction,
} from "@/app/admin/tag/_actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TagRow {
  readonly id: string;
  readonly name: string;
  readonly slugTag: string;
  readonly recipeCount: number;
}

export interface TagManagerProps {
  readonly initialTags: readonly TagRow[];
}

type Mode = "idle" | "create" | "edit";

/* ------------------------------------------------------------------ */
/*  Helpers purs                                                       */
/* ------------------------------------------------------------------ */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function TagManager({ initialTags }: TagManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TagRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const empty = initialTags.length === 0;

  /* --------------------------- Ouverture ------------------------- */

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setName("");
    setSlug("");
    setFormError(null);
  }

  function openEdit(row: TagRow) {
    setMode("edit");
    setEditingId(row.id);
    setName(row.name);
    setSlug(row.slugTag);
    setFormError(null);
  }

  function closeForm() {
    if (isPending) return;
    setMode("idle");
    setEditingId(null);
    setFormError(null);
  }

  /* --------------------------- Soumission ------------------------ */

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const payload = { name, slugTag: slug };

    startTransition(async () => {
      const response =
        mode === "edit" && editingId
          ? await updateTagAction(editingId, payload)
          : await createTagAction(payload);

      if (response.ok) {
        toast.success(
          mode === "edit" ? "Tag mis à jour." : "Tag créé.",
        );
        closeForm();
        router.refresh();
      } else {
        setFormError(response.error);
        toast.error(response.error);
      }
    });
  }

  /* --------------------------- Suppression ----------------------- */

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const response = await deleteTagAction(target.id);
      if (response.ok) {
        toast.success(`Tag « ${target.name} » supprimé.`);
        setDeleting(null);
        router.refresh();
      } else {
        toast.error(response.error);
      }
    });
  }

  /* --------------------------- Seed exemples --------------------- */

  function handleSeed() {
    startTransition(async () => {
      const response = await seedExampleTagsAction();
      if (response.ok) {
        const { created, skipped } = response.data;
        toast.success(
          `${created} tag${created > 1 ? "s" : ""} créé${created > 1 ? "s" : ""}${
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

  /* ------------------------------ Rendu -------------------------- */

  return (
    <section className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {initialTags.length} tag{initialTags.length > 1 ? "s" : ""}
          </Badge>
          {empty && (
            <Badge variant="outline" className="text-muted-foreground">
              base vide
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {empty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSeed}
              disabled={isPending}
            >
              <Sparkles className="size-4" aria-hidden />
              Seed 12 exemples
            </Button>
          )}
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Nouveau tag
          </Button>
        </div>
      </div>

      {/* Liste / état vide */}
      {empty ? (
        <EmptyState
          onSeed={handleSeed}
          onCreate={openCreate}
          isPending={isPending}
        />
      ) : (
        <ul className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-card p-4">
          {initialTags.map((row) => (
            <li
              key={row.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 py-1 pr-1 pl-3 text-sm"
            >
              <TagIcon
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
              <span className="font-medium text-foreground">{row.name}</span>
              <span className="text-[11px] text-muted-foreground">
                ({row.recipeCount})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => openEdit(row)}
                aria-label={`Éditer ${row.name}`}
              >
                <Pencil className="size-3" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeleting(row)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Supprimer ${row.name}`}
              >
                <Trash2 className="size-3" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Dialog create / edit */}
      <Dialog
        open={mode !== "idle"}
        onOpenChange={(next) => {
          if (!next) closeForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit" ? "Éditer le tag" : "Nouveau tag"}
            </DialogTitle>
            <DialogDescription>
              Nom affiché et slug d'URL (kebab-case).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">Nom</Label>
              <Input
                id="tag-name"
                value={name}
                onChange={(event) => {
                  const value = event.target.value;
                  setName(value);
                  if (mode === "create") setSlug(slugify(value));
                }}
                placeholder="Végétarien"
                required
                maxLength={60}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tag-slug">Slug (URL)</Label>
              <Input
                id="tag-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="vegetarien"
                required
                maxLength={80}
                autoComplete="off"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Utilisé dans <code>/tags/&lt;slug&gt;</code>. Format
                kebab-case.
              </p>
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                {formError}
              </p>
            )}

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Enregistrement…"
                  : mode === "edit"
                    ? "Enregistrer"
                    : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              Supprimer le tag ?
            </DialogTitle>
            <DialogDescription>
              {deleting && deleting.recipeCount > 0
                ? `Les ${deleting.recipeCount} recette${deleting.recipeCount > 1 ? "s" : ""} liée${deleting.recipeCount > 1 ? "s" : ""} seront détachée${deleting.recipeCount > 1 ? "s" : ""} (elles ne seront pas supprimées).`
                : "Ce tag n'est lié à aucune recette."}
            </DialogDescription>
          </DialogHeader>

          {deleting && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{deleting.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                /tags/{deleting.slugTag}
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
              disabled={isPending}
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
      <TagIcon
        className="mx-auto mb-3 size-8 text-muted-foreground"
        aria-hidden
      />
      <h2 className="text-base font-semibold text-foreground">Aucun tag</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Créez votre premier tag ou partez des 12 standards du catalogue
        (Végétarien, Sans gluten, Rapide…).
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
          Seed 12 exemples
        </Button>
        <Button type="button" size="sm" onClick={onCreate} disabled={isPending}>
          <Plus className="size-4" aria-hidden />
          Nouveau tag
        </Button>
      </div>
    </div>
  );
}