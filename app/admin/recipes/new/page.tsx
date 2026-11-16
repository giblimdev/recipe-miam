
/*
path:            app/admin/recipes/new/page.tsx
tag:             ["admin", "recipes", "create", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page de création d'une recette. Charge les ingrédients,
                 catégories et tags disponibles puis transmet les données
                 au formulaire partagé RecipeForm.

relatedFiles:    ["@/lib/prisma",
                  "@/app/admin/recipes/_components/RecipeForm"]

imports:         ["next/link",
                  "next/server",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/app/admin/recipes/_components/RecipeForm"]

exports:         ["default AdminNewRecipePage"]

useBy:           []
*/

import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowLeft,
  ChefHat,
  ChevronRight,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { RecipeForm } from "@/app/admin/recipes/_components/RecipeForm";

export const instant = false;

export default async function AdminNewRecipePage() {
  await connection();

  const [ingredients, categories, tags] = await Promise.all([
    prisma.ingredient.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),

    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),

    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const initialValues = {
    title: "",
    slugRecipe: "",
    description: "",
    image: null,
    prepTime: 0,
    cookTime: 0,
    servings: 2,
    difficulty: "MEDIUM" as const,
    calories: null,
    ingredients: ingredients.length
      ? [
          {
            ingredientId: ingredients[0].id,
            amount: null,
            unit: null,
            note: null,
          },
        ]
      : [],
    steps: [
      {
        instruction: "",
        image: null,
      },
    ],
    categoryIds: [],
    tagIds: [],
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Fil d'Ariane"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Recettes
        </Link>

        <ChevronRight className="size-3.5" aria-hidden />

        <span className="font-medium text-foreground">
          Nouvelle recette
        </span>
      </nav>

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ChefHat className="size-4" aria-hidden />
          Administration du catalogue
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          Nouvelle recette
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Créez une recette complète en renseignant ses caractéristiques,
          ses ingrédients, ses étapes de préparation et son classement.
        </p>
      </header>

      <RecipeForm
        mode="create"
        initialValues={initialValues}
        ingredients={ingredients}
        categories={categories}
        tags={tags}
      />
    </div>
  );
}
