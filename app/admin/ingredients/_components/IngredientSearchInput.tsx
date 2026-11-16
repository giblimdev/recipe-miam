/*
path :           app/admin/ingredients/_components/IngredientSearchInput.tsx
tag :            ["admin", "ingredient", "filter", "search", "client", "debounce"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Input de recherche debouncé (300 ms) qui pousse ?q=
                 dans l'URL via router.replace (pas push : pas de
                 pollution de l'historique). La valeur initiale est
                 relue depuis ?q=. Affiche un spinner discret pendant
                 la transition et un bouton X pour vider rapidement.
                 Aucune logique métier : le filtrage se fait côté
                 serveur via Prisma dans page.tsx.

flow:            Reçoit initialValue (depuis searchParams côté
                 serveur) → useState(value) → useEffect (debounce
                 300 ms) → si value !== ?q= actuel → construit
                 URLSearchParams à partir de searchParams courants →
                 set/delete q → router.replace(URL) dans
                 startTransition. Guard "value === currentQ" empêche
                 toute boucle.

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

relatedFiles:    ["@/app/admin/ingredients/_components/IngredientToolbar.tsx",
                  "@/components/ui/input.tsx",
                  "@/components/ui/button.tsx"]

imports:         ["react",
                  "next/navigation",
                  "lucide-react",
                  "@/components/ui/input",
                  "@/components/ui/button"]

exports:         ["IngredientSearchInput",
                  "IngredientSearchInputProps"]

useBy:           ["@/app/admin/ingredients/_components/IngredientToolbar.tsx"]

userStories:     ["*en tant qu'admin je veux rechercher un ingrédient par nom"]

status:          planned
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useEffect, useTransition, router.

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IngredientSearchInputProps {
  /** Valeur initiale lue côté serveur depuis ?q=. */
  readonly initialValue: string;
}

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

const DEBOUNCE_MS = 300;
const BASE_PATH = "/admin/ingredients";

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function IngredientSearchInput({
  initialValue,
}: IngredientSearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(initialValue);

  // Synchronisation si l'URL change ailleurs (ex. reset filters).
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Debounce → push URL.
  useEffect(() => {
    const currentQ = searchParams.get("q") ?? "";
    if (value === currentQ) return;

    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed === "") params.delete("q");
      else params.set("q", trimmed);

      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [value, searchParams, router]);

  function clear() {
    setValue("");
  }

  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        inputMode="search"
        placeholder="Rechercher un ingrédient…"
        aria-label="Rechercher un ingrédient par nom"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="pl-9 pr-9"
        maxLength={120}
        autoComplete="off"
      />
      {value !== "" && !isPending && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={clear}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label="Effacer la recherche"
        >
          <X className="size-4" aria-hidden />
        </Button>
      )}
      {isPending && (
        <LoaderCircle
          className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      )}
    </div>
  );
}