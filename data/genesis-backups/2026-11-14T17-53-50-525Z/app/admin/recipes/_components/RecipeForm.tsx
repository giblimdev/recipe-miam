
/*
path:            app/admin/recipes/_components/RecipeForm.tsx
tag:             ["admin", "recipes", "form", "client", "ingredients", "steps"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Formulaire partagé de création et de modification des
                 recettes. Gère les informations générales, les lignes
                 d'ingrédients, les étapes, les catégories et les tags.
                 Délègue les mutations aux Server Actions.

relatedFiles:    ["@/app/admin/recipes/_actions",
                  "@/lib/validations/recipe",
                  "@/lib/labels"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/recipes/_actions",
                  "@/lib/validations/recipe",
                  "@/lib/labels",
                  "@/components/ui/button",
                  "@/components/ui/input",
                  "@/components/ui/label",
                  "@/components/ui/textarea"]

exports:         ["RecipeForm", "RecipeFormProps"]

useBy:           ["@/app/admin/recipes/new/page.tsx",
                  "@/app/admin/recipes/[id]/edit/page.tsx"]
*/

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createRecipeAction,
  updateRecipeAction,
} from "@/app/admin/recipes/_actions";

import {
  recipeFormSchema,
  type RecipeFormInput,
} from "@/lib/validations/recipe";

import {
  DIFFICULTY_LABELS,
  UNIT_LABELS,
} from "@/lib/labels";

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

  function updateField<K extends keyof RecipeFormInput>(
    key: K,
    value: RecipeFormInput[K],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateIngredient(
    index: number,
    patch: Partial<IngredientLine>,
  ) {
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
  }

  function addStep() {
    updateField("steps", [
      ...values.steps,
      { instruction: "", image: null },
    ]);
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

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= values.steps.length) return;

    const next = [...values.steps];
    [next[index], next[target]] = [next[target], next[index]];

    updateField("steps", next);
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

      router.push("/recipes");
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
              Identifiant lisible utilisé dans l'URL de la recette.
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
            <Label htmlFor="image">URL de l'image</Label>
            <Input
              id="image"
              type="url"
              value={values.image ?? ""}
              onChange={(event) =>
                updateField("image", event.target.value || null)
              }
              placeholder="https://..."
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

      {/* Ingrédients */}
      <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ingrédients</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sélectionnez les ingrédients dans votre catalogue.
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
            Aucun ingrédient n'est disponible. Créez d'abord les ingrédients
            dans le catalogue.
          </p>
        ) : (
          <div className="space-y-4">
            {values.ingredients.map((line, index) => (
              <div
                key={`${index}-${line.ingredientId}`}
                className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_2fr_auto]"
              >
                <div className="space-y-2">
                  <Label>Ingrédient *</Label>
                  <select
                    className={inputClassName()}
                    value={line.ingredientId}
                    onChange={(event) =>
                      updateIngredient(index, {
                        ingredientId: event.target.value,
                      })
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
                      updateIngredient(index, {
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
                      updateIngredient(index, {
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
                      updateIngredient(index, {
                        note: event.target.value || null,
                      })
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
                    disabled={values.ingredients.length <= 1}
                    onClick={() =>
                      updateField(
                        "ingredients",
                        values.ingredients.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Étapes */}
      <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Préparation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Décomposez la recette en étapes successives.
            </p>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="mr-2 size-4" aria-hidden />
            Ajouter une étape
          </Button>
        </div>

        <div className="space-y-4">
          {values.steps.map((step, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  Étape {index + 1}
                </h3>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    aria-label="Monter l'étape"
                    onClick={() => moveStep(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === values.steps.length - 1}
                    aria-label="Descendre l'étape"
                    onClick={() => moveStep(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Supprimer l'étape ${index + 1}`}
                    disabled={values.steps.length <= 1}
                    onClick={() =>
                      updateField(
                        "steps",
                        values.steps.filter(
                          (_, stepIndex) => stepIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <Textarea
                value={step.instruction}
                rows={3}
                maxLength={3000}
                onChange={(event) =>
                  updateStep(index, {
                    instruction: event.target.value,
                  })
                }
                placeholder="Décrivez précisément cette étape..."
              />

              <Input
                type="url"
                value={step.image ?? ""}
                onChange={(event) =>
                  updateStep(index, {
                    image: event.target.value || null,
                  })
                }
                placeholder="URL d'une image facultative"
                aria-label={`Image de l'étape ${index + 1}`}
              />
            </div>
          ))}
        </div>
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
          <p className="text-sm text-muted-foreground">
            Aucun tag disponible.
          </p>
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
          onClick={() => router.push("/recipes")}
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
