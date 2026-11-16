/*
path :           components/form/ImageUploadField.tsx
tag :            ["form", "image", "upload", "client-component", "ui"]
projectId:       <recipe-miam>
type:            component
generic:         true

role:            Champ image réutilisable : URL manuelle + upload fichier
                 vers public/uploads/{folder}/ via la Server Action
                 uploadImageAction. Affiche un aperçu, permet d'effacer.
                 Consomme le contrat ActionResult du projet :
                 { ok: true, data: { url } } | { ok: false, error }.

flow:            Props value/onChange/folder → input file → FormData →
                 uploadImageAction → si ok : onChange(result.data.url) →
                 aperçu <img>. Si erreur : toast et input conservé.

ecosystem:       AdminUpload = [
                   "@/app/admin/_actions/upload-image.ts",
                   "@/components/form/ImageUploadField.tsx",
                   "@/app/admin/recipes/_components/RecipeForm.tsx",
                   "@/app/admin/ingredients/_components/IngredientManager.tsx",
                 ]

relatedFiles:    ["@/app/admin/_actions/upload-image.ts",
                  "@/app/admin/recipes/_components/RecipeForm.tsx",
                  "@/app/admin/ingredients/_components/IngredientManager.tsx"]

imports:         ["react", "lucide-react", "sonner",
                  "@/app/admin/_actions/upload-image",
                  "@/components/ui/button", "@/components/ui/input",
                  "@/components/ui/label", "@/lib/utils"]

exports:         ["ImageUploadField", "ImageUploadFieldProps"]

useBy:           ["@/app/admin/recipes/_components/RecipeForm.tsx",
                  "@/app/admin/ingredients/_components/IngredientManager.tsx"]

userStories:     ["*en tant qu'admin je veux ajouter ou remplacer une image"]
status:          wip
pathChecked:     ✔true
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : useState, useRef, useTransition, aperçu onError, toasts.

import { useId, useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  uploadImageAction,
  type UploadFolder,
} from "@/app/admin/_actions/upload-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export type ImageUploadFieldProps = {
  readonly value: string | null | undefined;
  readonly onChange: (value: string | null) => void;
  readonly folder: UploadFolder;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly className?: string;
};

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function ImageUploadField({
  value,
  onChange,
  folder,
  label = "Image",
  disabled = false,
  className,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [brokenPreview, setBrokenPreview] = useState(false);

  const url = value?.trim() ? value.trim() : null;

  function handleUrlChange(next: string) {
    setBrokenPreview(false);
    const trimmed = next.trim();
    onChange(trimmed === "" ? null : trimmed);
  }

  function handleClear() {
    setBrokenPreview(false);
    onChange(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("folder", folder);
    formData.set("file", file);
    if (url) formData.set("previousUrl", url);

    startTransition(async () => {
      const result = await uploadImageAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBrokenPreview(false);
      onChange(result.data.url);
      toast.success("Image enregistrée.");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId}>{label}</Label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Aperçu */}
        <div
          className={cn(
            "relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/40",
            !url && "border-dashed",
          )}
        >
          {url && !brokenPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="size-full object-cover"
              onError={() => setBrokenPreview(true)}
            />
          ) : (
            <ImageIcon
              className="size-8 text-muted-foreground/50"
              aria-hidden
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* URL manuelle */}
          <Input
            id={inputId}
            value={url ?? ""}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="/uploads/recipes/exemple.webp"
            disabled={disabled || isPending}
            autoComplete="off"
          />

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="sr-only"
              disabled={disabled || isPending}
              onChange={(e) => handleFileChange(e.target.files)}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isPending}
              onClick={() => fileRef.current?.click()}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {isPending ? "Upload…" : "Uploader"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isPending || !url}
              onClick={handleClear}
            >
              <Trash2 className="size-4" aria-hidden />
              Effacer
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, AVIF ou GIF · max 5&nbsp;Mo · dossier{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              public/uploads/{folder}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}