/*
path :           app/admin/sync/_components/SyncPanel.tsx
tag :            ["admin", "json", "sync", "ui", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Panneau client de la page /admin/sync. Trois boutons :
                 "Exporter tout en JSON" (DB → fichiers), "Importer les
                 ingrédients" (fichier → DB), "Importer les recettes"
                 (parcours des fichiers présents). Affiche un rapport
                 minimal à chaque exécution.

flow:            useState(isPending, report, mode) → bouton Exporter →
                 exportAllJsonAction → toast + rapport. Bouton Importer
                 ingrédients → reimportIngredientsJsonAction → toast +
                 rapport. Bouton Importer recettes → reçoit la liste
                 initiale `existingSlugs` (prop) → boucle séquentielle sur
                 reimportRecipeJsonAction → rapport consolidé.

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

relatedFiles:    ["@/app/admin/_actions/json-export.ts"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/_actions/json-export",
                  "@/components/ui/button"]

exports:         ["SyncPanel",
                  "SyncPanelProps"]

useBy:           ["@/app/admin/sync/page.tsx"]

userStories:     ["*en tant qu'admin je veux synchroniser la base et les fichiers JSON"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, RefreshCw, FileJson2, Leaf } from "lucide-react";
import { toast } from "sonner";

import {
  exportAllJsonAction,
  reimportIngredientsJsonAction,
  reimportRecipeJsonAction,
} from "@/app/admin/_actions/json-export";
import { Button } from "@/components/ui/button";

export interface SyncPanelProps {
  readonly existingSlugs: readonly string[];
}

interface Report {
  readonly kind: "export" | "import-ingredients" | "import-recipes";
  readonly message: string;
  readonly details?: readonly string[];
}

export function SyncPanel({ existingSlugs }: SyncPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<Report | null>(null);

  function handleExportAll() {
    startTransition(async () => {
      const res = await exportAllJsonAction();
      if (res.ok) {
        toast.success(
          `${res.data.ingredients} ingrédient(s) et ${res.data.recipes} recette(s) exportés.`,
        );
        setReport({
          kind: "export",
          message: `Export OK — ${res.data.ingredients} ingrédient(s), ${res.data.recipes} recette(s).`,
        });
        router.refresh();
      } else {
        toast.error(res.error);
        setReport({ kind: "export", message: `Erreur : ${res.error}` });
      }
    });
  }

  function handleImportIngredients() {
    startTransition(async () => {
      const res = await reimportIngredientsJsonAction();
      if (res.ok) {
        toast.success(`${res.data.upserted} ingrédient(s) importés.`);
        setReport({
          kind: "import-ingredients",
          message: `${res.data.upserted} ingrédient(s) réinjectés en base.`,
        });
        router.refresh();
      } else {
        toast.error(res.error);
        setReport({ kind: "import-ingredients", message: `Erreur : ${res.error}` });
      }
    });
  }

  function handleImportRecipes() {
    if (existingSlugs.length === 0) {
      toast.error("Aucun fichier recette à importer.");
      return;
    }
    startTransition(async () => {
      const succeeded: string[] = [];
      const failed: string[] = [];
      for (const slug of existingSlugs) {
        const res = await reimportRecipeJsonAction(slug);
        if (res.ok) succeeded.push(slug);
        else failed.push(`${slug} — ${res.error}`);
      }
      if (failed.length === 0) {
        toast.success(`${succeeded.length} recette(s) importée(s).`);
      } else {
        toast.error(`${failed.length} échec(s). Voir le rapport.`);
      }
      setReport({
        kind: "import-recipes",
        message: `${succeeded.length} OK, ${failed.length} échec(s).`,
        details: failed,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Download className="size-4 text-chart-2" aria-hidden />
            Exporter la base
          </div>
          <p className="text-sm text-muted-foreground">
            Dump complet : <code>data/ingredients/ingredients.json</code>,
            tous les <code>data/recipes/[slug]/[slug].json</code> et un
            <code> index.json</code>.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handleExportAll}
            disabled={isPending}
          >
            <RefreshCw className="size-4" aria-hidden />
            {isPending ? "Traitement…" : "Exporter tout"}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Leaf className="size-4 text-chart-4" aria-hidden />
            Importer les ingrédients
          </div>
          <p className="text-sm text-muted-foreground">
            Lit <code>data/ingredients/ingredients.json</code> et upsert
            chaque ingrédient (par slug). Allergènes remplacés.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleImportIngredients}
            disabled={isPending}
          >
            <Upload className="size-4" aria-hidden />
            {isPending ? "Traitement…" : "Importer"}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileJson2 className="size-4 text-chart-5" aria-hidden />
            Importer les recettes
          </div>
          <p className="text-sm text-muted-foreground">
            Parcourt <code>data/recipes/</code> ({existingSlugs.length}{" "}
            recette(s) détectée(s)) et upsert chaque recette.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleImportRecipes}
            disabled={isPending || existingSlugs.length === 0}
          >
            <Upload className="size-4" aria-hidden />
            {isPending ? "Traitement…" : "Importer"}
          </Button>
        </div>
      </div>

      {report && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
          <p className="font-medium">{report.message}</p>
          {report.details && report.details.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-destructive">
              {report.details.map((line) => (
                <li key={line} className="font-mono">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}