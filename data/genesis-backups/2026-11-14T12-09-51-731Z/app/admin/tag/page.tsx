/*
path :           app/admin/tag/page.tsx
tag :            ["admin", "tag", "crud", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page d'entrée du CRUD des tags de recettes. Server
                 Component async qui charge les tags triés par nom avec
                 leur nombre de recettes liées, puis délègue toute
                 l'interactivité au composant client TagManager
                 (création, édition, suppression, seed exemples).
                 ⚠️ Aucune protection d'accès tant qu'aucune auth n'est
                 en place.

flow:            Server Component async → prisma.tag.findMany({
                 orderBy: { name: "asc" }, select: id, name, slugTag,
                 _count.recipes }) → rend breadcrumb + header +
                 avertissement auth + Alert réglementaire + TagManager.

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

relatedFiles:    ["@/app/admin/tag/_components/TagManager.tsx",
                  "@/lib/prisma"]

imports:         ["next/link",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/app/admin/tag/_components/TagManager",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

exports:         ["default AdminTagPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux gérer les tags de recettes"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Tag as TagIcon,
  TriangleAlert,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { TagManager, type TagRow } from "@/app/admin/tag/_components/TagManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function AdminTagPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slugTag: true,
      _count: { select: { recipes: true } },
    },
  });

  const rows: TagRow[] = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slugTag: tag.slugTag,
    recipeCount: tag._count.recipes,
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
        <span className="font-medium text-foreground">Tags</span>
      </nav>

      {/* Header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TagIcon className="size-3.5" aria-hidden />
            Taxonomie
          </span>
          <Badge variant="secondary">Tags de recettes</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Tags
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Attributs transversaux et libres (Végétarien, Sans gluten,
          Rapide…). Cumulables à volonté, ils alimentent la recherche
          fine et les filtres croisés. Chaque slug alimente la route{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            /tags/&lt;slug&gt;
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
      <TagManager initialTags={rows} />
    </div>
  );
}
