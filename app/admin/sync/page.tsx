/*
path :           app/admin/sync/page.tsx
tag :            ["admin", "json", "sync", "page", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page de synchronisation DB ↔ fichiers JSON miroirs.
                 Server Component async qui liste les slugs présents
                 dans data/recipes/ puis délègue l'interactivité à
                 SyncPanel (client).

flow:            Server Component async → await connection() →
                 listRecipeSlugs() → breadcrumb + header + Alert +
                 SyncPanel(existingSlugs).

ecosystem:       Json = [
                   "@/lib/json/types.ts",
                   "@/lib/json/paths.ts",
                   "@/lib/json/serialize.ts",
                   "@/lib/json/storage.ts",
                   "@/lib/validations/json-files.ts",
                   "@/app/admin/_actions/json-export.ts",
                   "@/app/admin/sync/page.tsx",
                   "@/app/admin/sync/_components/SyncPanel.tsx",
                   "@/scripts/export-to-json.ts",
                   "@/scripts/import-from-json.ts",
                 ]

relatedFiles:    ["@/app/admin/sync/_components/SyncPanel.tsx",
                  "@/lib/json/storage"]

imports:         ["next/link",
                  "next/server",
                  "lucide-react",
                  "@/lib/json/storage",
                  "@/app/admin/sync/_components/SyncPanel",
                  "@/components/ui/alert",
                  "@/components/ui/badge"]

exports:         ["default AdminSyncPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux synchroniser DB et fichiers JSON"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { listRecipeSlugs } from "@/lib/json/storage";
import { SyncPanel } from "@/app/admin/sync/_components/SyncPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const instant = false;

export default async function AdminSyncPage() {
  await connection();
  const existingSlugs = await listRecipeSlugs();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Fil d'Ariane"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Admin
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-medium text-foreground">Synchronisation JSON</span>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <RefreshCw className="size-3.5" aria-hidden />
            Miroir JSON
          </span>
          <Badge variant="secondary">DB = source de vérité</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Synchronisation JSON
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Export de la base vers <code>data/ingredients/ingredients.json</code>{" "}
          et <code>data/recipes/[slug]/[slug].json</code>. Les fichiers sont
          versionnés dans Git et peuvent servir de seed, de backup ou de
          contexte pour une IA. La base reste la source de vérité.
        </p>
      </header>

      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Import = opération sensible</AlertTitle>
        <AlertDescription>
          L'import réécrit les entités existantes (par slug) et leurs
          relations. Faites un commit avant, et vérifiez les JSON après
          édition manuelle.
        </AlertDescription>
      </Alert>

      <SyncPanel existingSlugs={existingSlugs} />
    </div>
  );
}