/*
path :           app/admin/_actions/upload-image.ts
tag :            ["upload", "image", "admin", "server-action", "form"]
projectId:       <recipe-miam>
type:            action
generic:         true

role:            Server Action d'upload d'image vers public/uploads/{folder}/.
                 Valide le fichier (MIME, taille max 5 Mo) via Zod, génère un
                 nom unique (randomUUID), écrit sur le disque (fs/promises) et
                 retourne l'URL publique. Répond au contrat ActionResult utilisé
                 partout dans le projet : { ok: true, data: { url } }
                 | { ok: false, error }.

flow:            uploadImageAction(formData) → lecture file + folder →
                 safeParse Zod (MIME + taille + folder dans UPLOAD_FOLDERS) →
                 mkdir recursive public/uploads/{folder}/ →
                 writeFile({folder}/{uuid}.{ext}) → retour { ok, data: { url } }
                 ou { ok: false, error }.

ecosystem:       AdminUpload = [
                   "@/app/admin/_actions/upload-image.ts",
                   "@/components/form/ImageUploadField.tsx",
                   "@/app/admin/recipes/_components/RecipeForm.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                 ]

relatedFiles:    ["@/components/form/ImageUploadField.tsx",
                  "@/app/admin/recipes/_components/RecipeForm.tsx",
                  "@/app/admin/ingredients/_components/IngredientManager.tsx"]

imports:         ["node:fs/promises", "node:path", "node:crypto", "zod"]
exports:         ["uploadImageAction", "UploadFolder",
                  "UploadActionResult", "UPLOAD_FOLDERS"]
useBy:           ["@/components/form/ImageUploadField.tsx"]

userStories:     ["*en tant qu'admin je veux uploader une image depuis le formulaire"]
status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/
"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types & constantes
// ---------------------------------------------------------------------------

export const UPLOAD_FOLDERS = [
  "recipes",
  "ingredients",
  "steps",
  "categories",
] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export type UploadActionResult =
  | { readonly ok: true; readonly data: { readonly url: string } }
  | { readonly ok: false; readonly error: string };

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

const EXTENSION_BY_MIME: Record<(typeof ACCEPTED_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const folderSchema = z.enum(UPLOAD_FOLDERS);

const fileSchema = z
  .instanceof(File, { message: "Fichier manquant." })
  .refine((f) => f.size > 0, "Fichier vide.")
  .refine(
    (f) => f.size <= MAX_SIZE_BYTES,
    "Fichier trop volumineux (max 5 Mo).",
  )
  .refine(
    (f) => (ACCEPTED_MIME_TYPES as readonly string[]).includes(f.type),
    "Format non supporté (JPEG, PNG, WEBP, AVIF, GIF).",
  );

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function uploadImageAction(
  formData: FormData,
): Promise<UploadActionResult> {
  try {
    const fileParsed = fileSchema.safeParse(formData.get("file"));
    if (!fileParsed.success) {
      return {
        ok: false,
        error: fileParsed.error.issues[0]?.message ?? "Fichier invalide.",
      };
    }

    const folderParsed = folderSchema.safeParse(formData.get("folder"));
    if (!folderParsed.success) {
      return { ok: false, error: "Dossier d'upload invalide." };
    }

    const file = fileParsed.data;
    const folder = folderParsed.data;
    const ext = EXTENSION_BY_MIME[file.type as keyof typeof EXTENSION_BY_MIME];

    const fileName = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", folder);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDir, fileName), buffer);

    const url = `/uploads/${folder}/${fileName}`;
    return { ok: true, data: { url } };
  } catch (error) {
    console.error("[uploadImageAction]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Échec de l'upload.",
    };
  }
}
