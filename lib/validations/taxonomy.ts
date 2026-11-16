/*
path :           lib/validations/taxonomy.ts
tag :            ["validation", "zod", "taxonomy", "category", "tag"]
projectId:       <recipe-miam>
type:            config
generic:         true

role:            Schémas Zod partagés pour les taxonomies du catalogue
                 (Category, Tag). Couvre les formulaires create/update
                 et les identifiants de suppression. Normalise les
                 chaînes vides du champ image en undefined. Mode strict
                 partout pour rejeter les clés inconnues côté Server
                 Action.

flow:            Module TypeScript pur → export de categoryFormSchema,
                 tagFormSchema, categoryIdSchema, tagIdSchema et des
                 types inférés. Aucun effet.

ecosystem:       Core = [
                   "@/lib/labels.ts",
                   "@/lib/prisma.ts",
                   "@/lib/utils.ts",
                   "@/lib/validations/taxonomy.ts",
                 ]

relatedFiles:    ["@/app/admin/category/_actions.ts",
                  "@/app/admin/tag/_actions.ts"]

imports:         ["zod"]

exports:         ["categoryFormSchema",
                  "tagFormSchema",
                  "categoryIdSchema",
                  "tagIdSchema",
                  "CategoryFormInput",
                  "TagFormInput"]

useBy:           ["@/app/admin/category/_actions.ts",
                  "@/app/admin/tag/_actions.ts"]

userStories:     ["*en tant qu'admin je veux valider les taxonomies avant écriture"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugField = z
  .string()
  .trim()
  .min(1, "Slug requis.")
  .max(80, "80 caractères maximum.")
  .regex(
    SLUG_REGEX,
    "Format kebab-case attendu : minuscules, chiffres et tirets.",
  );

const nameField = z
  .string()
  .trim()
  .min(1, "Nom requis.")
  .max(60, "60 caractères maximum.");

const optionalImageField = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(200, "200 caractères maximum.").optional(),
);

const idSchema = z
  .object({
    id: z.string().trim().min(1, "Identifiant requis."),
  })
  .strict();

/* ------------------------------------------------------------------ */
/*  Category                                                           */
/* ------------------------------------------------------------------ */

export const categoryFormSchema = z
  .object({
    name: nameField,
    slugCategory: slugField,
    image: optionalImageField,
  })
  .strict();

export type CategoryFormInput = z.input<typeof categoryFormSchema>;

export const categoryIdSchema = idSchema;

/* ------------------------------------------------------------------ */
/*  Tag                                                                */
/* ------------------------------------------------------------------ */

export const tagFormSchema = z
  .object({
    name: nameField,
    slugTag: slugField,
  })
  .strict();

export type TagFormInput = z.input<typeof tagFormSchema>;

export const tagIdSchema = idSchema;