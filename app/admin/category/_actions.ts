/*
path :           app/admin/category/_actions.ts
tag :            ["admin", "category", "crud", "server-action"]
projectId:       <recipe-miam>
type:            action
generic:         false

role:            Server Actions CRUD pour les catégories de recettes.
                 Expose create, update, delete et seedExample (les 8
                 catégories FR standards). Chaque action valide son
                 payload via Zod, capture les erreurs P2002 (unicité)
                 et les traduit en message FR, puis revalide la route
                 /admin/category. Aucune logique métier dans les
                 composants : tout passe par ici.

flow:            create(input) → categoryFormSchema.parse → prisma
                 .category.create → revalidatePath → { ok, data }.
                 update(id, input) → categoryIdSchema + formSchema →
                 prisma.update → revalidatePath.
                 delete(id) → categoryIdSchema → prisma.delete →
                 revalidatePath. seedExample() → boucle sur les 8
                 exemples, ignore les P2002 → rapport { created,
                 skipped }.

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

relatedFiles:    ["@/lib/prisma",
                  "@/lib/validations/taxonomy"]

imports:         ["next/cache",
                  "@/lib/prisma",
                  "@/lib/validations/taxonomy"]

exports:         ["ActionResult",
                  "createCategoryAction",
                  "updateCategoryAction",
                  "deleteCategoryAction",
                  "seedExampleCategoriesAction"]

useBy:           ["@/app/admin/category/_components/CategoryManager.tsx"]

userStories:     ["*en tant qu'admin je veux créer, éditer et supprimer des catégories"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  categoryFormSchema,
  categoryIdSchema,
} from "@/lib/validations/taxonomy";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

const REVALIDATE_PATH = "/admin/category";

/* ------------------------------------------------------------------ */
/*  Erreurs                                                            */
/* ------------------------------------------------------------------ */

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function toUserMessage(error: unknown): string {
  if (isUniqueError(error)) {
    return "Ce nom ou ce slug est déjà utilisé par une autre catégorie.";
  }
  if (error instanceof Error) return error.message;
  return "Erreur inconnue.";
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = categoryFormSchema.parse(input);
    const category = await prisma.category.create({ data });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { id: category.id } };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

export async function updateCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsedId = categoryIdSchema.parse({ id });
    const data = categoryFormSchema.parse(input);
    await prisma.category.update({ where: { id: parsedId.id }, data });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    const parsedId = categoryIdSchema.parse({ id });
    await prisma.category.delete({ where: { id: parsedId.id } });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Seed exemples                                                      */
/* ------------------------------------------------------------------ */

const EXAMPLE_CATEGORIES = [
  { name: "Entrée", slugCategory: "entree", image: null },
  { name: "Plat principal", slugCategory: "plat-principal", image: null },
  { name: "Dessert", slugCategory: "dessert", image: null },
  { name: "Apéritif", slugCategory: "aperitif", image: null },
  { name: "Boisson", slugCategory: "boisson", image: null },
  { name: "Accompagnement", slugCategory: "accompagnement", image: null },
  { name: "Petit-déjeuner", slugCategory: "petit-dejeuner", image: null },
  { name: "Amuse-bouche", slugCategory: "amuse-bouche", image: null },
] as const;

export async function seedExampleCategoriesAction(): Promise<
  ActionResult<{ created: number; skipped: number }>
> {
  try {
    let created = 0;
    let skipped = 0;

    for (const example of EXAMPLE_CATEGORIES) {
      try {
        await prisma.category.create({ data: example });
        created += 1;
      } catch (error) {
        if (isUniqueError(error)) skipped += 1;
        else throw error;
      }
    }

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { created, skipped } };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}