/*
path :           app/genesis/layout.tsx
tag :            ["genesis", "layout", "header"]
projectId:       new-genesis
type:            layout
generic:         false

role:            Layout du module Genesis. Fournit le Header public
                 commun, puis un conteneur avec fond dégradé, un titre
                 de module, la nav GenesisNav et la zone de contenu.
                 Indépendant de app/core/ : ne consomme que
                 @/components/ui, le Header commun et le module Genesis
                 lui-même.

flow:            Server Component → <Header /> → wrapper `flex-1` (fond
                 dégradé) → conteneur max-w-7xl → header (titre) +
                 GenesisNav + children. `flex-1` s'appuie sur le `body`
                 `flex flex-col` du root layout pour occuper l'espace
                 restant sans déborder du viewport (remplace le
                 `min-h-svh` d'origine, incompatible avec la présence
                 d'un Header au-dessus).

ecosystem:       Genesis = [
                   "@/app/genesis/actions/exclusions.ts",
                   "@/app/genesis/actions/read-files.ts",
                   "@/app/genesis/actions/write-files.ts",
                   "@/app/genesis/components/CreateFilesPanel.tsx",
                   "@/app/genesis/components/ExclusionsDialog.tsx",
                   "@/app/genesis/components/FileTree.tsx",
                   "@/app/genesis/components/FileTreeRow.tsx",
                   "@/app/genesis/components/GenesisNav.tsx",
                   "@/app/genesis/components/ReadFilesPanel.tsx",
                   "@/app/genesis/components/ResultDialog.tsx",
                   "@/app/genesis/components/ScriptInput.tsx",
                   "@/app/genesis/components/ScriptQueue.tsx",
                   "@/app/genesis/components/ScriptQueueItem.tsx",
                   "@/app/genesis/components/WriteReport.tsx",
                   "@/app/genesis/create-files/page.tsx",
                   "@/app/genesis/layout.tsx",
                   "@/app/genesis/lib/exclusions.ts",
                   "@/app/genesis/lib/parse-script.ts",
                   "@/app/genesis/lib/storage.ts",
                   "@/app/genesis/lib/tree.ts",
                   "@/app/genesis/lib/types.ts",
                   "@/app/genesis/lib/validations.ts",
                   "@/app/genesis/lib/write-scripts.ts",
                   "@/app/genesis/page.tsx",
                   "@/app/genesis/read-files/page.tsx",
                 ]

relatedFiles:    ["@/app/genesis/components/GenesisNav.tsx",
                  "@/components/header/Header.tsx"]

imports:         ["@/app/genesis/components/GenesisNav",
                  "@/components/header/Header"]

exports:         ["default GenesisLayout"]

useBy:           []

userStories:     ["*en tant que développeur je veux un layout cohérent pour le module Genesis"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { GenesisNav } from "@/app/genesis/components/GenesisNav";
import Header from "@/components/header/Header";

export default function GenesisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="flex-1 bg-gradient-to-b from-background via-background to-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <header className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-chart-2">
                Outils de développement
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Genesis
                </h1>
                <p className="max-w-md text-sm text-muted-foreground">
                  Lire le projet, sélectionner du contexte pour l&apos;IA, injecter
                  des scripts générés.
                </p>
              </div>
            </header>

            <GenesisNav />

            <div className="pt-2">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}