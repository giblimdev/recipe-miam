/*
path :           app/admin/category/page.tsx
tag :            ["admin", "category", "crud", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page d'entrée du CRUD des catégories de recettes. Server
                 Component async qui charge les catégories triées par nom
                 avec leur nombre de recettes liées, puis délègue toute
                 l'interactivité au composant client CategoryManager
                 (création, édition, suppression, seed exemples).
                 ⚠️ Aucune protection d'accès tant qu'aucune auth n'est
                 en place.

flow:            Server Component async → prisma.category.findMany({
                 orderBy: { name: "asc" }, select: id, name,
                 slugCategory, image, _count.recipes }) → rend
                 breadcrumb + header + avertissement auth + Alert
                 réglementaire + CategoryManager.

                 `instant = false` : signale à Next.js 16 (avec
                 cacheComponents activé) que cette route lit des
                 données à la requête et n'est pas pré-rendue
                 statiquement. Remplace `dynamic = "force-dynamic"`.

ecosystem:       Admin = [
                   "@/app/admin/allergen/page.tsx",
                   "@/app/admin/category/_actions.ts",
                   "@/app/admin/category/_components/CategoryManager.tsx",
                   "@/app/admin/category/page.tsx",
                   "@/app/admin/page.tsx",
                   "@/app/admin/tag/_actions.ts",
                   "@/app/admin/tag/_components/TagManager.tsx",
                   "@/app/admin/tag/page.tsx",
                 ]

relatedFiles:    ["@/app/admin/category/_components/CategoryManager.tsx",
                  "@/lib/prisma"]

imports:         ["next/link",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/app/admin/category/_components/CategoryManager",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

exports:         ["default AdminCategoryPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux gérer les catégories de recettes"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  FolderTree,
  TriangleAlert,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  CategoryManager,
  type CategoryRow,
} from "@/app/admin/category/_components/CategoryManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const instant = false;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function AdminCategoryPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slugCategory: true,
      image: true,
      _count: { select: { recipes: true } },
    },
  });

  const rows: CategoryRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slugCategory: category.slugCategory,
    image: category.image,
    recipeCount: category._count.recipes,
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
        <span className="font-medium text-foreground">Catégories</span>
      </nav>

      {/* Header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FolderTree className="size-3.5" aria-hidden />
            Taxonomie
          </span>
          <Badge variant="secondary">Catégories de recettes</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Catégories
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Classement structurel des recettes (Entrée, Plat principal,
          Dessert…). Une recette appartient généralement à une ou deux
          catégories. Chaque slug alimente la route{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            /categories/&lt;slug&gt;
          </code>
          .
        </p>
      </header>

      {/* Warning auth */}
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Aucune protection d'accès</AlertTitle>
        <AlertDescription>
          Cette page est <strong>publiquement accessible</strong>. La
          mise en place d'une auth (modèle <code>User</code> +
          middleware) est requise avant déploiement en production.
        </AlertDescription>
      </Alert>

      {/* CRUD */}
      <CategoryManager initialCategories={rows} />
    </div>
  );
}