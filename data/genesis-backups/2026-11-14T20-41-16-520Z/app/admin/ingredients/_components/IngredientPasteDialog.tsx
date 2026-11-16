/*
path :           app/admin/ingredients/_components/IngredientPasteDialog.tsx
tag :            ["admin", "ingredient", "paste", "json", "dialog", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Dialog client d'import par collage de JSON. Permet de
                 coller un TABLEAU NU ou un OBJET { ingredients: [...] },
                 valide le format côté client (Zod) pour un aperçu
                 instantané (nombre d'items valides / en erreur, slugs
                 uniques), puis déclenche importIngredientsFromPasteAction
                 (upsert DB + réécriture data/ingredients/ingredients.json).

flow:            Props open + onOpenChange + onSuccess → useState(text) →
                 useMemo(parseState) : tentative JSON.parse +
                 ingredientPasteSchema.safeParse → 3 états (empty / valid /
                 invalid). Bouton "Importer" désactivé si parseState.kind
                 !== "valid". Clic → importIngredientsFromPasteAction →
                 toast + onSuccess() + onOpenChange(false).

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientForm.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/_components/IngredientPasteDialog.tsx",
                   "@/app/admin/ingredients/new/page.tsx",
                   "@/app/admin/ingredients/[id]/edit/page.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                   "@/lib/validations/ingredient-paste.ts",
                 ]

relatedFiles:    ["@/app/admin/_actions/json-export.ts",
                  "@/lib/validations/ingredient-paste.ts"]

imports:         ["react",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/_actions/json-export",
                  "@/lib/validations/ingredient-paste",
                  "@/components/ui/button",
                  "@/components/ui/dialog",
                  "@/components/ui/textarea"]

exports:         ["IngredientPasteDialog",
                  "IngredientPasteDialogProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux coller un tableau JSON d'ingrédients et l'importer"]
status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useMemo, useTransition, JSON.parse, toasts.

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { importIngredientsFromPasteAction } from "@/app/admin/_actions/json-export";
import { ingredientPasteSchema } from "@/lib/validations/ingredient-paste";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export interface IngredientPasteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
}

type ParseState =
  | { readonly kind: "empty" }
  | {
      readonly kind: "valid";
      readonly count: number;
      readonly slugs: readonly string[];
    }
  | { readonly kind: "invalid"; readonly message: string };

const EXAMPLE = `[
  {
    "slug": "farine-de-ble-t55",
    "name": "Farine de blé T55",
    "type": "FECULENT",
    "image": null,
    "nutrition": {
      "calories": 364,
      "protein": 10,
      "carbohydrates": 76,
      "sugars": 0.5,
      "fat": 1,
      "saturatedFat": 0.2,
      "fiber": 2.7,
      "salt": 0
    },
    "allergens": ["GLUTEN"]
  }
]`;

export function IngredientPasteDialog({
  open,
  onOpenChange,
  onSuccess,
}: IngredientPasteDialogProps) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const parseState = useMemo<ParseState>(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { kind: "empty" };

    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch (error) {
      return {
        kind: "invalid",
        message:
          error instanceof Error
            ? `JSON invalide : ${error.message}`
            : "JSON invalide.",
      };
    }

    const parsed = ingredientPasteSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path =
        issue && Array.isArray(issue.path) && issue.path.length > 0
          ? ` (${issue.path.join(".")})`
          : "";
      return {
        kind: "invalid",
        message: `${issue?.message ?? "Schéma invalide."}${path}`,
      };
    }

    return {
      kind: "valid",
      count: parsed.data.ingredients.length,
      slugs: parsed.data.ingredients.map((i) => i.slug),
    };
  }, [text]);

  function handleClose(next: boolean) {
    if (!next && !isPending) {
      setText("");
    }
    onOpenChange(next);
  }

  function handleImport() {
    if (parseState.kind !== "valid" || isPending) return;

    let json: unknown;
    try {
      json = JSON.parse(text.trim());
    } catch {
      toast.error("JSON invalide.");
      return;
    }

    startTransition(async () => {
      const response = await importIngredientsFromPasteAction(json);
      if (response.ok) {
        const { created, updated, total } = response.data;
        toast.success(
          `${total} ingrédient(s) importé(s) · ${created} créé(s), ${updated} mis à jour.`,
        );
        setText("");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(response.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="size-5 text-chart-4" aria-hidden />
            Coller un tableau d&apos;ingrédients
          </DialogTitle>
          <DialogDescription>
            Collez un <strong>tableau JSON</strong> <code>[ … ]</code> ou un
            objet <code>{`{ "ingredients": [ … ] }`}</code> (format du
            fichier <code>data/ingredients/ingredients.json</code>). Les
            slugs existants seront <strong>mis à jour</strong>, les
            nouveaux seront <strong>créés</strong>. Import atomique : tout
            ou rien.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={14}
            placeholder={EXAMPLE}
            aria-label="Tableau JSON d'ingrédients"
            className="field-sizing-fixed h-[300px] w-full resize-none overflow-y-auto font-mono text-xs"
          />

          {/* Aperçu */}
          <div className="min-h-[2.5rem] rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
            {parseState.kind === "empty" && (
              <span className="text-muted-foreground">
                Collez un JSON pour voir l&apos;aperçu.
              </span>
            )}
            {parseState.kind === "invalid" && (
              <span className="flex items-start gap-2 text-destructive">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                {parseState.message}
              </span>
            )}
            {parseState.kind === "valid" && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5 text-chart-4">
                  <CheckCircle2 className="size-4" aria-hidden />
                  {parseState.count} ingrédient
                  {parseState.count > 1 ? "s" : ""} valide
                  {parseState.count > 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground">
                  {parseState.slugs.length} slug
                  {parseState.slugs.length > 1 ? "s" : ""} unique
                  {parseState.slugs.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setText("")}
            disabled={isPending || text.trim().length === 0}
          >
            Vider
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={parseState.kind !== "valid" || isPending}
            >
              {isPending ? (
                <LoaderCircle
                  className="mr-2 size-4 animate-spin"
                  aria-hidden
                />
              ) : (
                <Upload className="mr-2 size-4" aria-hidden />
              )}
              {isPending ? "Import…" : "Importer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}