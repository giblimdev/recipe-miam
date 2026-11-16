/*
path :           app/recipes/page.tsx
tag :            ["recipes", "crud", "page", "server-component", "list"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page d'entrée du CRUD des recettes. Server Component async
                 qui charge les recettes triées par displayOrder (avec leurs
                 catégories et tags), plus les listes de catégories et de
                 tags disponibles pour les filtres. Délègue toute
                 l'interactivité (filtres, mode grille/liste, drag & drop
                 pour displayOrder, suppression) à RecipesBoard.
                 ⚠️ Aucune protection d'accès tant qu'aucune auth n'est
                 en place.

flow:            Server Component async → await connection() (frontière
                 runtime explicite, requise par cacheComponents : la page
                 lit des données à la requête et n'est pas pré-rendue
                 statiquement) → Promise.all([recipe.findMany,
                 category.findMany, tag.findMany]) → map vers RecipeRow[] →
                 rend breadcrumb + header + avertissement auth +
                 RecipesBoard(initialRecipes, categories, tags).

ecosystem:       Recipes = [
                   "@/app/recipes/_actions.ts",
                   "@/app/recipes/_components/RecipesBoard.tsx",
                   "@/app/recipes/page.tsx",
                 ]

relatedFiles:    ["@/lib/prisma",
                  "@/lib/labels",
                  "@/app/recipes/_components/RecipesBoard",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

imports:         ["next/link",
                  "next/server",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/app/recipes/_components/RecipesBoard",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

exports:         ["default RecipesPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux gérer les recettes du catalogue",
                  "*en tant qu'admin je veux réordonner les recettes par glisser-déposer"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ChefHat, ChevronRight, TriangleAlert } from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  RecipesBoard,
  type CategoryOption,
  type RecipeRow,
  type TagOption,
} from "@/app/recipes/_components/RecipesBoard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function RecipesPage() {
  // Frontière runtime explicite — requise par cacheComponents: true.
  await connection();

  const [recipes, categories, tags] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        categories: {
          include: {
            category: {
              select: { id: true, name: true, slugCategory: true },
            },
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, slugTag: true } },
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slugCategory: true },
    }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slugTag: true },
    }),
  ]);

  const rows: RecipeRow[] = recipes.map((recipe) => ({
    id: recipe.id,
    slugRecipe: recipe.slugRecipe,
    displayOrder: recipe.displayOrder,
    title: recipe.title,
    description: recipe.description,
    image: recipe.image,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    categories: recipe.categories.map((link) => ({
      id: link.category.id,
      name: link.category.name,
      slugCategory: link.category.slugCategory,
    })),
    tags: recipe.tags.map((link) => ({
      id: link.tag.id,
      name: link.tag.name,
      slugTag: link.tag.slugTag,
    })),
  }));

  const categoryOptions: CategoryOption[] = categories;
  const tagOptions: TagOption[] = tags;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Accueil
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-medium text-foreground">Recettes</span>
      </nav>

      {/* Header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ChefHat className="size-3.5" aria-hidden />
            Catalogue
          </span>
          <Badge variant="secondary">
            {rows.length} recette{rows.length > 1 ? "s" : ""}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Recettes
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Toutes les recettes du catalogue, triées par ordre d&apos;affichage.
          Filtrez, basculez entre la vue grille et la vue liste, et
          réordonnez par glisser-déposer pour ajuster le{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            displayOrder
          </code>
          .
        </p>
      </header>

      {/* Warning auth */}
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Aucune protection d&apos;accès</AlertTitle>
        <AlertDescription>
          Cette page est <strong>publiquement accessible</strong>. La mise en
          place d&apos;une auth (modèle <code>User</code> + middleware) est
          requise avant déploiement en production.
        </AlertDescription>
      </Alert>

      {/* Board */}
      <RecipesBoard
        initialRecipes={rows}
        categories={categoryOptions}
        tags={tagOptions}
      />
    </div>
  );
}