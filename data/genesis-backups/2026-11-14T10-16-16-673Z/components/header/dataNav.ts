/*
path :           components/header/dataNav.ts
tag :            ["header", "nav", "data", "navigation"]
projectId:       <recipe-miam>
type:            config
generic:         false

role:            Données de navigation du header. Liste des items
                 principaux avec lien, libellé, icône et children
                 optionnels. Sert de source de vérité pour Nav.tsx
                 (desktop) et pour le menu mobile. Aucune dépendance
                 runtime, aucun effet.

flow:            Module TypeScript pur → export de NAV_ITEMS et des
                 types NavItem, NavChild.

ecosystem:       Header = [
                   "@/components/header/dataNav.ts",
                   "@/components/header/Nav.tsx",
                   "@/components/header/Header.tsx",
                 ]

relatedFiles:    ["@/components/header/Nav.tsx",
                  "@/components/header/Header.tsx"]

imports:         ["lucide-react"]

exports:         ["NAV_ITEMS", "NavItem", "NavChild"]

useBy:           ["@/components/header/Nav.tsx"]

userStories:     ["*en tant qu'utilisateur je veux voir une navigation claire et hiérarchisée"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import type { LucideIcon } from "lucide-react";
import {
  Home,
  Sparkles,
  FolderTree,
  FilePlus2,
  ClipboardCopy,
  BookOpen,
  UtensilsCrossed,
} from "lucide-react";

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

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Accueil",
    href: "/",
    description: "Retour à la page d'accueil",
    icon: Home,
    children: [
      {
        label: "Recettes",
        href: "/recipes",
        description: "Parcourir toutes les recettes",
        icon: UtensilsCrossed,
      },
    ],
  },
  {
    label: "Genesis",
    href: "/genesis",
    description: "Outils de développement",
    icon: Sparkles,
    children: [
      {
        label: "SelectFiles",
        href: "/genesis/read-files",
        description: "Lire les fichiers du projet",
        icon: FolderTree,
      },
      {
        label: "CreateFiles",
        href: "/genesis/create-files",
        description: "Écrire des scripts dans le projet",
        icon: FilePlus2,
      },
      {
        label: "CopyToIA",
        href: "/genesis/copy-to-ia",
        description: "Contexte prêt à coller dans une IA",
        icon: ClipboardCopy,
      },
      {
        label: "Aide",
        href: "/genesis/help",
        description: "Mode d'emploi des outils",
        icon: BookOpen,
      },
    ],
  },
];