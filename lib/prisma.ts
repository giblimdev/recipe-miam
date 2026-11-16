/*
path :           lib/prisma.ts
tag :            ["prisma", "database", "singleton", "server-only", "postgresql"]
projectId:       <recipe-miam>
type:            helper
generic:         true

role:            Singleton PrismaClient pour l'application, configuré
                 pour PostgreSQL via le driver adapter @prisma/adapter-pg
                 (Prisma 7). Réutilise l'instance via globalThis en
                 développement (évite l'épuisement du pool au hot-reload
                 de Next.js). Importable UNIQUEMENT côté serveur
                 (import "server-only" en garde-fou).

flow:            Module load → création paresseuse du client via
                 createPrismaClient() (Pool pg + PrismaPg) → mise en
                 cache globalThis en dev (NODE_ENV !== "production") →
                 export de l'instance `prisma` partagée.

ecosystem:       Core = [
                   "@/lib/labels.ts",
                   "@/lib/prisma.ts",
                   "@/lib/utils.ts",
                 ]

relatedFiles:    ["@/lib/generated/prisma/client",
                  "@/prisma/schema.prisma",
                  "@prisma/adapter-pg"]

imports:         ["server-only",
                  "pg",
                  "@prisma/adapter-pg",
                  "@/lib/generated/prisma/client"]

exports:         ["prisma"]

useBy:           ["@/app/admin/page.tsx",
                  "@/app/admin/allergen/page.tsx"]

userStories:     ["*en tant que développeur je veux un client Prisma singleton et typé pour PostgreSQL"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import "server-only";

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

/* ------------------------------------------------------------------ */
/*  Singleton                                                          */
/* ------------------------------------------------------------------ */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL est manquante. Ajoutez-la dans votre .env (format postgresql://…).",
    );
  }

  // Pool pg partagé — Prisma 7 utilise le pool du driver sous-jacent.
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}