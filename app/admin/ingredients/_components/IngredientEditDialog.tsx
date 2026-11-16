/*
path :           app/admin/ingredients/_components/IngredientEditDialog.tsx
tag :            ["admin", "ingredient", "edit", "dialog", "client", "single-item"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Dialog d'édition d'UN ingrédient existant. Utilise
                 directement <IngredientDraftCard /> (composant
                 contrôlé d'une seule carte) plutôt que le Studio
                 complet — plus simple, pas de JSON, pas de
                 multi-items. Pré-remplit depuis la ligne Prisma via
                 rowToDraft. À la sauvegarde, appelle
                 importIngredientsFromPasteAction avec un tableau
                 d'un seul item (upsert par slug) — comportement
                 identique au Studio.

flow:            Props ingredient (ou null) + open + onOpenChange +
                 onSaved → useEffect (ingredient change) → setDraft
                 (rowToDraft) → rend <Dialog> → <IngredientDraftCard
                 canRemove={false} conflict="existing" /> → bouton
                 Enregistrer → importIngredientsFromPasteAction([
                 draftToJson(draft)]) → toast + onOpenChange(false) +
                 onSaved().

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
                  "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                  "@/components/ui/dialog.tsx"]

imports:         ["react",
                  "sonner",
                  "@/app/admin/_actions/json-export",
                  "@/app/admin/ingredients/_components/IngredientDraftCard",
                  "@/components/ui/dialog",
                  "@/components/ui/button"]

exports:         ["IngredientEditDialog",
                  "IngredientEditDialogProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux éditer un ingrédient dans un Dialog"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useEffect, useTransition, Dialog.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { importIngredientsFromPasteAction } from "@/app/admin/_actions/json-export";
import {
  IngredientDraftCard,
  draftToJson,
  getDraftStatus,
  rowToDraft,
  type ExistingIngredientRow,
  type IngredientDraft,
} from "@/app/admin/ingredients/_components/IngredientDraftCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientEditDialogProps {
  readonly ingredient: ExistingIngredientRow | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientEditDialog({
  ingredient,
  open,
  onOpenChange,
  onSaved,
}: IngredientEditDialogProps) {
  const [draft, setDraft] = useState<IngredientDraft | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (ingredient) {
      setDraft(rowToDraft(ingredient));
    } else {
      setDraft(null);
    }
  }, [ingredient]);

  function handleSave() {
    if (!draft) return;
    startTransition(async () => {
      const response = await importIngredientsFromPasteAction([
        draftToJson(draft),
      ]);
      if (response.ok) {
        toast.success(`Ingrédient « ${draft.name} » enregistré.`);
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(response.error);
      }
    });
  }

  const status = draft ? getDraftStatus(draft) : "incomplete";
  const canSave = status === "valid" && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Éditer : {ingredient?.name ?? "ingrédient"}</DialogTitle>
          <DialogDescription>
            Modifiez les champs puis enregistrez. Le slug existant est mis
            à jour (upsert). Changer le slug créera un nouvel ingrédient et
            conservera l&apos;ancien.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <IngredientDraftCard
            draft={draft}
            index={0}
            canRemove={false}
            status={status}
            conflict="existing"
            onChange={(patch) =>
              setDraft((current) => (current ? { ...current, ...patch } : current))
            }
            onRemove={() => {
              /* désactivé via canRemove={false} */
            }}
          />
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}