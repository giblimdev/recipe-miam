/*
path :           app/admin/page.tsx
tag :            ["admin", "dashboard", "stats", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Tableau de bord admin minimal. Server Component async
                 qui affiche les compteurs (recipes, ingredients,
                 allergens, categories, tags) en grille de cards
                 cliquables vers les sous-sections. ⚠️ Aucune
                 protection d'accès : cette page est publique tant
                 qu'aucune auth (User + middleware) n'est en place.
                 À sécuriser AVANT mise en production.

flow:            Server Component async → Promise.all([count × 5]) →
                 rend header + bandeau d'avertissement + grille de
                 5 stat-cards cliquables (link) + section "Sections
                 admin" listant les liens directs (dont /admin/allergen).

ecosystem:       Admin = [
                   "@/app/admin/allergen/page.tsx",
                   "@/app/admin/page.tsx",
                 ]

relatedFiles:    ["@/lib/prisma",
                  "@/components/ui/card",
                  "@/components/ui/badge",
                  "@/components/ui/alert"]

imports:         ["next/link",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/components/ui/alert",
                  "@/components/ui/badge",
                  "@/components/ui/card"]

exports:         ["default AdminDashboardPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux voir un tableau de bord des entités"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import {
  ArrowRight,
  Carrot,
  ChefHat,
  FolderTree,
  LayoutDashboard,
  ShieldAlert,
  Tag,
  TriangleAlert,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly count: number;
  readonly icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

function StatCard({
  href,
  label,
  description,
  count,
  icon: Icon,
}: StatCardProps) {
  return (
    <Link
      href={href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="h-full transition-all group-hover:border-foreground/20 group-hover:shadow-md group-focus-visible:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-5" aria-hidden />
            </div>
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {count.toLocaleString("fr-FR")}
            </span>
          </div>
          <CardTitle className="mt-3 text-base">{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            Gérer
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function AdminDashboardPage() {
  const [
    recipeCount,
    ingredientCount,
    allergenCount,
    categoryCount,
    tagCount,
  ] = await Promise.all([
    prisma.recipe.count(),
    prisma.ingredient.count(),
    prisma.allergen.count(),
    prisma.category.count(),
    prisma.tag.count(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <LayoutDashboard className="size-3.5" aria-hidden />
            Administration
          </span>
          <Badge variant="destructive">Non protégé</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Tableau de bord
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Vue d'ensemble des entités du catalogue. Chaque carte mène vers
          l'écran de gestion correspondant.
        </p>
      </header>

      {/* Warning auth */}
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Aucune protection d'accès</AlertTitle>
        <AlertDescription>
          Cette section est <strong>publiquement accessible</strong>.
          L'authentification (modèle <code>User</code> + middleware) doit
          être mise en place avant tout déploiement en production.
        </AlertDescription>
      </Alert>

      {/* Stats grid */}
      <section aria-labelledby="stats-title" className="space-y-3">
        <h2
          id="stats-title"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Entités
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            href="/admin/recettes"
            label="Recettes"
            description="Catalogue complet des recettes"
            count={recipeCount}
            icon={ChefHat}
          />
          <StatCard
            href="/admin/ingredients"
            label="Ingrédients"
            description="Catalogue réutilisable d'ingrédients"
            count={ingredientCount}
            icon={Carrot}
          />
          <StatCard
            href="/admin/allergen"
            label="Allergènes INCO"
            description="Les 14 allergènes légaux (fixe)"
            count={allergenCount}
            icon={ShieldAlert}
          />
          <StatCard
            href="/admin/categories"
            label="Catégories"
            description="Navigation structurelle (Dessert, Plat…)"
            count={categoryCount}
            icon={FolderTree}
          />
          <StatCard
            href="/admin/tags"
            label="Tags"
            description="Attributs transversaux (Végétarien…)"
            count={tagCount}
            icon={Tag}
          />
        </div>
      </section>

      {/* Quick links */}
      <section aria-labelledby="links-title" className="space-y-3">
        <h2
          id="links-title"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Accès direct
        </h2>
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
          <li>
            <Link
              href="/admin/allergen"
              className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <ShieldAlert
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">
                  Consulter les allergènes INCO
                </span>
                <span className="block text-xs text-muted-foreground">
                  Vérifier les 14 codes légaux et leur ordre d'affichage
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}