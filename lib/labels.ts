/*
path :           lib/labels.ts
tag :            ["labels", "i18n", "enum", "fr", "helper"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Centralise les libellés français des enums Prisma
                 (Unit, Difficulty, IngredientType, AllergenCode). Évite
                 d'afficher les codes bruts ("TEASPOON", "GLUTEN") dans
                 l'UI. Tolérant aux typos historiques du schéma :
                 "LIQUIDR" et "FRUIT_DE_MER" coexistent avec leurs
                 formes corrigées ("LIQUIDE", "FRUITS_DE_MER") pour
                 permettre une migration progressive sans casse UI.

flow:            Module TypeScript pur → export des Records de labels
                 + types utilitaires. Aucune dépendance runtime, aucun
                 effet.

ecosystem:       Core = [
                   "@/lib/labels.ts",
                   "@/lib/prisma.ts",
                   "@/lib/utils.ts",
                 ]

relatedFiles:    ["@/lib/generated/prisma/enums"]

imports:         ["@/lib/generated/prisma/enums"]

exports:         ["UNIT_LABELS",
                  "DIFFICULTY_LABELS",
                  "INGREDIENT_TYPE_LABELS",
                  "ALLERGEN_LABELS",
                  "IngredientTypeLabel"]

useBy:           []

userStories:     ["*en tant qu'utilisateur je veux voir des libellés français au lieu des codes enum"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import type {
  AllergenCode,
  Difficulty,
  Unit,
} from "@/lib/generated/prisma/enums";

/* ------------------------------------------------------------------ */
/*  Unit                                                               */
/* ------------------------------------------------------------------ */

export const UNIT_LABELS: Record<Unit, string> = {
  GRAM: "g",
  KILOGRAM: "kg",
  MILLILITER: "ml",
  CENTILITER: "cl",
  LITER: "l",
  TEASPOON: "c. à c.",
  TABLESPOON: "c. à s.",
  CUP: "tasse",
  PIECE: "pièce",
  PINCH: "pincée",
  CLOVE: "gousse",
  SLICE: "tranche",
  BUNCH: "botte",
};

/* ------------------------------------------------------------------ */
/*  Difficulty                                                         */
/* ------------------------------------------------------------------ */

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Facile",
  MEDIUM: "Moyen",
  HARD: "Difficile",
};

/* ------------------------------------------------------------------ */
/*  IngredientType                                                     */
/* ------------------------------------------------------------------ */

/**
 * Union exhaustive des valeurs possibles : inclut les noms historiques
 * (LIQUIDR, FRUIT_DE_MER) tant que le schéma n'a pas été migré, et les
 * formes corrigées (LIQUIDE, FRUITS_DE_MER) pour l'après-migration.
 * Une fois la migration faite, retirer les alias marqués `@deprecated`.
 */
export type IngredientTypeLabel =
  | "LEGUME"
  | "FRUIT"
  | "VIANDE"
  | "POISSON"
  | "FRUIT_DE_MER"          // @deprecated — renommer en FRUITS_DE_MER
  | "FRUITS_DE_MER"
  | "OEUF"
  | "PRODUITS_LAITIERS"
  | "FECULENT"
  | "LEGUMINEUSE"
  | "FRUIT_A_COQUE_GRAINES"
  | "EPICE"
  | "HERBE"
  | "MATIERE_GRASSE"
  | "SUCRE"
  | "CONDIMENT"
  | "LIQUIDR"                // @deprecated — renommer en LIQUIDE
  | "LIQUIDE"
  | "AUTRE";

export const INGREDIENT_TYPE_LABELS: Record<IngredientTypeLabel, string> = {
  LEGUME: "Légume",
  FRUIT: "Fruit",
  VIANDE: "Viande",
  POISSON: "Poisson",
  FRUIT_DE_MER: "Fruits de mer",
  FRUITS_DE_MER: "Fruits de mer",
  OEUF: "Œuf",
  PRODUITS_LAITIERS: "Produits laitiers",
  FECULENT: "Féculent",
  LEGUMINEUSE: "Légumineuse",
  FRUIT_A_COQUE_GRAINES: "Fruits à coque & graines",
  EPICE: "Épice",
  HERBE: "Herbe",
  MATIERE_GRASSE: "Matière grasse",
  SUCRE: "Sucre",
  CONDIMENT: "Condiment",
  LIQUIDR: "Liquide",
  LIQUIDE: "Liquide",
  AUTRE: "Autre",
};

/* ------------------------------------------------------------------ */
/*  AllergenCode                                                       */
/* ------------------------------------------------------------------ */

/**
 * Libellés français des 14 allergènes INCO (règlement UE n° 1169/2011,
 * annexe II). L'ordre d'affichage officiel est porté par
 * `Allergen.displayOrder` en DB, pas par ce Record.
 */
export const ALLERGEN_LABELS: Record<AllergenCode, string> = {
  GLUTEN: "Gluten",
  CRUSTACEANS: "Crustacés",
  EGGS: "Œufs",
  FISH: "Poisson",
  PEANUTS: "Arachides",
  SOYBEANS: "Soja",
  MILK: "Lait",
  NUTS: "Fruits à coque",
  CELERY: "Céleri",
  MUSTARD: "Moutarde",
  SESAME: "Sésame",
  SULPHITES: "Sulfites",
  LUPIN: "Lupin",
  MOLLUSCS: "Mollusques",
};