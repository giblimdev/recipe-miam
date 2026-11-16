
/*
path:            app/admin/recipes/[id]/edit/page.tsx
tag:             ["admin", "recipes", "edit", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page de modification d'une recette existante. Charge
                 la recette et ses relations, ainsi que les référentiels
                 d'ingrédients, catégories et tags.

relatedFiles:    ["@/lib/prisma",
                  "@/app/admin/recipes/_components/RecipeForm"]

imports:         ["next/link",
                  "next/navigation",
                  "next/server",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/app/admin/recipes/_components/RecipeForm"]

exports:         ["default AdminEditRecipePage"]

useBy:           []
*/

import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChefHat,
  ChevronRight,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { RecipeForm } from "@/app/admin/recipes/_components/RecipeForm";

export const instant = false;

interface AdminEditRecipePageProps {
  readonly params: Promise<{
    id: string;
  }>;
}

export default async function AdminEditRecipePage({
  params,
}: AdminEditRecipePageProps) {
  await connection();

  const { id } = await params;

  const [recipe, ingredients, categories, tags] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id },
      include: {
        recipeIngredients: {
          orderBy: { position: "asc" },
          select: {
            ingredientId: true,
            amount: true,
            unit: true,
            note: true,
          },
        },
        steps: {
          orderBy: { stepNumber: "asc" },
          select: {
            instruction: true,
            image: true,
          },
        },
        categories: {
          select: {
            categoryId: true,
          },
        },
        tags: {
          select: {
            tagId: true,
          },
        },
      },
    }),

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

  if (!recipe) {
    notFound();
  }

  const initialValues = {
    title: recipe.title,
    slugRecipe: recipe.slugRecipe,
    description: recipe.description,
    image: recipe.image,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    calories: recipe.calories,

    ingredients: recipe.recipeIngredients.map((item) => ({
      ingredientId: item.ingredientId,
      amount: item.amount,
      unit: item.unit,
      note: item.note,
    })),

    steps: recipe.steps.map((step) => ({
      instruction: step.instruction,
      image: step.image,
    })),

    categoryIds: recipe.categories.map((item) => item.categoryId),
    tagIds: recipe.tags.map((item) => item.tagId),
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
          Modifier
        </span>
      </nav>

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ChefHat className="size-4" aria-hidden />
          Administration du catalogue
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          Modifier la recette
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Modifiez les informations, les ingrédients, les étapes et le
          classement de « {recipe.title} ».
        </p>
      </header>

      <RecipeForm
        mode="edit"
        recipeId={recipe.id}
        initialValues={initialValues}
        ingredients={ingredients}
        categories={categories}
        tags={tags}
      />
    </div>
  );
}
