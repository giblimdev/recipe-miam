
/*
path:            app/recipes/layout.tsx
tag:             ["recipes", "layout", "header", "public"]
projectId:       <recipe-miam>
type:            layout
generic:         false

role:            Layout du catalogue public des recettes. Affiche le
                 Header principal puis fournit une zone de contenu
                 extensible aux pages du module Recettes.

flow:            Server Component → Header → main flex-1 → children.

relatedFiles:    ["@/components/header/Header",
                  "@/app/recipes/page.tsx"]

imports:         ["react",
                  "@/components/header/Header"]

exports:         ["default RecipesLayout"]

useBy:           ["@/app/recipes/page.tsx"]
*/

import type { ReactNode } from "react";

import Header from "@/components/header/Header";

interface RecipesLayoutProps {
  readonly children: ReactNode;
}

export default function RecipesLayout({
  children,
}: RecipesLayoutProps) {
  return (
    <>
      <Header />

      <main className="flex-1 bg-gradient-to-b from-background via-background to-muted/30">
        {children}
      </main>
    </>
  );
}
