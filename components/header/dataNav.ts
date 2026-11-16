/*
path :           components/header/dataNav.ts
tag :            ["header", "nav", "data", "navigation", "config"]
projectId:       <recipe-miam>
type:            config
generic:         false

role:            Source de vérité de la navigation du header. Expose
                 NAV_ITEMS (items principaux + children optionnels),
                 NAV_SECTIONS (regroupement public / admin) et les types
                 NavItem / NavChild. Consommé par Nav.tsx (desktop et
                 mobile). Aucune dépendance runtime, aucun effet.
                 L'entrée "Synchronisation JSON" expose la page
                 /admin/sync (export/import des fichiers miroirs
                 data/*.json).

                 ⚠️ Items volontairement limités aux routes qui
                 EXISTENT aujourd'hui : /, /genesis/*, /admin/*.
                 Les routes publiques de catalogue (/recettes,
                 /categories, /tags, /ingredients, /allergenes) sont
                 commentées ci-dessous et seront activées au fur et à
                 mesure de leur implémentation, pour éviter les 404.

flow:            Module TypeScript pur → export de NAV_SECTIONS (source
                 de vérité de l'ordre d'affichage) et NAV_ITEMS (index
                 par href). Chaque item peut être un lien direct
                 (children absent/vide) ou un déclencheur de sous-menu
                 (children non vide).

ecosystem:       Header = [
                   "@/components/header/Nav.tsx",
                   "@/components/header/dataNav.ts",
                 ]

relatedFiles:    ["@/components/header/Nav.tsx",
                  "@/app/admin/ingredients/page.tsx",
                  "@/app/admin/sync/page.tsx",
                  "@/app/admin/recipes"]

imports:         ["lucide-react"]

exports:         ["NAV_SECTIONS", "NAV_ITEMS", "NavItem", "NavChild", "NavSection"]

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
  LayoutDashboard,
  Leaf,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Tag,
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
  /** Petit badge optionnel affiché à droite du label (ex. "non protégé"). */
  readonly badge?: string;
  /** Style du badge — sémantique Tailwind (destructive | outline | secondary). */
  readonly badgeVariant?: "destructive" | "outline" | "secondary";
}

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
  readonly icon?: LucideIcon;
  readonly children?: readonly NavChild[];
}

export interface NavSection {
  readonly label?: string;
  readonly items: readonly NavItem[];
}

/* ------------------------------------------------------------------ */
/*  Données                                                            */
/* ------------------------------------------------------------------ */

const PUBLIC_ITEMS: readonly NavItem[] = [
  {
    label: "Accueil",
    href: "/",
    description: "Retour à la page d'accueil",
    icon: Home,
    // ⚠️ Children à ajouter quand les routes publiques existeront :
    //   { label: "Recettes",     href: "/recipes" },
    //   { label: "Catégories",   href: "/categories" },
    //   { label: "Tags",         href: "/tags" },
    //   { label: "Ingrédients",  href: "/ingredients" },
    //   { label: "Allergènes",   href: "/allergenes" },
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

const ADMIN_ITEMS: readonly NavItem[] = [
  {
    label: "Admin",
    href: "/admin",
    description: "Back-office du catalogue",
    icon: LayoutDashboard,
    children: [
      {
        label: "Tableau de bord",
        href: "/admin",
        description: "Vue d'ensemble des entités",
        icon: LayoutDashboard,
      },
      {
        label: "Recettes",
        href: "/admin/recipes",
        description: "Créer et éditer les recettes",
        icon: UtensilsCrossed,
        badge: "non protégé",
        badgeVariant: "destructive",
      },
      {
        label: "Ingrédients",
        href: "/admin/ingredients",
        description: "Catalogue, nutrition et allergènes",
        icon: Leaf,
        badge: "non protégé",
        badgeVariant: "destructive",
      },
      {
        label: "Catégories",
        href: "/admin/category",
        description: "Classement structurel des recettes",
        icon: FolderTree,
      },
      {
        label: "Tags",
        href: "/admin/tag",
        description: "Attributs transversaux (Végétarien, Rapide…)",
        icon: Tag,
      },
      {
        label: "Synchronisation JSON",
        href: "/admin/sync",
        description: "Exporter/importer data/*.json (miroir de la base)",
        icon: RefreshCw,
      },
      {
        label: "Allergènes",
        href: "/admin/allergen",
        description: "Référentiel INCO fixe (14 codes légaux)",
        icon: ShieldAlert,
        badge: "non protégé",
        badgeVariant: "destructive",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Exports publics                                                    */
/* ------------------------------------------------------------------ */

/**
 * Sections dans l'ordre d'affichage. Sur desktop, un Separator est
 * inséré entre chaque section. Sur mobile, un titre de section est
 * rendu au-dessus des items.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  { items: PUBLIC_ITEMS },
  { label: "Administration", items: ADMIN_ITEMS },
];

/** Vue plate — utile pour les tests ou une recherche par href. */
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);