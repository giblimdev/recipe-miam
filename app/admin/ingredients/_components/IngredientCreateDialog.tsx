/*
path :           app/admin/ingredients/_components/IngredientCreateDialog.tsx
tag :            ["admin", "ingredient", "create", "dialog", "client"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Dialog conteneur du Studio de création multi-ingrédients.
                 Wrappe <IngredientStudio /> avec une mise en page
                 adaptée au Dialog (largeur sm:max-w-3xl, hauteur
                 max 90vh, scroll interne). Le Studio conserve toute
                 sa logique (form + JSON bidirectionnel + conflits).
                 À la sauvegarde réussie, on ferme le Dialog et on
                 rafraîchit la page via le callback onSaved du parent.

flow:            Props open + onOpenChange + existingRows + onSaved
                 → rend <Dialog> → <DialogContent> avec en-tête →
                 <IngredientStudio existingRows onSaved={handleSaved} />
                 → handleSaved : onOpenChange(false) + onSaved().

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

relatedFiles:    ["@/app/admin/ingredients/_components/IngredientStudio.tsx",
                  "@/components/ui/dialog.tsx"]

imports:         ["@/app/admin/ingredients/_components/IngredientStudio",
                  "@/app/admin/ingredients/_components/IngredientDraftCard",
                  "@/components/ui/dialog"]

exports:         ["IngredientCreateDialog",
                  "IngredientCreateDialogProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux ajouter un ingrédient via un bouton"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : Dialog contrôlé + Studio client.

import { IngredientStudio } from "@/app/admin/ingredients/_components/IngredientStudio";
import type { ExistingIngredientRow } from "@/app/admin/ingredients/_components/IngredientDraftCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientCreateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly existingRows: readonly ExistingIngredientRow[];
  readonly onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientCreateDialog({
  open,
  onOpenChange,
  existingRows,
  onSaved,
}: IngredientCreateDialogProps) {
  function handleSaved() {
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouveaux ingrédients</DialogTitle>
          <DialogDescription>
            Ajoutez un ou plusieurs ingrédients via le formulaire, ou
            collez directement du JSON. Les slugs existants seront mis à
            jour (écrasement).
          </DialogDescription>
        </DialogHeader>

        {open && (
          <IngredientStudio
            existingRows={existingRows}
            onSaved={handleSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}