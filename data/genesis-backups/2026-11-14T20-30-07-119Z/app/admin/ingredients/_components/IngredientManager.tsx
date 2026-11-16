/*
path :           app/admin/ingredients/_components/IngredientManager.tsx
tag :            ["admin", "ingredient", "crud", "ui", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur client du CRUD des ingrédients. Reçoit la
                 liste initiale et le référentiel allergènes du Server
                 Component, puis gère création, édition, suppression et
                 seed d'exemples. Formulaire : identité (nom, slug, type,
                 image), nutrition pour 100 g, multi-select allergènes
                 INCO. Auto-slugification du nom en création. Aucune
                 logique métier : tout passe par les Server Actions.
                 Le state du formulaire utilise IngredientFormValues
                 (z.infer) pour garantir allergenIds non-optionnel.

flow:            initialIngredients + allergens → useState (mode, editing,
                 deleting, form, isPending, error) → Dialog create/edit →
                 createIngredientAction | updateIngredientAction → toast +
                 router.refresh. Suppression → confirmation (bloque si
                 recettes liées côté action). Seed →
                 seedExampleIngredientsAction.

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                 ]

relatedFiles:    ["@/app/admin/ingredients/_actions.ts",
                  "@/lib/validations/ingredient.ts",
                  "@/lib/labels.ts"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/ingredients/_actions",
                  "@/lib/validations/ingredient",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/dialog",
                  "@/components/ui/input",
                  "@/components/ui/label"]

exports:         ["IngredientManager",
                  "IngredientManagerProps",
                  "IngredientRow",
                  "AllergenOption"]

useBy:           ["@/app/admin/ingredients/page.tsx"]

userStories:     ["*en tant qu'admin je veux gérer le catalogue d'ingrédients"]
status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useTransition, interactions, router.refresh, toasts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Carrot,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  createIngredientAction,
  deleteIngredientAction,
  seedExampleIngredientsAction,
  updateIngredientAction,
} from "@/app/admin/ingredients/_actions";
import {
  INGREDIENT_TYPE_VALUES,
  type IngredientFormValues,
} from "@/lib/validations/ingredient";
import {
  ALLERGEN_LABELS,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export interface AllergenOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface IngredientManagerProps {
  readonly initialIngredients: readonly IngredientRow[];
  readonly allergens: readonly AllergenOption[];
}

type Mode = "idle" | "create" | "edit";

type NutritionKey =
  | "calories"
  | "protein"
  | "carbohydrates"
  | "sugars"
  | "fat"
  | "saturatedFat"
  | "fiber"
  | "salt";

const NUTRITION_FIELDS: readonly {
  readonly key: NutritionKey;
  readonly label: string;
  readonly unit: string;
}[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protéines", unit: "g" },
  { key: "carbohydrates", label: "Glucides", unit: "g" },
  { key: "sugars", label: "dont sucres", unit: "g" },
  { key: "fat", label: "Lipides", unit: "g" },
  { key: "saturatedFat", label: "dont saturés", unit: "g" },
  { key: "fiber", label: "Fibres", unit: "g" },
  { key: "salt", label: "Sel", unit: "g" },
];

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

function emptyForm(): IngredientFormValues {
  return {
    name: "",
    slugIngredient: "",
    type: null,
    image: undefined,
    calories: null,
    protein: null,
    carbohydrates: null,
    sugars: null,
    fat: null,
    saturatedFat: null,
    fiber: null,
    salt: null,
    allergenIds: [],
  };
}

function rowToForm(row: IngredientRow): IngredientFormValues {
  return {
    name: row.name,
    slugIngredient: row.slugIngredient,
    type: (row.type as IngredientFormValues["type"]) ?? null,
    image: row.image ?? undefined,
    calories: row.calories,
    protein: row.protein,
    carbohydrates: row.carbohydrates,
    sugars: row.sugars,
    fat: row.fat,
    saturatedFat: row.saturatedFat,
    fiber: row.fiber,
    salt: row.salt,
    allergenIds: [...row.allergenIds],
  };
}

function parseOptionalNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function typeLabel(type: string | null): string {
  if (!type) return "Non classé";
  return INGREDIENT_TYPE_LABELS[type as IngredientTypeLabel] ?? type;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientManager({
  initialIngredients,
  allergens,
}: IngredientManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<IngredientRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientFormValues>(emptyForm);

  const empty = initialIngredients.length === 0;

  /* --------------------------- Ouverture ------------------------- */

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function openEdit(row: IngredientRow) {
    setMode("edit");
    setEditingId(row.id);
    setForm(rowToForm(row));
    setFormError(null);
  }

  function closeForm() {
    if (isPending) return;
    setMode("idle");
    setEditingId(null);
    setFormError(null);
  }

  function patchForm<K extends keyof IngredientFormValues>(
    key: K,
    value: IngredientFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAllergen(id: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      allergenIds: checked
        ? [...current.allergenIds, id]
        : current.allergenIds.filter((item) => item !== id),
    }));
  }

  /* --------------------------- Soumission ------------------------ */

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const payload = {
      ...form,
      image:
        typeof form.image === "string" && form.image.trim() === ""
          ? undefined
          : form.image,
    };

    startTransition(async () => {
      const response =
        mode === "edit" && editingId
          ? await updateIngredientAction(editingId, payload)
          : await createIngredientAction(payload);

      if (response.ok) {
        toast.success(
          mode === "edit"
            ? "Ingrédient mis à jour."
            : "Ingrédient créé.",
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
            Nouvel ingrédient
          </Button>
        </div>
      </div>

      {/* Liste / vide */}
      {empty ? (
        <EmptyState
          onSeed={handleSeed}
          onCreate={openCreate}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit"
                ? "Éditer l'ingrédient"
                : "Nouvel ingrédient"}
            </DialogTitle>
            <DialogDescription>
              Identité, valeurs nutritionnelles (pour 100 g) et
              allergènes INCO.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identité */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ing-name">Nom</Label>
                <Input
                  id="ing-name"
                  value={form.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name: value,
                      slugIngredient:
                        mode === "create"
                          ? slugify(value)
                          : current.slugIngredient,
                    }));
                  }}
                  placeholder="Farine de blé T55"
                  required
                  maxLength={120}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ing-slug">Slug (URL)</Label>
                <Input
                  id="ing-slug"
                  value={form.slugIngredient}
                  onChange={(event) =>
                    patchForm("slugIngredient", event.target.value)
                  }
                  placeholder="farine-de-ble-t55"
                  required
                  maxLength={80}
                  autoComplete="off"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ing-type">Type</Label>
                <select
                  id="ing-type"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                  value={form.type ?? ""}
                  onChange={(event) =>
                    patchForm(
                      "type",
                      event.target.value
                        ? (event.target
                            .value as IngredientFormValues["type"])
                        : null,
                    )
                  }
                >
                  <option value="">Non classé</option>
                  {INGREDIENT_TYPE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {INGREDIENT_TYPE_LABELS[value as IngredientTypeLabel] ??
                        value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ing-image">Image (optionnelle)</Label>
                <Input
                  id="ing-image"
                  value={form.image ?? ""}
                  onChange={(event) =>
                    patchForm("image", event.target.value || undefined)
                  }
                  placeholder="farine.jpg"
                  maxLength={200}
                  autoComplete="off"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Nutrition */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Nutrition (pour 100 g)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {NUTRITION_FIELDS.map(({ key, label, unit }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`ing-${key}`}>
                      {label}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({unit})
                      </span>
                    </Label>
                    <Input
                      id={`ing-${key}`}
                      type="number"
                      min={0}
                      step="any"
                      value={form[key] ?? ""}
                      onChange={(event) =>
                        patchForm(key, parseOptionalNumber(event.target.value))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Allergènes */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Allergènes INCO
              </p>
              {allergens.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun allergène en base. Lancez le seed des 14
                  allergènes INCO.
                </p>
              ) : (
                <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-border/60 p-3 sm:grid-cols-2">
                  {allergens.map((allergen) => (
                    <label
                      key={allergen.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={form.allergenIds.includes(allergen.id)}
                        onChange={(event) =>
                          toggleAllergen(allergen.id, event.target.checked)
                        }
                      />
                      <span>
                        {allergen.name}
                        {ALLERGEN_LABELS[
                          allergen.code as keyof typeof ALLERGEN_LABELS
                        ] &&
                          ALLERGEN_LABELS[
                            allergen.code as keyof typeof ALLERGEN_LABELS
                          ] !== allergen.name && (
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              (
                              {
                                ALLERGEN_LABELS[
                                  allergen.code as keyof typeof ALLERGEN_LABELS
                                ]
                              }
                              )
                            </span>
                          )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
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
        <Button
          type="button"
          size="sm"
          onClick={onCreate}
          disabled={isPending}
        >
          <Plus className="size-4" aria-hidden />
          Nouvel ingrédient
        </Button>
      </div>
    </div>
  );
}