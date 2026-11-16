/*
path :           app/recipes/_components/RecipesBoard.tsx
tag :            ["recipes", "crud", "ui", "client", "dnd", "filters"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur client de la page Recettes. Reçoit la
                 liste initiale, les catégories et les tags du Server
                 Component. Gère :
                 - les filtres (recherche texte, catégorie, tag),
                 - le mode d'affichage (grille / liste),
                 - le réordonnancement par drag & drop HTML5 (mise à jour
                   optimiste + Server Action),
                 - la suppression (Dialog + Server Action),
                 - l'accès aux routes "Nouvelle recette" et "Modifier"
                   (routes futures, commentées).
                 Le DnD est désactivé tant qu'un filtre est actif, pour
                 éviter les ambiguïtés sur l'ordre global. Un fallback
                 clavier (boutons ↑/↓) est disponible sur chaque ligne.

                 ⚠️ Le composant ne se resynchronise PLUS via un
                 useEffect sur initialRecipes (causait un warning React
                 « Calling setState synchronously within an effect »).
                 La réinitialisation est désormais gérée par le parent
                 via la prop `key` (reset de composant), conformément à
                 la recommandation React « you might not need an effect ».

                 ⚠️ categoryFilter / tagFilter sont typés `string | null`
                 car le Select de Base UI appelle onValueChange avec
                 `string | null`. La valeur `"all"` (ou null) signifie
                 « pas de filtre ».

flow:            Reçoit initialRecipes, categories, tags → useState
                 (localRecipes initialisé UNE FOIS depuis initialRecipes,
                 viewMode, search, categoryFilter, tagFilter, deleting,
                 draggedId, dragOverId, isPending) → useMemo filtered
                 (filtre + tri displayOrder) → toolbar (compteur + toggle
                 grille/liste + nouvelle recette) → filtres → rendu
                 conditionnel (empty / no-result / grille / liste) →
                 dragStart/dragOver/drop → reorder optimiste +
                 updateRecipeDisplayOrderAction → router.refresh →
                 suppression via deleteRecipeAction. Le parent remonte le
                 composant via `key` quand initialRecipes change, ce qui
                 réinitialise localRecipes sans useEffect.

ecosystem:       Recipes = [
                   "@/app/recipes/_actions.ts",
                   "@/app/recipes/_components/RecipesBoard.tsx",
                   "@/app/recipes/page.tsx",
                 ]

relatedFiles:    ["@/app/recipes/_actions.ts",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog",
                  "@/components/ui/input",
                  "@/components/ui/label",
                  "@/components/ui/select"]

imports:         ["react",
                  "next/link",
                  "next/image",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/recipes/_actions",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog",
                  "@/components/ui/input",
                  "@/components/ui/label",
                  "@/components/ui/select"]

exports:         ["RecipesBoard",
                  "RecipesBoardProps",
                  "RecipeRow",
                  "CategoryOption",
                  "TagOption"]

useBy:           ["@/app/recipes/page.tsx"]

userStories:     ["*en tant qu'admin je veux gérer les recettes du catalogue",
                  "*en tant qu'admin je veux réordonner les recettes par glisser-déposer"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useMemo, useTransition, DnD, router.refresh, toasts.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChefHat,
  Clock,
  Flame,
  GripVertical,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteRecipeAction,
  updateRecipeDisplayOrderAction,
} from "@/app/recipes/_actions";
import { DIFFICULTY_LABELS } from "@/lib/labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CategoryOption {
  readonly id: string;
  readonly name: string;
  readonly slugCategory: string;
}

export interface TagOption {
  readonly id: string;
  readonly name: string;
  readonly slugTag: string;
}

export interface RecipeRow {
  readonly id: string;
  readonly slugRecipe: string;
  readonly displayOrder: number;
  readonly title: string;
  readonly description: string;
  readonly image: string | null;
  readonly prepTime: number;
  readonly cookTime: number;
  readonly servings: number;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
  readonly categories: readonly {
    readonly id: string;
    readonly name: string;
    readonly slugCategory: string;
  }[];
  readonly tags: readonly {
    readonly id: string;
    readonly name: string;
    readonly slugTag: string;
  }[];
}

export interface RecipesBoardProps {
  readonly initialRecipes: readonly RecipeRow[];
  readonly categories: readonly CategoryOption[];
  readonly tags: readonly TagOption[];
}

type ViewMode = "grid" | "list";

/* ------------------------------------------------------------------ */
/*  Helpers purs                                                       */
/* ------------------------------------------------------------------ */

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

function totalTime(prepTime: number, cookTime: number): string {
  return formatMinutes(prepTime + cookTime);
}

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function RecipesBoard({
  initialRecipes,
  categories,
  tags,
}: RecipesBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ⚠️ Pas de useEffect de resync : le parent remonte ce composant via
  // une `key` dérivée des IDs quand initialRecipes change (cf. page.tsx).
  const [localRecipes, setLocalRecipes] = useState<readonly RecipeRow[]>(
    initialRecipes,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  // `string | null` : signature de onValueChange du Select Base UI.
  // null équivaut à "all" (pas de filtre).
  const [categoryFilter, setCategoryFilter] = useState<string | null>("all");
  const [tagFilter, setTagFilter] = useState<string | null>("all");
  const [deleting, setDeleting] = useState<RecipeRow | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const hasActiveFilters =
    search.trim() !== "" ||
    (categoryFilter !== null && categoryFilter !== "all") ||
    (tagFilter !== null && tagFilter !== "all");

  const dndEnabled = !hasActiveFilters;

  /* ---------------------- Dérivation de la liste ------------------ */

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return localRecipes.filter((recipe) => {
      if (query) {
        const haystack = `${recipe.title} ${recipe.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (
        categoryFilter !== null &&
        categoryFilter !== "all" &&
        !recipe.categories.some((c) => c.id === categoryFilter)
      ) {
        return false;
      }
      if (
        tagFilter !== null &&
        tagFilter !== "all" &&
        !recipe.tags.some((t) => t.id === tagFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [localRecipes, search, categoryFilter, tagFilter]);

  /* ---------------------- Réordonnancement ----------------------- */

  function reorderRecipes(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = localRecipes.findIndex((r) => r.id === fromId);
    const toIndex = localRecipes.findIndex((r) => r.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = moveItem(localRecipes, fromIndex, toIndex).map(
      (recipe, index) => ({ ...recipe, displayOrder: index }),
    );
    setLocalRecipes(next);

    startTransition(async () => {
      const response = await updateRecipeDisplayOrderAction(
        next.map((r) => r.id),
      );
      if (response.ok) {
        toast.success("Ordre mis à jour.");
        router.refresh();
      } else {
        // Rollback visuel
        setLocalRecipes(initialRecipes);
        toast.error(response.error);
      }
    });
  }

  function moveBy(id: string, direction: -1 | 1) {
    const index = localRecipes.findIndex((r) => r.id === id);
    if (index === -1) return;
    const target = index + direction;
    if (target < 0 || target >= localRecipes.length) return;
    reorderRecipes(localRecipes[index].id, localRecipes[target].id);
  }

  /* ---------------------- DnD handlers --------------------------- */

  function handleDragStart(event: React.DragEvent<HTMLElement>, id: string) {
    if (!dndEnabled) {
      event.preventDefault();
      return;
    }
    setDraggedId(id);
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData("text/plain", id);
    } catch {
      // Certains navigateurs lèvent en lecture seule — sans impact.
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>, id: string) {
    if (!dndEnabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  }

  function handleDragLeave(id: string) {
    if (dragOverId === id) setDragOverId(null);
  }

  function handleDrop(event: React.DragEvent<HTMLElement>, id: string) {
    if (!dndEnabled) return;
    event.preventDefault();
    if (draggedId) reorderRecipes(draggedId, id);
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  /* ---------------------- Suppression ---------------------------- */

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const response = await deleteRecipeAction(target.id);
      if (response.ok) {
        toast.success(`Recette « ${target.title} » supprimée.`);
        setDeleting(null);
        router.refresh();
      } else {
        toast.error(response.error);
      }
    });
  }

  /* ---------------------- Reset filtres -------------------------- */

  function resetFilters() {
    setSearch("");
    setCategoryFilter("all");
    setTagFilter("all");
  }

  /* ------------------------------ Rendu -------------------------- */

  return (
    <section className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {filtered.length} / {localRecipes.length} recette
            {localRecipes.length > 1 ? "s" : ""}
          </Badge>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
            >
              <X className="size-3.5" aria-hidden />
              Réinitialiser les filtres
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle view mode */}
          <div
            role="group"
            aria-label="Mode d'affichage"
            className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              aria-label="Vue grille"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-3.5" aria-hidden />
              Grille
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              aria-label="Vue liste"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-3.5" aria-hidden />
              Liste
            </button>
          </div>

          <Button
            nativeButton={false}
            size="sm"
            render={<Link href="/admin/recipes/new" />}
          >
            <Plus className="size-4" aria-hidden />
            Nouvelle recette
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par titre ou description…"
            aria-label="Rechercher une recette"
            className="pl-8"
          />
        </div>

        <Select
          value={categoryFilter ?? "all"}
          onValueChange={setCategoryFilter}
        >
          <SelectTrigger aria-label="Filtrer par catégorie">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tagFilter ?? "all"} onValueChange={setTagFilter}>
          <SelectTrigger aria-label="Filtrer par tag">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bandeau DnD désactivé si filtre actif */}
      {hasActiveFilters && (
        <div
          role="note"
          className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
        >
          <strong className="text-foreground">
            Réordonnancement désactivé.
          </strong>{" "}
          Le drag &amp; drop (et les boutons ↑/↓) n&apos;est disponible que
          sans filtre actif, pour préserver l&apos;ordre global des recettes.
        </div>
      )}

      {/* Contenu */}
      {localRecipes.length === 0 ? (
        <RecipesEmptyState />
      ) : filtered.length === 0 ? (
        <RecipesNoResult onReset={resetFilters} />
      ) : viewMode === "grid" ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <RecipeGridCard
                recipe={recipe}
                order={localRecipes.findIndex((r) => r.id === recipe.id) + 1}
                isDragging={draggedId === recipe.id}
                isDragOver={dragOverId === recipe.id}
                dndEnabled={dndEnabled}
                isPending={isPending}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onMoveUp={() => moveBy(recipe.id, -1)}
                onMoveDown={() => moveBy(recipe.id, 1)}
                onDelete={() => setDeleting(recipe)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <RecipeListRow
                recipe={recipe}
                order={localRecipes.findIndex((r) => r.id === recipe.id) + 1}
                isDragging={draggedId === recipe.id}
                isDragOver={dragOverId === recipe.id}
                dndEnabled={dndEnabled}
                isPending={isPending}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onMoveUp={() => moveBy(recipe.id, -1)}
                onMoveDown={() => moveBy(recipe.id, 1)}
                onDelete={() => setDeleting(recipe)}
              />
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
              <TriangleAlert className="size-5 text-destructive" aria-hidden />
              Supprimer la recette ?
            </DialogTitle>
            <DialogDescription>
              Cette action est <strong>irréversible</strong>. Les ingrédients,
              étapes, catégories et tags liés seront également supprimés.
            </DialogDescription>
          </DialogHeader>

          {deleting && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{deleting.title}</p>
              <p className="font-mono text-xs text-muted-foreground">
                /recipes/{deleting.slugRecipe}
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
/*  Carte grille                                                       */
/* ------------------------------------------------------------------ */

interface RecipeItemProps {
  readonly recipe: RecipeRow;
  readonly order: number;
  readonly isDragging: boolean;
  readonly isDragOver: boolean;
  readonly dndEnabled: boolean;
  readonly isPending: boolean;
  readonly onDragStart: (
    event: React.DragEvent<HTMLElement>,
    id: string,
  ) => void;
  readonly onDragOver: (
    event: React.DragEvent<HTMLElement>,
    id: string,
  ) => void;
  readonly onDragLeave: (id: string) => void;
  readonly onDrop: (event: React.DragEvent<HTMLElement>, id: string) => void;
  readonly onDragEnd: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onDelete: () => void;
}

function RecipeGridCard({
  recipe,
  order,
  isDragging,
  isDragOver,
  dndEnabled,
  isPending,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onDelete,
}: RecipeItemProps) {
  return (
    <article
      draggable={dndEnabled}
      onDragStart={(event) => onDragStart(event, recipe.id)}
      onDragOver={(event) => onDragOver(event, recipe.id)}
      onDragLeave={() => onDragLeave(recipe.id)}
      onDrop={(event) => onDrop(event, recipe.id)}
      onDragEnd={onDragEnd}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all ${
        isDragging
          ? "opacity-40"
          : isDragOver
            ? "border-primary ring-2 ring-primary/40"
            : "border-border/60 hover:shadow-md"
      } ${dndEnabled ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* Image + overlays */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {recipe.image ? (
          <Image
            src={recipe.image}
            alt={recipe.title}
            width={600}
            height={450}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-chart-1/10 via-chart-2/10 to-chart-5/10">
            <ChefHat className="size-10 text-muted-foreground" aria-hidden />
          </div>
        )}

        {/* Ordre */}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
          N° {order}
        </span>

        {/* Grip DnD */}
        {dndEnabled && (
          <span
            aria-hidden
            className="absolute top-2 right-2 grid size-7 place-items-center rounded-md bg-background/90 text-muted-foreground shadow-sm backdrop-blur"
          >
            <GripVertical className="size-4" />
          </span>
        )}

        {/* Difficulté */}
        <Badge
          variant="secondary"
          className="absolute bottom-2 right-2 bg-background/90 backdrop-blur"
        >
          {DIFFICULTY_LABELS[recipe.difficulty]}
        </Badge>
      </div>

      {/* Contenu */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {recipe.title}
        </h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {recipe.description}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {totalTime(recipe.prepTime, recipe.cookTime)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ChefHat className="size-3" aria-hidden />
            {recipe.servings} pers.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-1 border-t border-border/60 pt-2">
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onMoveUp}
              disabled={!dndEnabled || isPending}
              aria-label={`Monter ${recipe.title}`}
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onMoveDown}
              disabled={!dndEnabled || isPending}
              aria-label={`Descendre ${recipe.title}`}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              nativeButton={false}
              variant="ghost"
              size="icon-xs"
              render={<Link href={`/admin/recipes/${recipe.id}/edit`} />}
              aria-label={`Modifier ${recipe.title}`}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onDelete}
              disabled={isPending}
              aria-label={`Supprimer ${recipe.title}`}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Ligne liste                                                        */
/* ------------------------------------------------------------------ */

function RecipeListRow({
  recipe,
  order,
  isDragging,
  isDragOver,
  dndEnabled,
  isPending,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onDelete,
}: RecipeItemProps) {
  return (
    <article
      draggable={dndEnabled}
      onDragStart={(event) => onDragStart(event, recipe.id)}
      onDragOver={(event) => onDragOver(event, recipe.id)}
      onDragLeave={() => onDragLeave(recipe.id)}
      onDrop={(event) => onDrop(event, recipe.id)}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 rounded-xl border bg-card p-3 transition-all ${
        isDragging
          ? "opacity-40"
          : isDragOver
            ? "border-primary ring-2 ring-primary/40"
            : "border-border/60 hover:shadow-sm"
      } ${dndEnabled ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* Grip */}
      {dndEnabled ? (
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center text-muted-foreground"
        >
          <GripVertical className="size-4" />
        </span>
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}

      {/* Ordre */}
      <span className="w-10 shrink-0 text-center font-mono text-xs text-muted-foreground tabular-nums">
        N° {order}
      </span>

      {/* Miniature */}
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {recipe.image ? (
          <Image
            src={recipe.image}
            alt=""
            width={112}
            height={112}
            sizes="56px"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-chart-1/10 via-chart-2/10 to-chart-5/10">
            <ChefHat className="size-5 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {recipe.title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {recipe.description}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {totalTime(recipe.prepTime, recipe.cookTime)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ChefHat className="size-3" aria-hidden />
            {recipe.servings} pers.
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame className="size-3" aria-hidden />
            {DIFFICULTY_LABELS[recipe.difficulty]}
          </span>
        </div>
        {(recipe.categories.length > 0 || recipe.tags.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {recipe.categories.map((category) => (
              <Badge key={`c-${category.id}`} variant="outline">
                {category.name}
              </Badge>
            ))}
            {recipe.tags.map((tag) => (
              <Badge key={`t-${tag.id}`} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onMoveUp}
          disabled={!dndEnabled || isPending}
          aria-label={`Monter ${recipe.title}`}
        >
          <ArrowUp className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onMoveDown}
          disabled={!dndEnabled || isPending}
          aria-label={`Descendre ${recipe.title}`}
        >
          <ArrowDown className="size-3.5" aria-hidden />
        </Button>
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-xs"
          render={<Link href={`/admin/recipes/${recipe.id}/edit`} />}
          aria-label={`Modifier ${recipe.title}`}
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          disabled={isPending}
          aria-label={`Supprimer ${recipe.title}`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  États vides                                                        */
/* ------------------------------------------------------------------ */

function RecipesEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <ChefHat
        className="mx-auto mb-3 size-8 text-muted-foreground"
        aria-hidden
      />
      <h2 className="text-base font-semibold text-foreground">
        Aucune recette
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Le catalogue est vide. Créez votre première recette pour commencer.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin/recipes/new" />}
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle recette
        </Button>
      </div>
    </div>
  );
}

function RecipesNoResult({ onReset }: { readonly onReset: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <Search
        className="mx-auto mb-3 size-8 text-muted-foreground"
        aria-hidden
      />
      <h2 className="text-base font-semibold text-foreground">
        Aucun résultat
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Aucune recette ne correspond à ces filtres. Essayez d&apos;élargir la
        recherche.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          <X className="size-4" aria-hidden />
          Réinitialiser les filtres
        </Button>
      </div>
    </div>
  );
}