/*
path :           components/header/dataNav.ts
tag :            ["header", "nav", "data", "navigation", "config"]
projectId:       <recipe-miam>
type:            config
generic:         false

role:            Source de vérité de la navigation du header. Liste les
                 items principaux (href, libellé, icône, description) et
                 leurs children optionnels (même structure). Consommé par
                 Nav.tsx (desktop et mobile) et Header.tsx. Aucune
                 dépendance runtime, aucun effet.

flow:            Module TypeScript pur → export de NAV_ITEMS (as const via
                 readonly) et des types NavItem / NavChild. Chaque item
                 peut être un lien direct (children absent/vide) ou un
                 déclencheur de sous-menu (children non vide).

ecosystem:       Header = [
                   "@/components/header/Nav.tsx",
                   "@/components/header/dataNav.ts",
                 ]

relatedFiles:    ["@/components/header/Nav.tsx"]

imports:         ["lucide-react"]

exports:         ["NAV_ITEMS", "NavItem", "NavChild"]

useBy:           ["@/components/header/Nav.tsx"]

userStories:     ["*en tant qu'utilisateur je veux une navigation claire et hiérarchisée"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ClipboardCopy,
  FilePlus2,
  FolderTree,
  Home,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NavChild {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
  readonly icon?: LucideIcon;
}

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
  readonly icon?: LucideIcon;
  readonly children?: readonly NavChild[];
}

/* ------------------------------------------------------------------ */
/*  Données — alignées sur les routes réelles du projet               */
/* ------------------------------------------------------------------ */

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Accueil",
    href: "/",
    description: "Retour à la page d'accueil",
    icon: Home,
    children: [
    ],
  },
      {
        label: "Recettes",
        href: "/recipes",
        description: "Parcourir le catalogue de recettes",
        icon: UtensilsCrossed,
      },
  {
    label: "Genesis",
    href: "/genesis",
    description: "Outils de développement du projet",
    icon: Sparkles,
    children: [
      {
        label: "SelectFiles",
        href: "/genesis/read-files",
        description: "Lire l'arbre et le contenu des fichiers",
        icon: FolderTree,
      },
      {
        label: "CreateFiles",
        href: "/genesis/create-files",
        description: "Coller et écrire des scripts dans le projet",
        icon: FilePlus2,
      },
      {
        label: "CopyToIA",
        href: "/genesis/copy-to-ia",
        description: "Assembler un contexte prêt pour une IA",
        icon: ClipboardCopy,
      },
      {
        label: "Aide",
        href: "/genesis/help",
        description: "Mode d'emploi des trois outils",
        icon: BookOpen,
      },
    ],
  },
];