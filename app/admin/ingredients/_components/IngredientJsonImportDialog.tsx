/*
path :           app/admin/ingredients/_components/IngredientJsonImportDialog.tsx
tag :            ["admin", "ingredient", "import", "json", "dialog", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Dialog d'import JSON en masse. Textarea unique où
                 l'admin colle un tableau d'items (ou un objet
                 { ingredients: [] }). Validation Zod côté client
                 (ingredientPasteSchema) AVANT envoi → messages
                 d'erreur précis (path + message). À la validation,
                 appelle importIngredientsFromPasteAction. Réutilise
                 intégralement la Server Action du Studio (pas de
                 duplication de logique métier).

flow:            Props open + onOpenChange + onImported → useState
                 (text, error, isPending) → onChange parse + safeParse
                 (feedback temps réel) → bouton Importer :
                 importIngredientsFromPasteAction(parsed) → toast +
                 reset + onOpenChange(false) + onImported().

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientCreateDialog.tsx",
                   "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                   "@/app/admin/ingredients/_components/IngredientEditDialog.tsx",
                   "@/app/admin/ingredients/_components/IngredientGroup.tsx",
                   "@/app/admin/ingredients/_components/IngredientJsonImportDialog.tsx",
                   "@/app/admin/ingredients/_components/IngredientListItem.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/_components/IngredientSearchInput.tsx",
                   "@/app/admin/ingredients/_components/IngredientStudio.tsx",
                   "@/app/admin/ingredients/_components/IngredientToolbar.tsx",
                   "@/app/admin/ingredients/_components/IngredientTypeFilter.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient-filter.ts",
                   "@/lib/validations/ingredient-paste.ts",
                   "@/lib/validations/ingredient.ts",
                 ]

relatedFiles:    ["@/app/admin/_actions/json-export.ts",
                  "@/lib/validations/ingredient-paste.ts",
                  "@/components/ui/dialog.tsx",
                  "@/components/ui/textarea.tsx"]

imports:         ["react",
                  "sonner",
                  "lucide-react",
                  "@/app/admin/_actions/json-export",
                  "@/lib/validations/ingredient-paste",
                  "@/components/ui/dialog",
                  "@/components/ui/textarea",
                  "@/components/ui/button"]

exports:         ["IngredientJsonImportDialog",
                  "IngredientJsonImportDialogProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux coller un tableau JSON d'ingrédients et l'importer"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useTransition, Dialog.

import { useState, useTransition } from "react";
import { FileJson2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { importIngredientsFromPasteAction } from "@/app/admin/_actions/json-export";
import { ingredientPasteSchema } from "@/lib/validations/ingredient-paste";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientJsonImportDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onImported: () => void;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientJsonImportDialog({
  open,
  onOpenChange,
  onImported,
}: IngredientJsonImportDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setText("");
    setError(null);
  }

  function handleChange(next: string) {
    setText(next);
    setError(null);

    if (next.trim() === "") return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch (e) {
      setError(
        e instanceof Error ? `JSON invalide : ${e.message}` : "JSON invalide.",
      );
      return;
    }

    const result = ingredientPasteSchema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path =
        issue && Array.isArray(issue.path) && issue.path.length > 0
          ? ` (${issue.path.join(".")})`
          : "";
      setError(`${issue?.message ?? "Schéma invalide."}${path}`);
    }
  }

  function handleImport() {
    if (text.trim() === "") return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(
        e instanceof Error ? `JSON invalide : ${e.message}` : "JSON invalide.",
      );
      return;
    }

    const validation = ingredientPasteSchema.safeParse(parsed);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      setError(issue?.message ?? "Schéma invalide.");
      return;
    }

    startTransition(async () => {
      const response = await importIngredientsFromPasteAction(validation.data);
      if (response.ok) {
        toast.success(
          `${response.data.total} ingrédient${response.data.total > 1 ? "s" : ""} importé${response.data.total > 1 ? "s" : ""} (${response.data.created} créé${response.data.created > 1 ? "s" : ""}, ${response.data.updated} mis à jour).`,
        );
        reset();
        onOpenChange(false);
        onImported();
      } else {
        toast.error(response.error);
        setError(response.error);
      }
    });
  }

  const canImport = text.trim() !== "" && !error && !isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson2 className="size-5 text-muted-foreground" aria-hidden />
            Importer un JSON d&apos;ingrédients
          </DialogTitle>
          <DialogDescription>
            Collez un tableau JSON d&apos;ingrédients (format miroir ou nu).
            Upsert par slug : les existants sont écrasés, les nouveaux sont
            créés. La validation Zod bloque l&apos;import tant qu&apos;un
            item est invalide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            placeholder={`[\n  {\n    "slug": "farine-de-ble-t55",\n    "name": "Farine de blé T55",\n    "type": "FECULENT",\n    "allergens": ["GLUTEN"]\n  }\n]`}
            className="min-h-[280px] font-mono text-xs"
            spellCheck={false}
            disabled={isPending}
          />
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleImport} disabled={!canImport}>
            {isPending ? "Import en cours…" : "Importer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}