/*
path :           lib/json/storage.ts
tag :            ["json", "storage", "fs", "server-only", "atomic-write"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Couche I/O des fichiers JSON miroirs. Écriture atomique
                 (tmp + rename) pour éviter tout fichier tronqué en cas
                 d'interruption. Lecture tolérante (retourne null si
                 fichier absent ou corrompu, sans lever). Importable
                 UNIQUEMENT côté serveur.

flow:            writeIngredientsFile(data) → mkdir + write tmp + rename.
                 readIngredientsFile() → readFile + JSON.parse (null si KO).
                 writeRecipeFile(slug, data) → crée data/recipes/[slug]/.
                 readRecipeFile(slug) → même tolérance.
                 deleteRecipeDir(slug) → rm -rf du dossier.
                 listRecipeSlugs() → readdir, filtre dossiers.

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

relatedFiles:    ["@/lib/json/paths.ts",
                  "@/lib/json/types.ts"]

imports:         ["server-only",
                  "node:fs/promises",
                  "node:path",
                  "@/lib/json/paths",
                  "@/lib/json/types"]

exports:         ["writeIngredientsFile",
                  "readIngredientsFile",
                  "writeRecipeFile",
                  "readRecipeFile",
                  "deleteRecipeDir",
                  "listRecipeSlugs",
                  "recipeExists"]

useBy:           ["@/app/admin/_actions/json-export.ts",
                  "@/scripts/export-to-json.ts",
                  "@/scripts/import-from-json.ts"]

userStories:     ["*en tant que développeur je veux écrire/lire les JSON de manière atomique et tolérante"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import "server-only";

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  INGREDIENTS_DIR,
  RECIPES_DIR,
  assertSafeSlug,
  ingredientsFilePath,
  recipeDirPath,
  recipeFilePath,
} from "@/lib/json/paths";
import type {
  IngredientsFileJson,
  RecipeFileJson,
} from "@/lib/json/types";

/* ------------------------------------------------------------------ */
/*  Helpers internes                                                   */
/* ------------------------------------------------------------------ */

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const payload = JSON.stringify(data, null, 2) + "\n";
  await writeFile(tmp, payload, "utf-8");
  await rename(tmp, filePath);
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    console.error("[json-storage] read failed:", filePath, error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Ingredients                                                        */
/* ------------------------------------------------------------------ */

export async function writeIngredientsFile(
  data: IngredientsFileJson,
): Promise<void> {
  await mkdir(INGREDIENTS_DIR, { recursive: true });
  await atomicWriteJson(ingredientsFilePath(), data);
}

export async function readIngredientsFile(): Promise<IngredientsFileJson | null> {
  return safeReadJson<IngredientsFileJson>(ingredientsFilePath());
}

/* ------------------------------------------------------------------ */
/*  Recipes                                                            */
/* ------------------------------------------------------------------ */

export async function writeRecipeFile(
  slug: string,
  data: RecipeFileJson,
): Promise<void> {
  assertSafeSlug(slug);
  await mkdir(recipeDirPath(slug), { recursive: true });
  await atomicWriteJson(recipeFilePath(slug), data);
}

export async function readRecipeFile(
  slug: string,
): Promise<RecipeFileJson | null> {
  assertSafeSlug(slug);
  return safeReadJson<RecipeFileJson>(recipeFilePath(slug));
}

export async function deleteRecipeDir(slug: string): Promise<void> {
  assertSafeSlug(slug);
  await rm(recipeDirPath(slug), { recursive: true, force: true });
}

export async function recipeExists(slug: string): Promise<boolean> {
  assertSafeSlug(slug);
  const file = await safeReadJson<RecipeFileJson>(recipeFilePath(slug));
  return file !== null;
}

/**
 * Liste les slugs présents dans data/recipes/ (dossiers uniquement).
 * Ne valide pas le format — la validation se fait au moment de la lecture.
 */
export async function listRecipeSlugs(): Promise<string[]> {
  try {
    const entries = await readdir(RECIPES_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
      .sort();
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Index (bonus — listing rapide)                                     */
/* ------------------------------------------------------------------ */

export async function writeRecipeIndex(
  entries: readonly { slug: string; title: string; displayOrder: number; image: string | null }[],
): Promise<void> {
  await mkdir(RECIPES_DIR, { recursive: true });
  const sorted = [...entries].sort((a, b) => a.displayOrder - b.displayOrder);
  await atomicWriteJson(join(RECIPES_DIR, "index.json"), {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    count: sorted.length,
    recipes: sorted,
  });
}