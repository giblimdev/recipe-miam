/*
path :           app/admin/ingredients/page.tsx
tag :            ["admin", "ingredient", "page", "server-component", "filter", "search-params"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page d'entrée du CRUD des ingrédients. Server Component
                 async qui :
                 - lit le paramètre d'URL ?type= et le valide via
                   normalizeTypeFilter (valeur invalide → ignorée),
                 - charge TOUS les ingrédients (pour le Studio, la
                   détection de conflits et le compteur "X sur Y"),
                 - charge les ingrédients FILTRÉS par type (pour la
                   liste affichée),
                 - calcule le nombre d'ingrédients par type via
                   groupBy (badges du <select>),
                 - délègue toute l'interactivité à IngredientManager
                   (Studio + filtre + liste + suppression).

flow:            Server Component async → await searchParams →
                 normalizeTypeFilter(sp.type) → Promise.all([
                   findMany(all), findMany(filtered),
                   groupBy(type)
                 ]) → mappe en IngredientRow[] → rend breadcrumb +
                 header + Alert auth + IngredientManager.

                 `instant = false` : signale à Next.js 16 (avec
                 cacheComponents activé) que cette route lit des
                 données à la requête et n'est pas pré-rendue
                 statiquement. Remplace `dynamic = "force-dynamic"`.

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

relatedFiles:    ["@/app/admin/ingredients/_components/IngredientManager.tsx",
                  "@/lib/validations/ingredient-filter.ts",
                  "@/lib/prisma"]

imports:         ["next/link",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/lib/generated/prisma/enums",
                  "@/lib/validations/ingredient-filter",
                  "@/app/admin/ingredients/_components/IngredientManager",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

exports:         ["default AdminIngredientsPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux gérer les ingrédients sur une seule page",
                  "*en tant qu'admin je veux filtrer les ingrédients par type"]

status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import {
  ArrowLeft,
  Carrot,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  IngredientManager,
  type IngredientRow,
} from "@/app/admin/ingredients/_components/IngredientManager";
import { normalizeTypeFilter } from "@/lib/validations/ingredient-filter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const instant = false;

/* ------------------------------------------------------------------ */
/*  Sélecteur Prisma réutilisable                                      */
/* ------------------------------------------------------------------ */

const ingredientInclude = {
  allergens: {
    include: {
      allergen: { select: { id: true, code: true } },
    },
  },
  _count: { select: { recipes: true } },
} as const;

type IngredientWithRelations = Awaited<
  ReturnType<
    typeof prisma.ingredient.findMany<{ include: typeof ingredientInclude }>
  >
>[number];

function toRow(ingredient: IngredientWithRelations): IngredientRow {
  return {
    id: ingredient.id,
    name: ingredient.name,
    slugIngredient: ingredient.slugIngredient,
    type: ingredient.type,
    image: ingredient.image,
    calories: ingredient.calories,
    protein: ingredient.protein,
    carbohydrates: ingredient.carbohydrates,
    sugars: ingredient.sugars,
    fat: ingredient.fat,
    saturatedFat: ingredient.saturatedFat,
    fiber: ingredient.fiber,
    salt: ingredient.salt,
    allergenIds: ingredient.allergens.map((a) => a.allergen.id),
    allergenCodes: ingredient.allergens.map((a) => a.allergen.code),
    recipeCount: ingredient._count.recipes,
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function AdminIngredientsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly type?: string }>;
}) {
  const sp = await searchParams;
  const typeFilter = normalizeTypeFilter(sp.type);

  // Clause where : undefined → tous, null → non classés, valeur → enum.
  const whereFiltered =
    typeFilter === "none"
      ? { type: null }
      : typeFilter !== undefined
        ? { type: typeFilter }
        : undefined;

  const [allIngredients, filteredIngredients, grouped] = await Promise.all([
    prisma.ingredient.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: ingredientInclude,
    }),
    prisma.ingredient.findMany({
      where: whereFiltered,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: ingredientInclude,
    }),
    prisma.ingredient.groupBy({
      by: ["type"],
      _count: { _all: true },
    }),
  ]);

  // Agrégation des compteurs par type pour les badges du <select>.
  const countsByType: Record<string, number> = { all: allIngredients.length };
  for (const row of grouped) {
    const key = row.type === null ? "none" : row.type;
    countsByType[key] = row._count._all;
  }

  const allRows = allIngredients.map(toRow);
  const filteredRows = filteredIngredients.map(toRow);

  const typeFilterForClient = typeFilter ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Admin
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-medium text-foreground">Ingrédients</span>
      </nav>

      {/* Header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Carrot className="size-3.5" aria-hidden />
            Catalogue
          </span>
          <Badge variant="secondary">Ingrédients réutilisables</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Ingrédients
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Catalogue central des ingrédients réutilisables par les recettes.
          Chaque ingrédient porte son slug, son type, ses valeurs
          nutritionnelles (pour 100 g) et ses allergènes INCO. Filtrez par
          type pour retrouver rapidement une famille d&apos;ingrédients.
        </p>
      </header>

      {/* Warning auth */}
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Aucune protection d&apos;accès</AlertTitle>
        <AlertDescription>
          Cette page est <strong>publiquement accessible</strong>. La mise
          en place d&apos;une auth (modèle <code>User</code> + middleware)
          est requise avant déploiement en production.
        </AlertDescription>
      </Alert>

      {/* CRUD + filtre */}
      <IngredientManager
        initialIngredients={allRows}
        filteredIngredients={filteredRows}
        currentType={typeFilterForClient}
        countsByType={countsByType}
        totalCount={allIngredients.length}
      />
    </div>
  );
}