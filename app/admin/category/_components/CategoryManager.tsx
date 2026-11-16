/*
path :           app/admin/category/_components/CategoryManager.tsx
tag :            ["admin", "category", "crud", "ui", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur client du CRUD des catégories. Reçoit la
                 liste initiale du Server Component et gère :
                 - la création (Dialog + formulaire),
                 - l'édition (Dialog + formulaire pré-rempli),
                 - la suppression (Dialog de confirmation avec compte
                   de recettes liées),
                 - le seed de 8 exemples quand la table est vide.
                 Auto-slugification du nom au changement. Aucune
                 logique métier : tout passe par les Server Actions
                 (_actions.ts).

flow:            Reçoit initialCategories + canSeed → useState (mode,
                 editingId, deletingId, isPending, error) + champs
                 contrôlés (name, slug, image) → bouton Nouvelle
                 ouvre le Dialog create → clic Enregistrer →
                 createCategoryAction | updateCategoryAction →
                 toast + router.refresh. Suppression → confirmation
                 → deleteCategoryAction. Seed → seedExampleCategoriesAction.

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

relatedFiles:    ["@/app/admin/category/_actions.ts",
                  "@/lib/validations/taxonomy"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/category/_actions",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog",
                  "@/components/ui/input",
                  "@/components/ui/label"]

exports:         ["CategoryManager", "CategoryManagerProps", "CategoryRow"]

useBy:           ["@/app/admin/category/page.tsx"]

userStories:     ["*en tant qu'admin je veux gérer les catégories de recettes"]

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
  FolderTree,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  createCategoryAction,
  deleteCategoryAction,
  seedExampleCategoriesAction,
  updateCategoryAction,
} from "@/app/admin/category/_actions";
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

export interface CategoryRow {
  readonly id: string;
  readonly name: string;
  readonly slugCategory: string;
  readonly image: string | null;
  readonly recipeCount: number;
}

export interface CategoryManagerProps {
  readonly initialCategories: readonly CategoryRow[];
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

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [image, setImage] = useState("");

  const empty = initialCategories.length === 0;

  /* --------------------------- Ouverture ------------------------- */

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setName("");
    setSlug("");
    setImage("");
    setFormError(null);
  }

  function openEdit(row: CategoryRow) {
    setMode("edit");
    setEditingId(row.id);
    setName(row.name);
    setSlug(row.slugCategory);
    setImage(row.image ?? "");
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

    const payload = { name, slugCategory: slug, image };

    startTransition(async () => {
      const response =
        mode === "edit" && editingId
          ? await updateCategoryAction(editingId, payload)
          : await createCategoryAction(payload);

      if (response.ok) {
        toast.success(
          mode === "edit" ? "Catégorie mise à jour." : "Catégorie créée.",
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
      const response = await deleteCategoryAction(target.id);
      if (response.ok) {
        toast.success(`Catégorie « ${target.name} » supprimée.`);
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
      const response = await seedExampleCategoriesAction();
      if (response.ok) {
        const { created, skipped } = response.data;
        toast.success(
          `${created} catégorie${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}${
            skipped > 0
              ? ` · ${skipped} déjà existante${skipped > 1 ? "s" : ""}`
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
            {initialCategories.length} catégorie
            {initialCategories.length > 1 ? "s" : ""}
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
              Seed 8 exemples
            </Button>
          )}
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Nouvelle catégorie
          </Button>
        </div>
      </div>

      {/* Liste / état vide */}
      {empty ? (
        <EmptyState onSeed={handleSeed} onCreate={openCreate} isPending={isPending} />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {initialCategories.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FolderTree
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate">{row.name}</span>
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  /categories/{row.slugCategory}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <Badge variant="outline" className="tabular-nums">
                  {row.recipeCount} recette{row.recipeCount > 1 ? "s" : ""}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(row)}
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
              {mode === "edit" ? "Éditer la catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
            <DialogDescription>
              Nom affiché, slug d'URL (kebab-case) et image optionnelle.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nom</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(event) => {
                  const value = event.target.value;
                  setName(value);
                  if (mode === "create") setSlug(slugify(value));
                }}
                placeholder="Dessert"
                required
                maxLength={60}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">Slug (URL)</Label>
              <Input
                id="cat-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="dessert"
                required
                maxLength={80}
                autoComplete="off"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Utilisé dans <code>/categories/&lt;slug&gt;</code>. Format
                kebab-case.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-image">Image (optionnelle)</Label>
              <Input
                id="cat-image"
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="dessert.jpg"
                maxLength={200}
                autoComplete="off"
                className="font-mono text-xs"
              />
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
              Supprimer la catégorie ?
            </DialogTitle>
            <DialogDescription>
              {deleting && deleting.recipeCount > 0
                ? `Les ${deleting.recipeCount} recette${deleting.recipeCount > 1 ? "s" : ""} liée${deleting.recipeCount > 1 ? "s" : ""} seront détachée${deleting.recipeCount > 1 ? "s" : ""} (elles ne seront pas supprimées).`
                : "Cette catégorie n'est liée à aucune recette."}
            </DialogDescription>
          </DialogHeader>

          {deleting && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{deleting.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                /categories/{deleting.slugCategory}
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
      <FolderTree
        className="mx-auto mb-3 size-8 text-muted-foreground"
        aria-hidden
      />
      <h2 className="text-base font-semibold text-foreground">
        Aucune catégorie
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Créez votre première catégorie ou partez des 8 standards du
        catalogue (Entrée, Plat principal, Dessert…).
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
        <Button
          type="button"
          size="sm"
          onClick={onCreate}
          disabled={isPending}
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle catégorie
        </Button>
      </div>
    </div>
  );
}