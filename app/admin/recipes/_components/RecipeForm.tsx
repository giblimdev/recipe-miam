/*
path :           app/admin/recipes/_components/RecipeForm.tsx
tag :            ["admin", "recipes", "form", "client", "ingredients", "steps", "dnd", "image"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Formulaire partagé de création et de modification des
                 recettes. Gère les informations générales, l'image
                 (upload public/recipes via ImageUploadField), les lignes
                 d'ingrédients (réordonnables via @dnd-kit/react), les
                 étapes (réordonnables + image par étape), les catégories
                 et les tags. Délègue les mutations aux Server Actions.
                 Poignée de drag dédiée pour ne pas bloquer les inputs.

flow:            initialValues → useState contrôlé → sections (infos,
                 caractéristiques, ingredients sortable, steps sortable,
                 categories, tags) → safeParse recipeFormSchema →
                 createRecipeAction | updateRecipeAction → toast +
                 redirect /admin/recipes.

ecosystem:       AdminRecipes = [
                   "@/app/admin/recipes/_actions.ts",
                   "@/app/admin/recipes/_components/RecipeForm.tsx",
                   "@/app/admin/recipes/[id]/edit/page.tsx",
                   "@/app/admin/recipes/new/page.tsx",
                   "@/components/form/ImageUploadField.tsx",
                   "@/app/admin/_actions/upload-image.ts",
                 ]

relatedFiles:    ["@/app/admin/recipes/_actions.ts",
                  "@/lib/validations/recipe.ts",
                  "@/lib/labels.ts",
                  "@/components/form/ImageUploadField.tsx",
                  "@/app/admin/recipes/new/page.tsx",
                  "@/app/admin/recipes/[id]/edit/page.tsx"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@dnd-kit/react",
                  "@dnd-kit/react/sortable",
                  "@/app/admin/recipes/_actions",
                  "@/lib/validations/recipe",
                  "@/lib/labels",
                  "@/components/form/ImageUploadField",
                  "@/components/ui/button",
                  "@/components/ui/input",
                  "@/components/ui/label",
                  "@/components/ui/textarea"]

exports:         ["RecipeForm", "RecipeFormProps"]

useBy:           ["@/app/admin/recipes/new/page.tsx",
                  "@/app/admin/recipes/[id]/edit/page.tsx"]

userStories:     ["*en tant qu'admin je veux créer et modifier une recette avec réordonnancement drag-and-drop"]
status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useTransition, interactions, DnD, toasts, router.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GripVertical,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";

import {
  createRecipeAction,
  updateRecipeAction,
} from "@/app/admin/recipes/_actions";
import {
  recipeFormSchema,
  type RecipeFormInput,
} from "@/lib/validations/recipe";
import { DIFFICULTY_LABELS, UNIT_LABELS } from "@/lib/labels";
import { ImageUploadField } from "@/components/form/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RecipeFormProps {
  readonly mode: "create" | "edit";
  readonly recipeId?: string;
  readonly initialValues: RecipeFormInput;
  readonly ingredients: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly categories: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly tags: readonly {
    readonly id: string;
    readonly name: string;
  }[];
}

type IngredientLine = RecipeFormInput["ingredients"][number];
type RecipeStep = RecipeFormInput["steps"][number];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function createDndId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dnd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inputClassName(): string {
  return "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
}

function reorderByIndex<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/* ------------------------------------------------------------------ */
/* Sortable — Ingrédient                                               */
/* ------------------------------------------------------------------ */

interface SortableIngredientRowProps {
  readonly id: string;
  readonly index: number;
  readonly line: IngredientLine;
  readonly ingredients: RecipeFormProps["ingredients"];
  readonly selectedIngredientIds: readonly string[];
  readonly canRemove: boolean;
  readonly onChange: (patch: Partial<IngredientLine>) => void;
  readonly onRemove: () => void;
}

function SortableIngredientRow({
  id,
  index,
  line,
  ingredients,
  selectedIngredientIds,
  canRemove,
  onChange,
  onRemove,
}: SortableIngredientRowProps) {
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const { ref, isDragging } = useSortable({
    id,
    index,
    type: "ingredient",
    accept: "ingredient",
    handle: handleRef,
  });

  return (
    <div
      ref={ref}
      className={`grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-[auto_2fr_1fr_1fr_2fr_auto] ${
        isDragging ? "opacity-60 ring-2 ring-ring/40" : ""
      }`}
    >
      <div className="flex items-start pt-7 sm:pt-7">
        <Button
          ref={handleRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          className="cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Réordonner l'ingrédient ${index + 1}`}
        >
          <GripVertical className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Ingrédient *</Label>
        <select
          className={inputClassName()}
          value={line.ingredientId}
          onChange={(event) =>
            onChange({ ingredientId: event.target.value })
          }
        >
          {ingredients.map((ingredient) => (
            <option
              key={ingredient.id}
              value={ingredient.id}
              disabled={
                selectedIngredientIds.includes(ingredient.id) &&
                ingredient.id !== line.ingredientId
              }
            >
              {ingredient.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Quantité</Label>
        <Input
          type="number"
          min="0"
          step="any"
          value={line.amount ?? ""}
          onChange={(event) =>
            onChange({
              amount:
                event.target.value === ""
                  ? null
                  : Number(event.target.value),
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Unité</Label>
        <select
          className={inputClassName()}
          value={line.unit ?? ""}
          onChange={(event) =>
            onChange({
              unit: event.target.value
                ? (event.target.value as IngredientLine["unit"])
                : null,
            })
          }
        >
          <option value="">Sans unité</option>
          {Object.entries(UNIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Note</Label>
        <Input
          value={line.note ?? ""}
          onChange={(event) =>
            onChange({ note: event.target.value || null })
          }
          placeholder="Ex. finement haché"
        />
      </div>

      <div className="flex items-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Supprimer l'ingrédient ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sortable — Étape                                                    */
/* ------------------------------------------------------------------ */

interface SortableStepRowProps {
  readonly id: string;
  readonly index: number;
  readonly step: RecipeStep;
  readonly canRemove: boolean;
  readonly onChange: (patch: Partial<RecipeStep>) => void;
  readonly onRemove: () => void;
}

function SortableStepRow({
  id,
  index,
  step,
  canRemove,
  onChange,
  onRemove,
}: SortableStepRowProps) {
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const { ref, isDragging } = useSortable({
    id,
    index,
    type: "step",
    accept: "step",
    handle: handleRef,
  });

  return (
    <div
      ref={ref}
      className={`space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4 ${
        isDragging ? "opacity-60 ring-2 ring-ring/40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            ref={handleRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-grab touch-none active:cursor-grabbing"
            aria-label={`Réordonner l'étape ${index + 1}`}
          >
            <GripVertical className="size-4 text-muted-foreground" aria-hidden />
          </Button>
          <h3 className="text-sm font-semibold">Étape {index + 1}</h3>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Supprimer l'étape ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <Textarea
        value={step.instruction}
        rows={3}
        maxLength={3000}
        onChange={(event) =>
          onChange({ instruction: event.target.value })
        }
        placeholder="Décrivez précisément cette étape..."
      />

      <ImageUploadField
        label={`Image de l'étape ${index + 1}`}
        folder="recipes"
        value={step.image}
        onChange={(image) => onChange({ image })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function RecipeForm({
  mode,
  recipeId,
  initialValues,
  ingredients,
  categories,
  tags,
}: RecipeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<RecipeFormInput>(initialValues);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [ingredientDndIds, setIngredientDndIds] = useState<string[]>(() =>
    initialValues.ingredients.map(() => createDndId()),
  );
  const [stepDndIds, setStepDndIds] = useState<string[]>(() =>
    initialValues.steps.map(() => createDndId()),
  );

  function updateField<K extends keyof RecipeFormInput>(
    key: K,
    value: RecipeFormInput[K],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateIngredient(index: number, patch: Partial<IngredientLine>) {
    setValues((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function updateStep(index: number, patch: Partial<RecipeStep>) {
    setValues((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    }));
  }

  function addIngredient() {
    const available = ingredients.find(
      (ingredient) =>
        !values.ingredients.some(
          (line) => line.ingredientId === ingredient.id,
        ),
    );

    if (!available) {
      toast.error("Aucun autre ingrédient disponible.");
      return;
    }

    updateField("ingredients", [
      ...values.ingredients,
      {
        ingredientId: available.id,
        amount: null,
        unit: null,
        note: null,
      },
    ]);
    setIngredientDndIds((ids) => [...ids, createDndId()]);
  }

  function removeIngredient(index: number) {
    updateField(
      "ingredients",
      values.ingredients.filter((_, itemIndex) => itemIndex !== index),
    );
    setIngredientDndIds((ids) => ids.filter((_, i) => i !== index));
  }

  function addStep() {
    updateField("steps", [
      ...values.steps,
      { instruction: "", image: null },
    ]);
    setStepDndIds((ids) => [...ids, createDndId()]);
  }

  function removeStep(index: number) {
    updateField(
      "steps",
      values.steps.filter((_, stepIndex) => stepIndex !== index),
    );
    setStepDndIds((ids) => ids.filter((_, i) => i !== index));
  }

  function toggleId(
    key: "categoryIds" | "tagIds",
    id: string,
    checked: boolean,
  ) {
    const current = values[key];
    updateField(
      key,
      checked
        ? [...current, id]
        : current.filter((item) => item !== id),
    );
  }

  function handleIngredientDragEnd(event: DragEndEvent) {
    if (event.canceled) return;
    const { source } = event.operation;
    if (!isSortable(source)) return;
    const { initialIndex, index } = source;
    if (initialIndex === index) return;

    setValues((current) => ({
      ...current,
      ingredients: reorderByIndex(current.ingredients, initialIndex, index),
    }));
    setIngredientDndIds((ids) => reorderByIndex(ids, initialIndex, index));
  }

  function handleStepDragEnd(event: DragEndEvent) {
    if (event.canceled) return;
    const { source } = event.operation;
    if (!isSortable(source)) return;
    const { initialIndex, index } = source;
    if (initialIndex === index) return;

    setValues((current) => ({
      ...current,
      steps: reorderByIndex(current.steps, initialIndex, index),
    }));
    setStepDndIds((ids) => reorderByIndex(ids, initialIndex, index));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = recipeFormSchema.safeParse(values);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createRecipeAction(parsed.data)
          : await updateRecipeAction(recipeId ?? "", parsed.data);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "create"
          ? "Recette créée avec succès."
          : "Recette modifiée avec succès.",
      );

      router.push("/admin/recipes");
      router.refresh();
    });
  }

  const selectedIngredientIds = values.ingredients.map(
    (item) => item.ingredientId,
  );

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Informations générales */}
      <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Informations générales</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identité et présentation de la recette.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Titre de la recette *</Label>
            <Input
              id="title"
              value={values.title}
              required
              maxLength={120}
              onChange={(event) => {
                const title = event.target.value;
                setValues((current) => ({
                  ...current,
                  title,
                  slugRecipe: slugManuallyEdited
                    ? current.slugRecipe
                    : slugify(title),
                }));
              }}
              placeholder="Ex. Poulet rôti aux herbes"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="slugRecipe">Slug URL *</Label>
            <Input
              id="slugRecipe"
              value={values.slugRecipe}
              required
              onChange={(event) => {
                setSlugManuallyEdited(true);
                updateField("slugRecipe", slugify(event.target.value));
              }}
            />
            <p className="text-xs text-muted-foreground">
              Identifiant lisible utilisé dans l&apos;URL de la recette.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={values.description}
              required
              maxLength={3000}
              rows={4}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Présentez brièvement votre recette..."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <ImageUploadField
              label="Image de la recette"
              folder="recipes"
              value={values.image}
              disabled={isPending}
              onChange={(image) => updateField("image", image)}
            />
          </div>
        </div>
      </section>

      {/* Temps et caractéristiques */}
      <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Caractéristiques</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Durées, portions et informations nutritionnelles.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="prepTime">Préparation (minutes)</Label>
            <Input
              id="prepTime"
              type="number"
              min={0}
              value={values.prepTime}
              onChange={(event) =>
                updateField("prepTime", Number(event.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cookTime">Cuisson (minutes)</Label>
            <Input
              id="cookTime"
              type="number"
              min={0}
              value={values.cookTime}
              onChange={(event) =>
                updateField("cookTime", Number(event.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Nombre de portions</Label>
            <Input
              id="servings"
              type="number"
              min={1}
              value={values.servings}
              onChange={(event) =>
                updateField("servings", Number(event.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulté</Label>
            <select
              id="difficulty"
              className={inputClassName()}
              value={values.difficulty}
              onChange={(event) =>
                updateField(
                  "difficulty",
                  event.target.value as RecipeFormInput["difficulty"],
                )
              }
            >
              {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calories">Calories par portion (kcal)</Label>
            <Input
              id="calories"
              type="number"
              min={0}
              value={values.calories ?? ""}
              onChange={(event) =>
                updateField(
                  "calories",
                  event.target.value === ""
                    ? null
                    : Number(event.target.value),
                )
              }
            />
          </div>
        </div>
      </section>

      {/* Ingrédients — sortable */}
      <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ingrédients</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sélectionnez les ingrédients et réordonnez-les par glisser-déposer.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIngredient}
            disabled={ingredients.length <= values.ingredients.length}
          >
            <Plus className="mr-2 size-4" aria-hidden />
            Ajouter
          </Button>
        </div>

        {ingredients.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Aucun ingrédient n&apos;est disponible. Créez d&apos;abord les
            ingrédients dans le catalogue.
          </p>
        ) : (
          <DragDropProvider onDragEnd={handleIngredientDragEnd}>
            <div className="space-y-4">
              {values.ingredients.map((line, index) => (
                <SortableIngredientRow
                  key={ingredientDndIds[index] ?? `ingredient-${index}`}
                  id={ingredientDndIds[index] ?? `ingredient-${index}`}
                  index={index}
                  line={line}
                  ingredients={ingredients}
                  selectedIngredientIds={selectedIngredientIds}
                  canRemove={values.ingredients.length > 1}
                  onChange={(patch) => updateIngredient(index, patch)}
                  onRemove={() => removeIngredient(index)}
                />
              ))}
            </div>
          </DragDropProvider>
        )}
      </section>

      {/* Étapes — sortable */}
      <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Préparation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Décomposez la recette en étapes. Glissez la poignée pour
              réordonner.
            </p>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="mr-2 size-4" aria-hidden />
            Ajouter une étape
          </Button>
        </div>

        <DragDropProvider onDragEnd={handleStepDragEnd}>
          <div className="space-y-4">
            {values.steps.map((step, index) => (
              <SortableStepRow
                key={stepDndIds[index] ?? `step-${index}`}
                id={stepDndIds[index] ?? `step-${index}`}
                index={index}
                step={step}
                canRemove={values.steps.length > 1}
                onChange={(patch) => updateStep(index, patch)}
                onRemove={() => removeStep(index)}
              />
            ))}
          </div>
        </DragDropProvider>
      </section>

      {/* Catégories */}
      <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Catégories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Classement principal et structurel de la recette.
          </p>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune catégorie disponible.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 text-sm hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={values.categoryIds.includes(category.id)}
                  onChange={(event) =>
                    toggleId("categoryIds", category.id, event.target.checked)
                  }
                  className="size-4 accent-primary"
                />
                {category.name}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Tags */}
      <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Tags</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Attributs transversaux : végétarien, rapide, sans gluten...
          </p>
        </div>

        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun tag disponible.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 text-sm hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={values.tagIds.includes(tag.id)}
                  onChange={(event) =>
                    toggleId("tagIds", tag.id, event.target.checked)
                  }
                  className="size-4 accent-primary"
                />
                {tag.name}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/recipes")}
          disabled={isPending}
        >
          <ArrowLeft className="mr-2 size-4" aria-hidden />
          Annuler
        </Button>

        <Button type="submit" disabled={isPending || ingredients.length === 0}>
          {isPending ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="mr-2 size-4" aria-hidden />
          )}
          {isPending
            ? "Enregistrement..."
            : mode === "create"
              ? "Créer la recette"
              : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}