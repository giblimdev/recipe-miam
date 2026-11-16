/*
path :           scripts/import-from-json.ts
tag :            ["script", "json", "import", "cli", "seed"]
projectId:       <recipe-miam>
type:            helper
generic:         false

role:            Script CLI one-shot : fichiers JSON → DB Prisma.
                 Réutilise les Server Actions (import ingredients puis
                 import recettes une par une, séquentielles). Idempotent
                 (upsert par slug). Refuse une version de schéma
                 incompatible via les schémas Zod.

flow:            main() → reimportIngredientsJsonAction() → si ok,
                 listRecipeSlugs() → pour chaque slug reimportRecipeJsonAction
                 → console.log récapitulatif → $disconnect.
                 Ordre imposé : ingrédients AVANT recettes (les recettes
                 référencent les ingrédients par slug en base).

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

relatedFiles:    ["@/app/admin/_actions/json-export",
                  "@/lib/json/storage"]

imports:         ["@/lib/prisma",
                  "@/lib/json/storage",
                  "@/app/admin/_actions/json-export"]

exports:         []

useBy:           []

userStories:     ["*en tant que développeur je veux réimporter les JSON en base via une commande"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { prisma } from "@/lib/prisma";
import { listRecipeSlugs } from "@/lib/json/storage";
import {
  reimportIngredientsJsonAction,
  reimportRecipeJsonAction,
} from "@/app/admin/_actions/json-export";

async function main() {
  console.log("[import] ingrédients…");
  const ing = await reimportIngredientsJsonAction();
  if (!ing.ok) {
    console.error("[import] échec ingrédients :", ing.error);
    process.exitCode = 1;
    return;
  }
  console.log(`[import] ${ing.data.upserted} ingrédient(s) upserted.`);

  const slugs = await listRecipeSlugs();
  console.log(`[import] ${slugs.length} recette(s) détectée(s).`);

  let ok = 0;
  let ko = 0;
  for (const slug of slugs) {
    const res = await reimportRecipeJsonAction(slug);
    if (res.ok) {
      ok += 1;
      console.log(`[import] ✓ ${slug}`);
    } else {
      ko += 1;
      console.error(`[import] ✗ ${slug} — ${res.error}`);
    }
  }

  console.log(`\n[import] terminé : ${ok} OK, ${ko} échec(s).`);
  if (ko > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[import] échec global :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });