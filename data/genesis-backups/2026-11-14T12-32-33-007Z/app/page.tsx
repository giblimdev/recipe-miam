/*
path :           app/page.tsx
tag :            ["home", "accueil", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page d'accueil. Server Component sync + Suspense qui
                 sert une coquille immédiatement puis stream le contenu
                 dynamique (recette à la une, recettes du moment,
                 catégories, tags). Catégories et tags sont affichés en
                 statique (pas de lien) tant que le mécanisme de filtre
                 n'est pas en place.

flow:            HomePage (sync) → <Suspense fallback=<HomeSkeleton />> →
                 <HomeContent /> async → Promise.all([
                   recipe.findFirst (featured, orderBy displayOrder asc),
                   recipe.findMany (populaires, skip 1, take 8),
                   category.findMany (avec _count.recipes),
                   tag.findMany (avec _count.recipes, take 16,
                     triés par _count desc puis name)
                 ]) → si aucune recette, rend <EmptyHome /> →
                 sinon rend <Hero /> + <RecipeGrid /> +
                 <CategoryGrid /> + <TagCloud />.

                 `instant = false` : signale à Next.js 16 (avec
                 cacheComponents activé) que cette route lit des données
                 à la requête et n'est pas pré-rendue statiquement.

ecosystem:       Public = [
                   "@/app/page.tsx",
                 ]

relatedFiles:    ["@/lib/prisma",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/skeleton"]

imports:         ["next/link",
                  "next/image",
                  "react",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/skeleton"]

exports:         ["default HomePage"]

useBy:           []

userStories:     ["*en tant qu'utilisateur je veux découvrir des recettes dès l'accueil"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ChefHat,
  Clock,
  Flame,
  FolderTree,
  Sparkles,
  Tag as TagIcon,
  UtensilsCrossed,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { DIFFICULTY_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const instant = false;

/* ------------------------------------------------------------------ */
/*  Types locaux                                                       */
/* ------------------------------------------------------------------ */

interface RecipeCardData {
  readonly id: string;
  readonly slugRecipe: string;
  readonly title: string;
  readonly description: string;
  readonly image: string | null;
  readonly prepTime: number;
  readonly cookTime: number;
  readonly servings: number;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
}

interface CategoryCardData {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
  readonly recipeCount: number;
}

interface TagCardData {
  readonly id: string;
  readonly name: string;
  readonly recipeCount: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers purs                                                       */
/* ------------------------------------------------------------------ */

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

function totalTime(prepTime: number, cookTime: number): string {
  return formatMinutes(prepTime + cookTime);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contenu dynamique                                                  */
/* ------------------------------------------------------------------ */

async function HomeContent() {
  const [featured, popular, categories, tags] = await Promise.all([
    prisma.recipe.findFirst({
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        slugRecipe: true,
        title: true,
        description: true,
        image: true,
        prepTime: true,
        cookTime: true,
        servings: true,
        difficulty: true,
      },
    }),
    prisma.recipe.findMany({
      orderBy: { displayOrder: "asc" },
      skip: 1,
      take: 8,
      select: {
        id: true,
        slugRecipe: true,
        title: true,
        description: true,
        image: true,
        prepTime: true,
        cookTime: true,
        servings: true,
        difficulty: true,
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { recipes: true } },
      },
    }),
    prisma.tag.findMany({
      orderBy: [{ recipes: { _count: "desc" } }, { name: "asc" }],
      take: 16,
      include: {
        _count: { select: { recipes: true } },
      },
    }),
  ]);

  const isEmpty =
    !featured && popular.length === 0 && categories.length === 0;

  if (isEmpty) {
    return <EmptyHome />;
  }

  const categoryData: CategoryCardData[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    image: category.image,
    recipeCount: category._count.recipes,
  }));

  const tagData: TagCardData[] = tags
    .filter((tag) => tag._count.recipes > 0)
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      recipeCount: tag._count.recipes,
    }));

  return (
    <div className="space-y-16">
      {featured && <Hero recipe={featured} />}
      {popular.length > 0 && <RecipeGrid recipes={popular} />}
      {categoryData.length > 0 && <CategoryGrid categories={categoryData} />}
      {tagData.length > 0 && <TagCloud tags={tagData} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero({ recipe }: { readonly recipe: RecipeCardData }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
    >
      {/* Texte */}
      <div className="order-2 space-y-5 lg:order-1">
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="size-3" aria-hidden />
          À la une
        </Badge>

        <div className="space-y-3">
          <h1
            id="hero-title"
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            {recipe.title}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {recipe.description}
          </p>
        </div>

        {/* Méta */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden />
            {totalTime(recipe.prepTime, recipe.cookTime)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ChefHat className="size-4" aria-hidden />
            {recipe.servings} pers.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Flame className="size-4" aria-hidden />
            {DIFFICULTY_LABELS[recipe.difficulty]}
          </span>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button render={<Link href={`/recipes/${recipe.slugRecipe}`} />}>
            Voir la recette
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" render={<Link href="/recipes" />}>
            <UtensilsCrossed className="size-4" aria-hidden />
            Toutes les recettes
          </Button>
        </div>
      </div>

      {/* Image */}
      <div className="order-1 aspect-[4/3] overflow-hidden rounded-2xl border border-border/60 bg-muted lg:order-2">
        {recipe.image ? (
          <Image
            src={recipe.image}
            alt={recipe.title}
            width={1200}
            height={900}
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="size-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-chart-1/10 via-chart-2/10 to-chart-5/10">
            <ChefHat className="size-16 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Grille recettes                                                    */
/* ------------------------------------------------------------------ */

function RecipeGrid({
  recipes,
}: {
  readonly recipes: readonly RecipeCardData[];
}) {
  return (
    <section aria-labelledby="recipes-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="recipes-title"
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Recettes du moment
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Une sélection pour vous inspirer aujourd'hui.
          </p>
        </div>
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Tout voir
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <RecipeCard recipe={recipe} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecipeCard({ recipe }: { readonly recipe: RecipeCardData }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-shadow hover:shadow-md focus-within:shadow-md">
      <Link
        href={`/recipes/${recipe.slugRecipe}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {recipe.image ? (
            <Image
              src={recipe.image}
              alt={recipe.title}
              width={600}
              height={450}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-chart-1/10 via-chart-2/10 to-chart-5/10">
              <ChefHat className="size-10 text-muted-foreground" aria-hidden />
            </div>
          )}
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 bg-background/90 backdrop-blur"
          >
            {DIFFICULTY_LABELS[recipe.difficulty]}
          </Badge>
        </div>

        {/* Contenu */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-base font-semibold text-foreground group-hover:text-foreground/80">
            {recipe.title}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {recipe.description}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {totalTime(recipe.prepTime, recipe.cookTime)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ChefHat className="size-3.5" aria-hidden />
              {recipe.servings} pers.
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Grille catégories (statique)                                       */
/* ------------------------------------------------------------------ */

function CategoryGrid({
  categories,
}: {
  readonly categories: readonly CategoryCardData[];
}) {
  return (
    <section aria-labelledby="categories-title" className="space-y-6">
      <header>
        <h2
          id="categories-title"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Explorer par catégorie
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Entrée, plat, dessert… trouvez l'inspiration par moment du repas.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <li key={category.id}>
            <CategoryCard category={category} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/*
 * Carte catégorie en lecture seule : aucun lien tant que le mécanisme
 * de filtre n'est pas défini. Le rendu reste visuel (image + nom +
 * compteur). Quand les filtres seront en place, remplacer l'élément
 * racine <div> par le composant de filtre prévu.
 */
function CategoryCard({
  category,
}: {
  readonly category: CategoryCardData;
}) {
  return (
    <div
      className="group relative block aspect-square overflow-hidden rounded-2xl border border-border/60 bg-muted"
      aria-label={`${category.name} — ${category.recipeCount} recette${
        category.recipeCount > 1 ? "s" : ""
      }`}
    >
      {category.image ? (
        <Image
          src={category.image}
          alt=""
          width={400}
          height={400}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-chart-1/15 via-chart-2/15 to-chart-5/15">
          <FolderTree className="size-12 text-muted-foreground" aria-hidden />
        </div>
      )}

      {/* Overlay pour lisibilité du texte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <h3 className="text-sm font-bold text-white sm:text-base">
          {category.name}
        </h3>
        <p className="text-[11px] text-white/80 sm:text-xs">
          {category.recipeCount} recette{category.recipeCount > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nuage de tags (statique)                                           */
/* ------------------------------------------------------------------ */

function TagCloud({ tags }: { readonly tags: readonly TagCardData[] }) {
  return (
    <section aria-labelledby="tags-title" className="space-y-4">
      <header>
        <h2
          id="tags-title"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Envie de quelque chose de précis ?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Régime, temps de préparation, saison… les filtres arrivent
          bientôt. En attendant, voici les tags les plus populaires.
        </p>
      </header>

      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag.id}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground">
              <TagIcon
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
              <span>{tag.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {tag.recipeCount}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  État vide                                                          */
/* ------------------------------------------------------------------ */

function EmptyHome() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-muted">
        <ChefHat className="size-8 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
        Aucune recette pour l'instant
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        La base est vide. Ajoutez des recettes depuis l'administration ou
        lancez le seed pour partir d'exemples.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/admin" />}>
          Aller à l'admin
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Astuce :{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
          npx prisma db seed
        </code>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function HomeSkeleton() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      </div>

      {/* Recettes */}
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <li key={index}>
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </li>
          ))}
        </ul>
      </div>

      {/* Catégories */}
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index}>
              <Skeleton className="aspect-square w-full rounded-2xl" />
            </li>
          ))}
        </ul>
      </div>

      {/* Tags */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}