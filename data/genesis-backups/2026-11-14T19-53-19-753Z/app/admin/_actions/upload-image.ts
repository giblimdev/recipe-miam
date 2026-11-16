/*
path :           app/admin/_actions/upload-image.ts
tag :            ["upload", "image", "admin", "server-action"]
projectId:       <UltimateBlog>
type:            action
generic:         true

role:            Server Action d'upload d'image vers le dossier public/uploads/.
                 Valide le fichier (MIME, taille), le nomme de façon unique (cuid),
                 l'écrit sur le disque et retourne son URL publique.
                 Utilisée par le composant client ImageUploadField.

flow:            uploadImageAction(formData) → lecture file + folder →
                 validation Zod (type + taille) → génération nom unique →
                 écriture via fs/promises dans public/uploads/{folder}/ →
                 retour { url: "/uploads/{folder}/{name}" } ou { error: "..." }.

ecosystem:       Recipe = [
                   "@/app/admin/_actions/upload-image.ts",
                   "@/app/admin/recipes/_components/RecipeForm.tsx",
                   "@/app/admin/recipes/new/page.tsx",
                   "@/components/form/ImageUploadField.tsx",
                 ]
relatedFiles:    ["@/components/form/ImageUploadField.tsx",
                  "@/app/admin/recipes/_components/RecipeForm.tsx"]
imports:         ["next/server", "node:fs/promises", "node:path",
                  "node:crypto", "zod"]
exports:         ["uploadImageAction", "UploadFolder",
                  "UploadImageResult", "UPLOAD_FOLDERS"]
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

export type UploadImageResult =
  | { url: string; error?: undefined }
  | { url?: undefined; error: string };

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

const uploadFolderSchema = z.enum(UPLOAD_FOLDERS);

const uploadFileSchema = z
  .instanceof(File)
  .refine((f) => f.size > 0, "Fichier vide.")
  .refine((f) => f.size <= MAX_SIZE_BYTES, "Fichier trop volumineux (max 5 Mo).")
  .refine(
    (f) =>
      (ACCEPTED_MIME_TYPES as readonly string[]).includes(f.type),
    "Format non supporté (JPEG, PNG, WEBP, AVIF, GIF)."
  );

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function uploadImageAction(
  formData: FormData
): Promise<UploadImageResult> {
  try {
    const file = formData.get("file");
    const folderInput = formData.get("folder");

    const fileParsed = uploadFileSchema.safeParse(file);
    if (!fileParsed.success) {
      return { error: fileParsed.error.issues[0]?.message ?? "Fichier invalide." };
    }

    const folderParsed = uploadFolderSchema.safeParse(folderInput);
    if (!folderParsed.success) {
      return { error: "Dossier d'upload invalide." };
    }

    const folder = folderParsed.data;
    const uploadedFile = fileParsed.data;
    const ext = EXTENSION_BY_MIME[uploadedFile.type as keyof typeof EXTENSION_BY_MIME];

    const fileName = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", folder);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    await writeFile(join(uploadDir, fileName), buffer);

    const publicUrl = `/uploads/${folder}/${fileName}`;
    return { url: publicUrl };
  } catch (err) {
    console.error("[uploadImageAction] Erreur :", err);
    return { error: "Échec de l'upload. Réessayez." };
  }
}