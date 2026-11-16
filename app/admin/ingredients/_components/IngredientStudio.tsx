/*
path :           app/admin/ingredients/_components/IngredientStudio.tsx
tag :            ["admin", "ingredient", "studio", "form", "json", "client", "bidirectional", "conflict"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Orchestrateur UX du formulaire multi-ingrédients.
                 Fusionne en UNE seule vue :
                 - un formulaire dynamique de brouillons (1+ cartes
                   IngredientDraftCard, bouton "+ Ajouter un ingrédient"),
                 - un textarea JSON bidirectionnel :
                   → le formulaire met à jour le JSON via une DÉRIVATION
                     (`useMemo`) — pas de useEffect ni de state parallèle,
                   → coller/éditer du JSON dans le textarea bascule sur un
                     state local `jsonOverride` qui remplace la dérivation
                     tant que l'utilisateur n'a pas re-modifié le form,
                 - un bouton "Charger l'existant" qui pré-remplit le
                   formulaire et le JSON avec les ingrédients actuellement
                   en base (édition en masse),
                 - un calcul en temps réel des conflits :
                   "nouveau" (slug absent), "mise à jour" (slug existant,
                   sera écrasé), "doublon" (slug saisi 2× dans le form),
                 - un bouton "Enregistrer" unique qui envoie TOUT au
                   serveur (importIngredientsFromPasteAction : upsert DB
                   + réécriture data/ingredients/ingredients.json).
                 Enregistrer est désactivé s'il reste des doublons.
                 Accepte une prop optionnelle `initialDrafts` pour
                 pré-remplir le formulaire (édition d'une ligne existante
                 déclenchée par le parent).

                 ⚠️ Pas de useEffect qui appelle setState : le JSON
                 affiché est une dérivation pure de `drafts`. Un override
                 optionnel couvre le cas de l'édition manuelle.

flow:            Props existingRows + initialDrafts? + onSaved →
                 useState(drafts) + useState(jsonOverride | null) +
                 useState(jsonError) → useMemo(computedJson depuis drafts)
                 → jsonDisplayed = jsonOverride ?? computedJson →
                 handleJsonChange(next) :
                   - setJsonOverride(next)
                   - JSON.parse + safeParse
                   - si valide : setDrafts(parsed) + clear jsonOverride +
                     clear error
                   - si invalide : garder override + set error
                 updateDraft / addDraft / removeDraft / resetAll :
                   toute modification du form clear jsonOverride (retour
                   à la dérivation).
                 loadExisting : remplace drafts + clear jsonOverride.
                 Enregistrer → importIngredientsFromPasteAction(valid
                 drafts) → toast + onSaved() + reset.

ecosystem:       Ingredient = [
                   "@/app/admin/ingredients/_actions.ts",
                   "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                   "@/app/admin/ingredients/_components/IngredientStudio.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                   "@/app/admin/ingredients/page.tsx",
                   "@/lib/validations/ingredient.ts",
                   "@/lib/validations/ingredient-paste.ts",
                 ]

relatedFiles:    ["@/app/admin/_actions/json-export.ts",
                  "@/app/admin/ingredients/_components/IngredientDraftCard.tsx",
                  "@/lib/validations/ingredient-paste.ts"]

imports:         ["react",
                  "lucide-react",
                  "sonner",
                  "@/app/admin/_actions/json-export",
                  "@/app/admin/ingredients/_components/IngredientDraftCard",
                  "@/lib/validations/ingredient-paste",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/textarea"]

exports:         ["IngredientStudio",
                  "IngredientStudioProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux ajouter plusieurs ingrédients et voir le JSON en temps réel",
                  "*en tant qu'admin je veux coller un JSON et le voir remplir le formulaire",
                  "*en tant qu'admin je veux être averti des conflits de slug avant enregistrement",
                  "*en tant qu'admin je veux charger l'existant pour le modifier en masse"]
status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useMemo, useTransition, textarea contrôlé.

import { useMemo, useState, useTransition } from "react";
import {
  Download,
  FileJson2,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { importIngredientsFromPasteAction } from "@/app/admin/_actions/json-export";
import {
  IngredientDraftCard,
  createEmptyDraft,
  draftToJson,
  getDraftStatus,
  jsonToDraft,
  rowToDraft,
  type DraftConflict,
  type ExistingIngredientRow,
  type IngredientDraft,
} from "@/app/admin/ingredients/_components/IngredientDraftCard";
import { ingredientPasteSchema } from "@/lib/validations/ingredient-paste";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientStudioProps {
  readonly existingRows: readonly ExistingIngredientRow[];
  /**
   * Brouillons initiaux optionnels. Utilisé par le parent (Manager) pour
   * pré-remplir le Studio quand l'utilisateur clique "Éditer" sur une
   * ligne existante. Si absent ou vide, une carte vide est créée.
   */
  readonly initialDrafts?: readonly IngredientDraft[];
  readonly onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientStudio({
  existingRows,
  initialDrafts,
  onSaved,
}: IngredientStudioProps) {
  const [drafts, setDrafts] = useState<IngredientDraft[]>(() =>
    initialDrafts && initialDrafts.length > 0
      ? [...initialDrafts]
      : [createEmptyDraft()],
  );
  /**
   * Override manuel du textarea JSON. `null` = affichage dérivé de
   * `drafts` (mode formulaire). Non-null = l'utilisateur a tapé ou collé
   * du JSON ; cet override prime tant qu'il n'y a pas de modification du
   * formulaire. Évite tout `useEffect` + `setState`.
   */
  const [jsonOverride, setJsonOverride] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Slugs présents en base (utilisés pour calculer les conflits).
  const existingSlugs = useMemo(
    () => new Set(existingRows.map((r) => r.slugIngredient)),
    [existingRows],
  );

  /* ---------------------- Statut / conflits ----------------------- */

  const draftStates = useMemo(() => {
    const slugCount = new Map<string, number>();
    for (const d of drafts) {
      if (d.slug.trim() === "") continue;
      slugCount.set(d.slug, (slugCount.get(d.slug) ?? 0) + 1);
    }

    return drafts.map((draft) => {
      const status = getDraftStatus(draft);
      let conflict: DraftConflict;

      if (status === "incomplete") {
        conflict = "invalid";
      } else if ((slugCount.get(draft.slug) ?? 0) > 1) {
        conflict = "duplicate";
      } else if (existingSlugs.has(draft.slug)) {
        conflict = "existing";
      } else {
        conflict = "new";
      }

      return { draft, status, conflict };
    });
  }, [drafts, existingSlugs]);

  const counts = useMemo(() => {
    let created = 0;
    let updated = 0;
    let duplicates = 0;
    let invalids = 0;
    for (const s of draftStates) {
      if (s.conflict === "new") created += 1;
      else if (s.conflict === "existing") updated += 1;
      else if (s.conflict === "duplicate") duplicates += 1;
      else invalids += 1;
    }
    return { created, updated, duplicates, invalids };
  }, [draftStates]);

  const validDrafts = useMemo(
    () => draftStates.filter((s) => s.status === "valid").map((s) => s.draft),
    [draftStates],
  );

  const canSave =
    validDrafts.length > 0 && counts.duplicates === 0 && !isPending;

  /* -------------------- JSON dérivé (sans effet) ------------------ */

  /**
   * JSON canonique calculé depuis `drafts` : c'est la VÉRITÉ affichée
   * quand l'utilisateur n'a pas édité le textarea manuellement.
   */
  const computedJson = useMemo(() => {
    const items = validDrafts.map(draftToJson);
    return JSON.stringify(items, null, 2);
  }, [validDrafts]);

  /** Valeur affichée dans le textarea : override manuel ou dérivation. */
  const jsonDisplayed = jsonOverride ?? computedJson;

  /* -------------------- JSON → drafts (collage) ------------------- */

  /**
   * Changement manuel du textarea. On tente de parser :
   *  - succès → on REMPLACE les drafts par le JSON parsé, on clear
   *    l'override (la dérivation reprend), on clear l'erreur.
   *  - échec  → on garde l'override (le texte tapé reste affiché) et on
   *    affiche l'erreur.
   * Aucun setState dans un effet : tout se passe dans un handler.
   */
  function handleJsonChange(next: string) {
    setJsonOverride(next);

    if (next.trim() === "") {
      setJsonError(null);
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(next);
    } catch (error) {
      setJsonError(
        error instanceof Error
          ? `JSON invalide : ${error.message}`
          : "JSON invalide.",
      );
      return;
    }

    const parsed = ingredientPasteSchema.safeParse(parsedJson);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path =
        issue && Array.isArray(issue.path) && issue.path.length > 0
          ? ` (${issue.path.join(".")})`
          : "";
      setJsonError(`${issue?.message ?? "Schéma invalide."}${path}`);
      return;
    }

    // JSON valide → applique et repasse en mode "dérivation".
    setJsonError(null);
    setJsonOverride(null);
    setDrafts(
      parsed.data.ingredients.map((item) =>
        jsonToDraft(item as Record<string, unknown>),
      ),
    );
  }

  /* --------------------------- Drafts ----------------------------- */

  /**
   * Toute modification du formulaire remet le textarea en mode dérivé :
   * l'override manuel est jeté pour que le JSON affiché reflète le form.
   */
  function updateDraft(key: string, patch: Partial<IngredientDraft>) {
    setJsonOverride(null);
    setJsonError(null);
    setDrafts((current) =>
      current.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );
  }

  function addDraft() {
    setJsonOverride(null);
    setJsonError(null);
    setDrafts((current) => [...current, createEmptyDraft()]);
  }

  function removeDraft(key: string) {
    setJsonOverride(null);
    setJsonError(null);
    setDrafts((current) => {
      if (current.length <= 1) return current;
      return current.filter((d) => d.key !== key);
    });
  }

  function resetAll() {
    setJsonOverride(null);
    setJsonError(null);
    setDrafts([createEmptyDraft()]);
  }

  /* ---------------------- Charger l'existant ---------------------- */

  function loadExisting() {
    if (existingRows.length === 0) {
      toast.error("Aucun ingrédient existant en base.");
      return;
    }
    setJsonOverride(null);
    setJsonError(null);
    setDrafts(existingRows.map(rowToDraft));
    toast.success(
      `${existingRows.length} ingrédient(s) chargé(s) dans le formulaire.`,
    );
  }

  /* --------------------------- Enregistrer ------------------------ */

  function handleSave() {
    if (!canSave) return;

    const items = validDrafts.map(draftToJson);

    startTransition(async () => {
      const response = await importIngredientsFromPasteAction(items);
      if (response.ok) {
        const { created, updated, total } = response.data;
        toast.success(
          `${total} ingrédient(s) enregistré(s) · ${created} créé(s), ${updated} mis à jour.`,
        );
        resetAll();
        onSaved();
      } else {
        toast.error(response.error);
      }
    });
  }

  /* ------------------------------ Rendu --------------------------- */

  return (
    <section className="space-y-6 rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
      {/* En-tête */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            Ajouter des ingrédients
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Remplissez une ou plusieurs cartes, ou collez directement du
            JSON ci-dessous. Le formulaire et le JSON sont synchronisés.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {counts.created > 0 && (
            <Badge
              variant="outline"
              className="tabular-nums border-chart-4/40 bg-chart-4/10 text-chart-4"
            >
              {counts.created} nouveau{counts.created > 1 ? "x" : ""}
            </Badge>
          )}
          {counts.updated > 0 && (
            <Badge
              variant="outline"
              className="tabular-nums border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            >
              {counts.updated} màj
            </Badge>
          )}
          {counts.duplicates > 0 && (
            <Badge
              variant="outline"
              className="tabular-nums border-destructive/40 bg-destructive/10 text-destructive"
            >
              {counts.duplicates} doublon{counts.duplicates > 1 ? "s" : ""}
            </Badge>
          )}
          {counts.invalids > 0 && (
            <Badge variant="outline" className="tabular-nums">
              {counts.invalids} incomplet{counts.invalids > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </header>

      {/* Actions secondaires */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadExisting}
          disabled={isPending || existingRows.length === 0}
        >
          <Download className="size-4" aria-hidden />
          Charger l&apos;existant ({existingRows.length})
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetAll}
          disabled={isPending}
        >
          <RotateCcw className="size-4" aria-hidden />
          Réinitialiser
        </Button>
      </div>

      {/* Cartes de brouillon */}
      <div className="space-y-3">
        {drafts.map((draft, index) => {
          const state = draftStates[index];
          return (
            <IngredientDraftCard
              key={draft.key}
              draft={draft}
              index={index}
              canRemove={drafts.length > 1}
              status={state.status}
              conflict={state.conflict}
              onChange={(patch) => updateDraft(draft.key, patch)}
              onRemove={() => removeDraft(draft.key)}
            />
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addDraft}
        disabled={isPending}
        className="w-full border-dashed"
      >
        <Plus className="size-4" aria-hidden />
        Ajouter un ingrédient
      </Button>

      {/* JSON synchronisé */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileJson2
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-foreground">
              JSON (synchronisé)
            </h3>
            <Badge variant="outline" className="text-[10px]">
              bidirectionnel
            </Badge>
            {jsonOverride !== null && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              >
                édition manuelle
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Formulaire → JSON · Coller du JSON → remplit le formulaire
          </p>
        </div>

        <Textarea
          value={jsonDisplayed}
          onChange={(event) => handleJsonChange(event.target.value)}
          spellCheck={false}
          rows={12}
          aria-label="JSON éditable des ingrédients"
          className="field-sizing-fixed h-[280px] w-full resize-none overflow-y-auto font-mono text-xs"
        />

        {jsonError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {jsonError}
          </p>
        )}
      </div>

      {/* Actions principales */}
      <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {canSave
            ? "Prêt à enregistrer. Le JSON sera réécrit côté serveur."
            : counts.duplicates > 0
              ? "Corrigez les slugs en double avant d'enregistrer."
              : "Remplissez au moins un ingrédient valide (nom + slug)."}
        </p>
        <Button type="button" onClick={handleSave} disabled={!canSave}>
          {isPending ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="mr-2 size-4" aria-hidden />
          )}
          {isPending
            ? "Enregistrement…"
            : `Enregistrer${validDrafts.length > 0 ? ` (${validDrafts.length})` : ""}`}
        </Button>
      </div>
    </section>
  );
}