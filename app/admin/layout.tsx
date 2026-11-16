/*
path :           app/admin/layout.tsx
tag :            ["admin", "layout", "header", "nav"]
projectId:       <recipe-miam>
type:            layout
generic:         false

role:            Layout du back-office /admin. Inclut le Header public
                 (importé depuis @/components/header/Header), une barre
                 de contexte « Administration · non protégée » avec
                 lien retour, puis rend les children. Ce layout est
                 volontairement séparé du root layout pour ne PAS
                 imposer la navigation publique au reste de l'app.

flow:            Server Component → <Header /> → bandeau de contexte
                 (icône + texte « non protégée » + lien retour « / ») →
                 <main>{children}</main>.

ecosystem:       Admin = [
                   "@/app/admin/allergen/page.tsx",
                   "@/app/admin/category/_actions.ts",
                   "@/app/admin/category/_components/CategoryManager.tsx",
                   "@/app/admin/category/page.tsx",
                   "@/app/admin/layout.tsx",
                   "@/app/admin/page.tsx",
                   "@/app/admin/tag/_actions.ts",
                   "@/app/admin/tag/_components/TagManager.tsx",
                   "@/app/admin/tag/page.tsx",
                 ]

relatedFiles:    ["@/components/header/Header"]

imports:         ["next/link",
                  "lucide-react",
                  "@/components/header/Header"]

exports:         ["default AdminLayout"]

useBy:           []

userStories:     ["*en tant qu'admin je veux un layout dédié incluant le header"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import Header from "@/components/header/Header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="border-b border-border/60 bg-muted/20">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldAlert className="size-3.5" aria-hidden />
            Administration · non protégée
          </span>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 focus-visible:outline-none"
          >
            <ArrowLeft className="size-3" aria-hidden />
            Retour au site
          </Link>
        </div>
      </div>
      <main>{children}</main>
    </>
  );
}