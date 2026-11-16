/*
path :           app/admin/ingredients/page.tsx
tag :            ["admin", "ingredient", "crud", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page d'entrée du CRUD des ingrédients du catalogue. Server
                 Component async qui charge les ingrédients triés par
                 displayOrder (puis nom), avec nutrition, allergènes liés
                 et nombre de recettes, ainsi que le référentiel des 14
                 allergènes INCO pour le multi-select du formulaire. Toute
                 l'interactivité est déléguée à IngredientManager.
                 ⚠️ Aucune protection d'accès tant qu'aucune auth n'est
                 en place.

flow:            Server Component async → Promise.all(
                   prisma.ingredient.findMany({ orderBy displayOrder, name,
                     include allergens + _count.recipes }),
                   prisma.allergen.findMany({ orderBy displayOrder })
                 ) → map vers IngredientRow / AllergenOption → breadcrumb
                 + header + Alert auth + IngredientManager.

                 `instant = false` : route dynamique (lecture DB à la
                 requête), équivalent Next.js 16 de force-dynamic.

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                 ]

relatedFiles:    ["@/app/admin/ingredients/_components/IngredientManager.tsx",
                  "@/lib/prisma.ts"]

imports:         ["next/link",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/app/admin/ingredients/_components/IngredientManager",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

exports:         ["default AdminIngredientsPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux gérer le catalogue d'ingrédients"]
status:          planned
pathChecked:     ✘false
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
  type AllergenOption,
  type IngredientRow,
} from "@/app/admin/ingredients/_components/IngredientManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const instant = false;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function AdminIngredientsPage() {
  const [ingredients, allergens] = await Promise.all([
    prisma.ingredient.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slugIngredient: true,
        type: true,
        image: true,
        calories: true,
        protein: true,
        carbohydrates: true,
        sugars: true,
        fat: true,
        saturatedFat: true,
        fiber: true,
        salt: true,
        allergens: {
          select: { allergenId: true },
        },
        _count: { select: { recipes: true } },
      },
    }),
    prisma.allergen.findMany({
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
  ]);

  const rows: IngredientRow[] = ingredients.map((ingredient) => ({
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
    allergenIds: ingredient.allergens.map((link) => link.allergenId),
    recipeCount: ingredient._count.recipes,
  }));

  const allergenOptions: AllergenOption[] = allergens.map((allergen) => ({
    id: allergen.id,
    code: allergen.code,
    name: allergen.name,
  }));

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
          Référentiel partagé par toutes les recettes : nom, slug, type,
          valeurs nutritionnelles (pour 100&nbsp;g) et allergènes INCO.
          Un ingrédient utilisé dans une recette ne peut pas être
          supprimé.
        </p>
      </header>

      {/* Warning auth */}
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Aucune protection d&apos;accès</AlertTitle>
        <AlertDescription>
          Cette page est <strong>publiquement accessible</strong>. La
          mise en place d&apos;une auth (modèle <code>User</code> +
          middleware) est requise avant déploiement en production.
        </AlertDescription>
      </Alert>

      {/* CRUD */}
      <IngredientManager
        initialIngredients={rows}
        allergens={allergenOptions}
      />
    </div>
  );
}