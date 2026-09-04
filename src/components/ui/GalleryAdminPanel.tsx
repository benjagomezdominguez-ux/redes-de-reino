"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  requestGalleryUploadUrl,
  createGalleryImage,
  updateGalleryImage,
  replaceGalleryImagePhoto,
  deleteGalleryImage,
  moveGalleryImage,
} from "@/lib/actions/admin-gallery";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { GalleryImageWithUrl } from "@/lib/gallery/queries";

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";
const primaryButtonClasses =
  "inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60";
const secondaryButtonClasses =
  "inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50";
const dangerButtonClasses =
  "inline-flex items-center justify-center rounded-full border border-error/30 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50";

type ErrorKey = "generic" | "invalidFile" | "required" | "notFound" | "unauthorized";

// Uploads directly from the browser to Storage via a short-lived signed
// URL minted by an admin-gated Server Action — same reason as book
// covers/files: bytes never touch a Server Action body (Next's ~1MB
// default limit, Vercel's ~4.5MB hard ceiling on serverless bodies).
async function uploadPhoto(file: File): Promise<string | null> {
  const extension = file.name.split(".").pop() ?? "";
  const urlResult = await requestGalleryUploadUrl(extension);
  if (!urlResult.ok) return null;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(urlResult.bucket).uploadToSignedUrl(urlResult.path, urlResult.token, file);
  if (error) return null;
  return urlResult.path;
}

type PhotoFormInitial = { id: string; title: string; altText: string; objectPosition: string; url: string };

function PhotoForm({
  mode,
  initial,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: PhotoFormInitial;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.gallery");
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [altText, setAltText] = useState(initial?.altText ?? "");
  const [objectPosition, setObjectPosition] = useState(initial?.objectPosition ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  // Revoke the previous object URL whenever it's replaced or the form
  // unmounts — it's only ever used for this in-progress preview.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKey(null);

    if (mode === "create" && !file) {
      setErrorKey("required");
      return;
    }

    setPending(true);
    const metadata = { title, altText, objectPosition };

    if (mode === "create") {
      const uploadedPath = await uploadPhoto(file!);
      if (!uploadedPath) {
        setErrorKey("invalidFile");
        setPending(false);
        return;
      }
      const result = await createGalleryImage(uploadedPath, metadata);
      if (!result.ok) {
        setErrorKey(result.errorKey);
        setPending(false);
        return;
      }
    } else if (initial) {
      if (file) {
        const uploadedPath = await uploadPhoto(file);
        if (!uploadedPath) {
          setErrorKey("invalidFile");
          setPending(false);
          return;
        }
        const replaceResult = await replaceGalleryImagePhoto(initial.id, uploadedPath);
        if (!replaceResult.ok) {
          setErrorKey(replaceResult.errorKey);
          setPending(false);
          return;
        }
      }
      const updateResult = await updateGalleryImage(initial.id, metadata);
      if (!updateResult.ok) {
        setErrorKey(updateResult.errorKey);
        setPending(false);
        return;
      }
    }

    setPending(false);
    router.refresh();
    onSaved();
  }

  const displayedPreview = previewUrl ?? initial?.url ?? null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-alt p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {mode === "create" ? t("photoRequired") : t("photo")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className={inputClasses}
            />
          </label>
          {initial?.url && !previewUrl ? <p className="text-xs text-muted">{t("photoCurrent")}</p> : null}
          {displayedPreview ? (
            <div className="relative h-40 w-full max-w-xs overflow-hidden rounded-lg bg-surface">
              <Image
                src={displayedPreview}
                alt={t("preview")}
                fill
                unoptimized={Boolean(previewUrl)}
                className="object-cover"
                style={{ objectPosition: objectPosition || "center" }}
              />
            </div>
          ) : null}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("title")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("altText")}
          <input value={altText} onChange={(e) => setAltText(e.target.value)} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900 sm:col-span-2">
          {t("objectPosition")}
          <input
            value={objectPosition}
            onChange={(e) => setObjectPosition(e.target.value)}
            placeholder="center"
            className={inputClasses}
          />
        </label>
      </div>

      {errorKey ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClasses}>
          {pending ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={secondaryButtonClasses}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

export function GalleryAdminPanel({ images }: { images: GalleryImageWithUrl[] }) {
  const t = useTranslations("admin.gallery");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [movePendingId, setMovePendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleDelete(id: string) {
    setDeletePending(true);
    const result = await deleteGalleryImage(id);
    setDeletePending(false);
    setConfirmingDeleteId(null);
    if (result.ok) {
      setFeedback({ kind: "success", text: t("deleteSuccess") });
      router.refresh();
    } else {
      setFeedback({ kind: "error", text: t(`errors.${result.errorKey}`) });
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setMovePendingId(id);
    await moveGalleryImage(id, direction);
    setMovePendingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("count", { count: images.length })}</p>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className={primaryButtonClasses}>
            {t("addNew")}
          </button>
        ) : null}
      </div>

      {adding ? (
        <PhotoForm mode="create" onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />
      ) : null}

      {images.length === 0 && !adding ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => {
            if (editingId === image.id) {
              return (
                <div key={image.id} className="sm:col-span-2 lg:col-span-3">
                  <PhotoForm
                    mode="edit"
                    initial={{
                      id: image.id,
                      title: image.title ?? "",
                      altText: image.alt_text ?? "",
                      objectPosition: image.object_position ?? "",
                      url: image.url,
                    }}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                </div>
              );
            }

            return (
              <div key={image.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
                <div className="relative h-40 w-full overflow-hidden rounded-lg bg-surface-alt">
                  <Image
                    src={image.url}
                    alt={image.alt_text ?? ""}
                    fill
                    className="object-cover"
                    style={{ objectPosition: image.object_position ?? "center" }}
                  />
                </div>
                <p className="truncate text-sm font-medium text-text">{image.title || t("untitled")}</p>

                {confirmingDeleteId === image.id ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-3">
                    <p className="text-sm font-medium text-text">{t("confirmDeleteTitle")}</p>
                    <p className="text-xs text-muted">{t("confirmDeleteBody")}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={deletePending}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(image.id)}
                        disabled={deletePending}
                        className="rounded-full bg-error px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
                      >
                        {deletePending ? t("deleting") : t("confirmDeleteButton")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setEditingId(image.id)} className={secondaryButtonClasses}>
                      {t("edit")}
                    </button>
                    <button type="button" onClick={() => setConfirmingDeleteId(image.id)} className={dangerButtonClasses}>
                      {t("delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(image.id, "up")}
                      disabled={index === 0 || movePendingId === image.id}
                      aria-label={t("moveUp")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(image.id, "down")}
                      disabled={index === images.length - 1 || movePendingId === image.id}
                      aria-label={t("moveDown")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`text-sm font-medium ${feedback.kind === "error" ? "text-error" : "text-success"}`}
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
