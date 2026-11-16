/*
path :           app/admin/allergen/page.tsx
tag :            ["admin", "allergen", "inco", "table", "server-component"]
projectId:       <recipe-miam>
type:            page
generic:         false

role:            Page admin de consultation des allergènes INCO. Server
                 Component async qui liste les 14 allergènes légaux
                 ordonnés par displayOrder, avec pour chacun : code,
                 nom FR, description, icône (si présente) et nombre
                 d'ingrédients qui le référencent. Lecture seule pour
                 l'instant (aucune Server Action de mutation disponible).
                 ⚠️ Aucune protection d'accès (voir /admin).

flow:            Server Component async → prisma.allergen.findMany({
                 orderBy: { displayOrder: "asc" },
                 include: { _count: { select: { ingredients: true } } }
                 }) → rend breadcrumb + header + bandeau réglementaire
                 + Table (Ordre / Code / Nom / Description / Ingrédients)
                 + état vide si aucun allergène (seed manquant).

ecosystem:       Admin = [
                   "@/app/admin/allergen/page.tsx",
                   "@/app/admin/page.tsx",
                 ]

relatedFiles:    ["@/lib/prisma",
                  "@/lib/labels",
                  "@/components/ui/table",
                  "@/components/ui/badge"]

imports:         ["next/link",
                  "lucide-react",
                  "@/lib/prisma",
                  "@/lib/labels",
                  "@/components/ui/badge",
                  "@/components/ui/table"]

exports:         ["default AdminAllergenPage"]

useBy:           []

userStories:     ["*en tant qu'admin je veux consulter la liste des 14 allergènes INCO"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { ALLERGEN_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function AdminAllergenPage() {
  const allergens = await prisma.allergen.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { ingredients: true } },
    },
  });

  const isEmpty = allergens.length === 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Admin
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-medium text-foreground">Allergènes</span>
      </nav>

      {/* Header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldAlert className="size-3.5" aria-hidden />
            Référentiel
          </span>
          <Badge variant="secondary">INCO · 14 fixés par la loi</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Allergènes
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Les 14 allergènes à déclaration obligatoire, conformément au
          règlement (UE) n° 1169/2011, annexe II. Cette liste est{" "}
          <strong>fixe et encadrée par la loi</strong> — seule la
          présentation (nom, description, icône) est modifiable.
        </p>
      </header>

      {/* Info banner */}
      <div
        role="note"
        className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground"
      >
        <p>
          <strong className="text-foreground">Ordre officiel</strong> :
          les allergènes sont affichés par <code>displayOrder</code>{" "}
          croissant, ce qui doit correspondre à l'ordre de l'annexe II du
          règlement. Ne pas modifier cet ordre sans vérifier la
          conformité réglementaire.
        </p>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
          <ShieldAlert
            className="mx-auto mb-3 size-8 text-muted-foreground"
            aria-hidden
          />
          <h2 className="text-base font-semibold text-foreground">
            Aucun allergène en base
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Le seed initial (14 allergènes INCO) n'a pas encore été
            exécuté. Lancez{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              npx prisma db seed
            </code>{" "}
            pour peupler la table.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Ordre</TableHead>
                <TableHead className="w-40">Code</TableHead>
                <TableHead className="w-40">Nom (FR)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32 text-right">
                  Ingrédients
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allergens.map((allergen) => (
                <TableRow key={allergen.id}>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground tabular-nums">
                    {allergen.displayOrder}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      {allergen.code}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {allergen.name}
                    {ALLERGEN_LABELS[allergen.code] !== allergen.name && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        ({ALLERGEN_LABELS[allergen.code]})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {allergen.description ?? (
                      <span className="italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        allergen._count.ingredients > 0
                          ? "secondary"
                          : "outline"
                      }
                      className="tabular-nums"
                    >
                      {allergen._count.ingredients}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer info */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          {allergens.length} allergène{allergens.length > 1 ? "s" : ""} en
          base · ordre légal respecté
        </p>
        <Link
          href="https://eur-lex.europa.eu/eli/reg/2011/1169/oj"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          Règlement UE n° 1169/2011
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}