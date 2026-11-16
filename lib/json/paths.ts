/*
path :           lib/json/paths.ts
tag :            ["json", "paths", "fs", "server-only", "security"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Résolution des chemins des fichiers JSON miroirs.
                 Centralise `data/ingredients/ingredients.json` et
                 `data/recipes/[slug]/[slug].json`. Valide les slugs
                 (kebab-case strict) pour empêcher tout path traversal.
                 Importable UNIQUEMENT côté serveur.

flow:            Module load → constantes DATA_DIR / INGREDIENTS_DIR /
                 RECIPES_DIR calculées depuis process.cwd(). Exports :
                 ingredientsFilePath(), recipeDirPath(slug),
                 recipeFilePath(slug), recipeIndexPath().
                 assertSafeSlug(slug) lève si le slug contient / \ .. ou NUL.

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

relatedFiles:    ["@/lib/json/storage.ts",
                  "@/lib/json/types.ts"]

imports:         ["server-only", "node:path"]

exports:         ["DATA_DIR",
                  "INGREDIENTS_DIR",
                  "RECIPES_DIR",
                  "ingredientsFilePath",
                  "recipeDirPath",
                  "recipeFilePath",
                  "recipeIndexPath",
                  "assertSafeSlug"]

useBy:           ["@/lib/json/storage.ts"]

userStories:     ["*en tant que développeur je veux des chemins JSON sûrs et centralisés"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import "server-only";

import { join } from "node:path";

/* ------------------------------------------------------------------ */
/*  Chemins racine                                                     */
/* ------------------------------------------------------------------ */

export const DATA_DIR = join(process.cwd(), "data");
export const INGREDIENTS_DIR = join(DATA_DIR, "ingredients");
export const RECIPES_DIR = join(DATA_DIR, "recipes");

/* ------------------------------------------------------------------ */
/*  Garde-fou slug                                                     */
/* ------------------------------------------------------------------ */

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Rejette tout slug qui n'est pas strictement kebab-case.
 * Empêche `../`, `/`, `\`, NUL byte, espace, majuscules, accents, etc.
 */
export function assertSafeSlug(slug: string): void {
  if (typeof slug !== "string" || slug.length === 0) {
    throw new Error("Slug vide ou invalide.");
  }
  if (slug.length > 120) {
    throw new Error(`Slug trop long : ${slug.length} caractères.`);
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(`Slug invalide (kebab-case strict attendu) : "${slug}"`);
  }
}

/* ------------------------------------------------------------------ */
/*  Chemins dérivés                                                    */
/* ------------------------------------------------------------------ */

export function ingredientsFilePath(): string {
  return join(INGREDIENTS_DIR, "ingredients.json");
}

export function recipeDirPath(slug: string): string {
  assertSafeSlug(slug);
  return join(RECIPES_DIR, slug);
}

export function recipeFilePath(slug: string): string {
  assertSafeSlug(slug);
  return join(RECIPES_DIR, slug, `${slug}.json`);
}

export function recipeIndexPath(): string {
  return join(RECIPES_DIR, "index.json");
}