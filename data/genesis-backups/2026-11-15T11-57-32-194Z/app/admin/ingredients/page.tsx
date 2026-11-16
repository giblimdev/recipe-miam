/*
path :           app/admin/ingredients/page.tsx
tag :            ["admin", "ingredient", "crud", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page d'entrée du CRUD des ingrédients. Server Component
                 async qui charge les ingrédients triés par displayOrder
                 avec leurs allergènes (codes INCO), la nutrition et le
                 nombre de recettes. Toute l'interactivité (formulaire
                 multi-items + JSON bidirectionnel + suppression) est
                 déléguée à IngredientManager. La page ne fait plus que
                 du rendu de données : plus de route /new, plus de route
                 /[id]/edit, plus de Dialog collage séparé.
                 ⚠️ Aucune protection d'accès tant qu'aucune auth n'est
                 en place.

flow:            Server Component async → prisma.ingredient.findMany(
                   orderBy displayOrder, name, include allergens.allergen
                   + _count.recipes) → map vers IngredientRow (avec
                 allergenCodes en plus des allergenIds) → breadcrumb +
                 header + Alert auth + IngredientManager.

                 `instant = false` : route dynamique (lecture DB à la
                 requête), équivalent Next.js 16 de force-dynamic.

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                   "@/app/admin/ingredients/_components/IngredientStudio.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                   "@/lib/validations/ingredient-paste.ts",
                 ]

relatedFiles:    ["@/lib/prisma",
                  "@/app/admin/ingredients/_components/IngredientManager"]

imports:         ["next/link",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/app/admin/ingredients/_components/IngredientManager",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

exports:         ["default AdminIngredientsPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux ajouter et gérer les ingrédients sur une seule page"]
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
  type IngredientRow,
} from "@/app/admin/ingredients/_components/IngredientManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const instant = false;

export default async function AdminIngredientsPage() {
  const ingredients = await prisma.ingredient.findMany({
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
        select: {
          allergenId: true,
          allergen: { select: { code: true } },
        },
      },
      _count: { select: { recipes: true } },
    },
  });

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
    allergenCodes: ingredient.allergens.map((link) => link.allergen.code),
    recipeCount: ingredient._count.recipes,
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
          Référentiel partagé par toutes les recettes. Ajoutez un ou
          plusieurs ingrédients via le formulaire, collez du JSON, ou
          éditez l&apos;existant. Chaque enregistrement met à jour{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            data/ingredients/ingredients.json
          </code>
          .
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

      {/* Studio + liste */}
      <IngredientManager initialIngredients={rows} />
    </div>
  );
}