/*
path :           app/recipes/_actions.ts
tag :            ["recipes", "crud", "reorder", "delete", "server-action"]
projectId:       <recipe-miam>
type:            action
generic:         false

role:            Server Actions pour la page Recettes. Expose
                 updateRecipeDisplayOrderAction (réordonnancement par
                 drag & drop : reçoit la liste ordonnée d'IDs et réécrit
                 displayOrder = index pour chaque recette dans une
                 transaction) et deleteRecipeAction (suppression avec
                 cascade). Chaque action valide son payload via Zod puis
                 revalide /recipes.

flow:            updateRecipeDisplayOrderAction(orderedIds) →
                 reorderSchema.parse → prisma.$transaction([update × n]) →
                 revalidatePath("/recipes") → { ok, data }.
                 deleteRecipeAction(id) → recipeIdSchema.parse →
                 prisma.recipe.delete → revalidatePath("/recipes") →
                 { ok, data }.

ecosystem:       Recipes = [
                   "@/app/recipes/_actions.ts",
                   "@/app/recipes/_components/RecipesBoard.tsx",
                   "@/app/recipes/page.tsx",
                 ]

relatedFiles:    ["@/lib/prisma"]

imports:         ["next/cache", "zod", "@/lib/prisma"]

exports:         ["ActionResult",
                  "updateRecipeDisplayOrderAction",
                  "deleteRecipeAction"]

useBy:           ["@/app/recipes/_components/RecipesBoard.tsx"]

userStories:     ["*en tant qu'admin je veux réordonner les recettes",
                  "*en tant qu'admin je veux supprimer une recette"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

const REVALIDATE_PATH = "/recipes";

/* ------------------------------------------------------------------ */
/*  Schémas                                                            */
/* ------------------------------------------------------------------ */

const reorderSchema = z
  .object({
    orderedIds: z
      .array(z.string().trim().min(1, "Identifiant requis."))
      .min(1, "Au moins une recette requise."),
  })
  .strict();

const recipeIdSchema = z
  .object({
    id: z.string().trim().min(1, "Identifiant requis."),
  })
  .strict();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toUserMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Données invalides.";
  }
  if (error instanceof Error) return error.message;
  return "Erreur inconnue.";
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Réordonne les recettes selon la liste d'IDs fournie. Chaque recette
 * reçoit `displayOrder = index`. L'opération est atomique (transaction).
 */
export async function updateRecipeDisplayOrderAction(
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    const { orderedIds: ids } = reorderSchema.parse({ orderedIds });

    // Garde-fou : détecter les doublons (sinon deux updates sur le même ID).
    if (new Set(ids).size !== ids.length) {
      throw new Error("Liste d'identifiants invalide (doublons).");
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.recipe.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/**
 * Supprime une recette. Les relations (RecipeIngredient, Step,
 * CategoryToRecipe, TagToRecipe) sont supprimées en cascade.
 */
export async function deleteRecipeAction(id: string): Promise<ActionResult> {
  try {
    const parsed = recipeIdSchema.parse({ id });
    await prisma.recipe.delete({ where: { id: parsed.id } });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}