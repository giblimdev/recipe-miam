/*
path :           app/admin/tag/_actions.ts
tag :            ["admin", "tag", "crud", "server-action"]
projectId:       <recipe-miam>
type:            action
generic:         false

role:            Server Actions CRUD pour les tags de recettes. Expose
                 create, update, delete et seedExample (12 tags FR
                 standards). Chaque action valide son payload via Zod,
                 capture les erreurs P2002 (unicité), puis revalide la
                 route /admin/tag.

flow:            create(input) → tagFormSchema.parse → prisma.tag.create
                 → revalidatePath. update(id, input) → tagIdSchema +
                 tagFormSchema → prisma.tag.update → revalidatePath.
                 delete(id) → tagIdSchema → prisma.tag.delete →
                 revalidatePath. seedExample() → boucle sur 12 exemples,
                 ignore P2002 → rapport { created, skipped }.

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
                  "createTagAction",
                  "updateTagAction",
                  "deleteTagAction",
                  "seedExampleTagsAction"]

useBy:           ["@/app/admin/tag/_components/TagManager.tsx"]

userStories:     ["*en tant qu'admin je veux créer, éditer et supprimer des tags"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { tagFormSchema, tagIdSchema } from "@/lib/validations/taxonomy";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

const REVALIDATE_PATH = "/admin/tag";

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
    return "Ce nom ou ce slug est déjà utilisé par un autre tag.";
  }
  if (error instanceof Error) return error.message;
  return "Erreur inconnue.";
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export async function createTagAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = tagFormSchema.parse(input);
    const tag = await prisma.tag.create({ data });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { id: tag.id } };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

export async function updateTagAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsedId = tagIdSchema.parse({ id });
    const data = tagFormSchema.parse(input);
    await prisma.tag.update({ where: { id: parsedId.id }, data });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

export async function deleteTagAction(id: string): Promise<ActionResult> {
  try {
    const parsedId = tagIdSchema.parse({ id });
    await prisma.tag.delete({ where: { id: parsedId.id } });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Seed exemples                                                      */
/* ------------------------------------------------------------------ */

const EXAMPLE_TAGS = [
  { name: "Végétarien", slugTag: "vegetarien" },
  { name: "Vegan", slugTag: "vegan" },
  { name: "Sans gluten", slugTag: "sans-gluten" },
  { name: "Sans lactose", slugTag: "sans-lactose" },
  { name: "Rapide", slugTag: "rapide" },
  { name: "Économique", slugTag: "economique" },
  { name: "Comfort food", slugTag: "comfort-food" },
  { name: "Meal prep", slugTag: "meal-prep" },
  { name: "Enfant-friendly", slugTag: "enfant-friendly" },
  { name: "Épicé", slugTag: "epice" },
  { name: "Hiver", slugTag: "hiver" },
  { name: "Été", slugTag: "ete" },
] as const;

export async function seedExampleTagsAction(): Promise<
  ActionResult<{ created: number; skipped: number }>
> {
  try {
    let created = 0;
    let skipped = 0;

    for (const example of EXAMPLE_TAGS) {
      try {
        await prisma.tag.create({ data: example });
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