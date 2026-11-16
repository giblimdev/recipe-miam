/*
path :           app/admin/ingredients/_components/IngredientDraftCard.tsx
tag :            ["admin", "ingredient", "form", "client", "draft", "conflict"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Carte d'un ingrédient dans le brouillon multi-items du
                 Studio. Sections : identité (nom, slug auto, type,
                 image), nutrition repliable (8 champs), allergènes
                 (multi-select). Contrôlée par le parent : aucune
                 mutation, tous les changements remontent via onChange.
                 Affiche un badge d'état (valide / incomplet) et un badge
                 de conflit (nouveau / mise à jour / doublon) calculés
                 par le parent, plus un bouton Retirer.

flow:            Reçoit draft + index + canRemove + status + conflict
                 → rend une carte avec accordion nutrition → callbacks
                 onChange(patch) et onRemove().

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                   "@/app/admin/ingredients/_components/IngredientStudio.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                   "@/lib/validations/ingredient-paste.ts",
                 ]

relatedFiles:    ["@/app/admin/ingredients/_components/IngredientStudio.tsx",
                  "@/lib/labels.ts",
                  "@/lib/validations/ingredient-paste.ts"]

imports:         ["react", "lucide-react",
                  "@/lib/labels",
                  "@/lib/validations/ingredient-paste",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/input",
                  "@/components/ui/label"]

exports:         ["IngredientDraftCard",
                  "IngredientDraftCardProps",
                  "IngredientDraft",
                  "DraftStatus",
                  "DraftConflict",
                  "ExistingIngredientRow",
                  "createEmptyDraft",
                  "draftToJson",
                  "jsonToDraft",
                  "rowToDraft",
                  "getDraftStatus"]

useBy:           ["@/app/admin/ingredients/_components/IngredientStudio.tsx"]

userStories:     ["*en tant qu'admin je veux ajouter plusieurs ingrédients via un formulaire dynamique",
                  "*en tant qu'admin je veux être averti des conflits de slug avant enregistrement"]
status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : composant contrôlé, interactions accordion.

import { useState } from "react";
import {
  Carrot,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  ALLERGEN_LABELS,
  INGREDIENT_TYPE_LABELS,
  type IngredientTypeLabel,
} from "@/lib/labels";
import type { IngredientPasteItem } from "@/lib/validations/ingredient-paste";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientDraft {
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly type: string | null;
  readonly image: string;
  readonly displayOrder: string;
  readonly calories: string;
  readonly protein: string;
  readonly carbohydrates: string;
  readonly sugars: string;
  readonly fat: string;
  readonly saturatedFat: string;
  readonly fiber: string;
  readonly salt: string;
  readonly allergenCodes: readonly string[];
}

export type DraftStatus = "valid" | "incomplete";

/**
 * Statut de conflit calculé par le parent :
 * - "new"       : slug absent de la base → sera créé
 * - "existing"  : slug présent en base → sera mis à jour (écrasé)
 * - "duplicate" : slug dupliqué dans le formulaire → bloquant
 * - "invalid"   : slug vide (draft incomplet) → aucun impact
 */
export type DraftConflict = "new" | "existing" | "duplicate" | "invalid";

export interface IngredientDraftCardProps {
  readonly draft: IngredientDraft;
  readonly index: number;
  readonly canRemove: boolean;
  readonly status: DraftStatus;
  readonly conflict: DraftConflict;
  readonly onChange: (patch: Partial<IngredientDraft>) => void;
  readonly onRemove: () => void;
}

/**
 * Ligne Prisma minimale nécessaire au Studio pour pré-remplir les
 * brouillons via "Charger l'existant". On utilise les CODES allergènes
 * (pas les ids) pour rester aligné sur le format JSON.
 */
export interface ExistingIngredientRow {
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
  readonly allergenCodes: readonly string[];
}

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

const INGREDIENT_TYPES: readonly string[] = [
  "LEGUME",
  "FRUIT",
  "VIANDE",
  "POISSON",
  "FRUITS_DE_MER",
  "OEUF",
  "PRODUITS_LAITIERS",
  "FECULENT",
  "LEGUMINEUSE",
  "FRUITS_A_COQUE_GRAINES",
  "EPICE",
  "HERBE",
  "MATIERE_GRASSE",
  "SUCRE",
  "CONDIMENT",
  "LIQUIDE",
  "AUTRE",
];

const ALLERGEN_CODES: readonly string[] = [
  "GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOYBEANS",
  "MILK",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
];

const NUTRITION_KEYS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protéines", unit: "g" },
  { key: "carbohydrates", label: "Glucides", unit: "g" },
  { key: "sugars", label: "dont sucres", unit: "g" },
  { key: "fat", label: "Lipides", unit: "g" },
  { key: "saturatedFat", label: "dont saturés", unit: "g" },
  { key: "fiber", label: "Fibres", unit: "g" },
  { key: "salt", label: "Sel", unit: "g" },
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers purs                                                       */
/* ------------------------------------------------------------------ */

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createEmptyDraft(): IngredientDraft {
  return {
    key: newKey(),
    slug: "",
    name: "",
    type: null,
    image: "",
    displayOrder: "",
    calories: "",
    protein: "",
    carbohydrates: "",
    sugars: "",
    fat: "",
    saturatedFat: "",
    fiber: "",
    salt: "",
    allergenCodes: [],
  };
}

function numberOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function draftStatus(draft: IngredientDraft): DraftStatus {
  if (draft.slug.trim() === "" || draft.name.trim() === "") {
    return "incomplete";
  }
  return "valid";
}

export function getDraftStatus(draft: IngredientDraft): DraftStatus {
  return draftStatus(draft);
}

/**
 * Convertit un draft en item JSON prêt pour `importIngredientsFromPasteAction`.
 * Ne PAS appeler sur un draft incomplet : filtrer en amont.
 */
export function draftToJson(draft: IngredientDraft): IngredientPasteItem {
  return {
    slug: draft.slug,
    name: draft.name,
    type: (draft.type as IngredientPasteItem["type"]) ?? null,
    image: draft.image.trim() === "" ? null : draft.image,
    displayOrder:
      draft.displayOrder.trim() === ""
        ? undefined
        : Number(draft.displayOrder),
    calories: numberOrNull(draft.calories),
    protein: numberOrNull(draft.protein),
    carbohydrates: numberOrNull(draft.carbohydrates),
    sugars: numberOrNull(draft.sugars),
    fat: numberOrNull(draft.fat),
    saturatedFat: numberOrNull(draft.saturatedFat),
    fiber: numberOrNull(draft.fiber),
    salt: numberOrNull(draft.salt),
    allergens: [...draft.allergenCodes],
  } as IngredientPasteItem;
}

/**
 * Convertit un item JSON brut (collage ou base) en draft éditable.
 * Utilise "slugIngredient" en fallback sur "slug" pour accepter aussi
 * le format Prisma natif.
 */
export function jsonToDraft(item: Record<string, unknown>): IngredientDraft {
  const nutrition =
    item.nutrition && typeof item.nutrition === "object"
      ? (item.nutrition as Record<string, unknown>)
      : {};

  const pick = (key: string): unknown => {
    const fromNutrition = nutrition[key];
    if (fromNutrition !== undefined && fromNutrition !== null) {
      return fromNutrition;
    }
    return item[key];
  };

  const asStr = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  };

  const allergens = Array.isArray(item.allergens)
    ? (item.allergens as string[])
    : [];

  return {
    key: newKey(),
    slug: asStr(item.slug ?? item.slugIngredient),
    name: asStr(item.name),
    type: (item.type as string | null) ?? null,
    image: asStr(item.image),
    displayOrder: asStr(item.displayOrder),
    calories: asStr(pick("calories")),
    protein: asStr(pick("protein")),
    carbohydrates: asStr(pick("carbohydrates")),
    sugars: asStr(pick("sugars")),
    fat: asStr(pick("fat")),
    saturatedFat: asStr(pick("saturatedFat")),
    fiber: asStr(pick("fiber")),
    salt: asStr(pick("salt")),
    allergenCodes: [...allergens],
  };
}

/**
 * Convertit une ligne Prisma (ExistingIngredientRow) en draft éditable.
 * Utilisé par le Studio pour "Charger l'existant" dans le formulaire.
 */
export function rowToDraft(row: ExistingIngredientRow): IngredientDraft {
  const asStr = (value: number | null): string =>
    value === null ? "" : String(value);

  return {
    key: newKey(),
    slug: row.slugIngredient,
    name: row.name,
    type: row.type,
    image: row.image ?? "",
    displayOrder: "",
    calories: asStr(row.calories),
    protein: asStr(row.protein),
    carbohydrates: asStr(row.carbohydrates),
    sugars: asStr(row.sugars),
    fat: asStr(row.fat),
    saturatedFat: asStr(row.saturatedFat),
    fiber: asStr(row.fiber),
    salt: asStr(row.salt),
    allergenCodes: [...row.allergenCodes],
  };
}

/* ------------------------------------------------------------------ */
/*  Badges                                                             */
/* ------------------------------------------------------------------ */

function ConflictBadge({ conflict }: { readonly conflict: DraftConflict }) {
  if (conflict === "invalid") return null;

  if (conflict === "duplicate") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-destructive/40 bg-destructive/10 text-[10px] text-destructive"
      >
        <TriangleAlert className="size-3" aria-hidden />
        slug en double
      </Badge>
    );
  }

  if (conflict === "existing") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
      >
        <Pencil className="size-3" aria-hidden />
        mise à jour
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-chart-4/40 bg-chart-4/10 text-[10px] text-chart-4"
    >
      <Plus className="size-3" aria-hidden />
      nouveau
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientDraftCard({
  draft,
  index,
  canRemove,
  status,
  conflict,
  onChange,
  onRemove,
}: IngredientDraftCardProps) {
  const [nutritionOpen, setNutritionOpen] = useState(false);

  function toggleAllergen(code: string, checked: boolean) {
    onChange({
      allergenCodes: checked
        ? [...draft.allergenCodes, code]
        : draft.allergenCodes.filter((c) => c !== code),
    });
  }

  return (
    <div
      className={`rounded-xl border bg-card p-4 sm:p-5 ${
        conflict === "duplicate"
          ? "border-destructive/50 bg-destructive/[0.02]"
          : "border-border/60"
      }`}
    >
      {/* En-tête */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
          <Carrot className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="truncate text-sm font-semibold text-foreground">
            {draft.name.trim() || `Ingrédient ${index + 1}`}
          </h3>
          {status === "valid" ? (
            <Badge variant="secondary" className="text-[10px]">
              prêt
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <TriangleAlert className="size-3" aria-hidden />
              incomplet
            </Badge>
          )}
          <ConflictBadge conflict={conflict} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Retirer l'ingrédient ${index + 1}`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {/* Identité */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${draft.key}`}>Nom *</Label>
          <Input
            id={`name-${draft.key}`}
            value={draft.name}
            onChange={(event) => {
              const name = event.target.value;
              const shouldAutoSlug =
                draft.slug.trim() === "" ||
                draft.slug === slugify(draft.name);
              onChange({
                name,
                ...(shouldAutoSlug ? { slug: slugify(name) } : {}),
              });
            }}
            placeholder="Farine de blé T55"
            maxLength={120}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`slug-${draft.key}`}>Slug (URL) *</Label>
          <Input
            id={`slug-${draft.key}`}
            value={draft.slug}
            onChange={(event) =>
              onChange({ slug: slugify(event.target.value) })
            }
            placeholder="farine-de-ble-t55"
            maxLength={120}
            autoComplete="off"
            className="font-mono text-xs"
          />
          {conflict === "existing" && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Ce slug existe déjà : l&apos;ingrédient sera écrasé.
            </p>
          )}
          {conflict === "duplicate" && (
            <p className="text-[11px] text-destructive">
              Slug saisi plusieurs fois : corrigez avant d&apos;enregistrer.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`type-${draft.key}`}>Type</Label>
          <select
            id={`type-${draft.key}`}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            value={draft.type ?? ""}
            onChange={(event) =>
              onChange({ type: event.target.value || null })
            }
          >
            <option value="">Non classé</option>
            {INGREDIENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {INGREDIENT_TYPE_LABELS[value as IngredientTypeLabel] ?? value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`image-${draft.key}`}>Image (optionnelle)</Label>
          <Input
            id={`image-${draft.key}`}
            value={draft.image}
            onChange={(event) => onChange({ image: event.target.value })}
            placeholder="farine.jpg"
            maxLength={200}
            autoComplete="off"
            className="font-mono text-xs"
          />
        </div>
      </div>

      {/* Nutrition (repliable) */}
      <div className="mt-3 rounded-lg border border-border/40 bg-muted/10">
        <button
          type="button"
          onClick={() => setNutritionOpen((v) => !v)}
          aria-expanded={nutritionOpen}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
        >
          <span>Nutrition (pour 100 g)</span>
          {nutritionOpen ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )}
        </button>
        {nutritionOpen && (
          <div className="grid gap-3 border-t border-border/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {NUTRITION_KEYS.map(({ key, label, unit }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`${key}-${draft.key}`} className="text-[11px]">
                  {label}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({unit})
                  </span>
                </Label>
                <Input
                  id={`${key}-${draft.key}`}
                  type="number"
                  min={0}
                  step="any"
                  value={draft[key as keyof IngredientDraft] as string}
                  onChange={(event) =>
                    onChange({
                      [key]: event.target.value,
                    } as Partial<IngredientDraft>)
                  }
                  className="h-7 text-xs"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allergènes */}
      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-foreground">Allergènes INCO</p>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGEN_CODES.map((code) => {
            const checked = draft.allergenCodes.includes(code);
            const label =
              ALLERGEN_LABELS[code as keyof typeof ALLERGEN_LABELS] ?? code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleAllergen(code, !checked)}
                aria-pressed={checked}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  checked
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}