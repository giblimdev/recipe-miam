/*
path :           scripts/export-to-json.ts
tag :            ["script", "json", "export", "cli", "seed"]
projectId:       <recipe-miam>
type:            helper
generic:         false

role:            Script CLI one-shot : DB Prisma → fichiers JSON miroirs.
                 Utilisable depuis un terminal ou en CI (npm run json:export).
                 Réutilise exactement les helpers utilisés par les Server
                 Actions (serialize + storage), donc comportement identique.

flow:            main() → prisma.ingredient.findMany (allergens inclus) →
                 writeIngredientsFile → prisma.recipe.findMany (relations
                 incluses) → writeRecipeFile pour chaque → writeRecipeIndex
                 → console.log récapitulatif → $disconnect.

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

relatedFiles:    ["@/lib/prisma",
                  "@/lib/json/storage",
                  "@/lib/json/serialize"]

imports:         ["@/lib/prisma",
                  "@/lib/json/storage",
                  "@/lib/json/serialize"]

exports:         []

useBy:           []

userStories:     ["*en tant que développeur je veux dumper la DB en JSON via une commande"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { prisma } from "@/lib/prisma";
import {
  writeIngredientsFile,
  writeRecipeFile,
  writeRecipeIndex,
} from "@/lib/json/storage";
import {
  ingredientsFileToJson,
  recipeToJson,
} from "@/lib/json/serialize";

async function main() {
  console.log("[export] reading ingredients…");
  const ingredients = await prisma.ingredient.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { allergens: { include: { allergen: { select: { code: true } } } } },
  });
  await writeIngredientsFile(ingredientsFileToJson(ingredients));
  console.log(`[export] ${ingredients.length} ingredient(s) → data/ingredients/ingredients.json`);

  console.log("[export] reading recipes…");
  const recipes = await prisma.recipe.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      recipeIngredients: {
        orderBy: { position: "asc" },
        include: { ingredient: { select: { slugIngredient: true } } },
      },
      steps: { orderBy: { stepNumber: "asc" } },
      categories: { include: { category: { select: { slugCategory: true } } } },
      tags: { include: { tag: { select: { slugTag: true } } } },
    },
  });

  const indexEntries: { slug: string; title: string; displayOrder: number; image: string | null }[] = [];
  for (const recipe of recipes) {
    const json = recipeToJson(recipe);
    await writeRecipeFile(json.slug, json);
    indexEntries.push({
      slug: json.slug,
      title: json.title,
      displayOrder: json.displayOrder,
      image: json.image,
    });
    console.log(`[export] recipe → data/recipes/${json.slug}/${json.slug}.json`);
  }
  await writeRecipeIndex(indexEntries);

  console.log(
    `\n[export] terminé : ${ingredients.length} ingrédient(s), ${recipes.length} recette(s).`,
  );
}

main()
  .catch((error) => {
    console.error("[export] échec :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });