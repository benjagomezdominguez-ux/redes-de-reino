"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  requestGalleryUploadUrl,
  createGalleryImage,
  updateGalleryImage,
  replaceGalleryImagePhoto,
  replaceGalleryMobileImage,
  removeGalleryMobileImage,
  deleteGalleryImage,
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

type ErrorKey = "generic" | "invalidFile" | "required" | "notFound" | "unauthorized" | "alreadyExists";

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

type PhotoFormInitial = {
  id: string;
  title: string;
  altText: string;
  objectPosition: string;
  url: string;
  mobileUrl: string | null;
};

// One labeled file input + its own live preview — used twice below, once
// for the desktop (16:9) variant and once for the mobile (9:16) one. The
// hint text is purely visual guidance (per spec: "no debe impedir cargar
// una imagen si el sistema actual permite otros formatos") — it never
// blocks or validates the actual aspect ratio.
function ImageVariantField({
  label,
  hint,
  currentUrl,
  currentNote,
  objectPosition,
  onFileChange,
  previewUrl,
  extra,
}: {
  label: string;
  hint: string;
  currentUrl: string | null;
  currentNote: string | null;
  objectPosition: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  previewUrl: string | null;
  extra?: ReactNode;
}) {
  const t = useTranslations("admin.gallery");
  const displayedPreview = previewUrl ?? currentUrl;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChange}
          className={inputClasses}
        />
      </label>
      <p className="text-xs text-muted">{hint}</p>
      {currentNote ? <p className="text-xs text-muted">{currentNote}</p> : null}
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
      {extra}
    </div>
  );
}

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
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [desktopPreviewUrl, setDesktopPreviewUrl] = useState<string | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(null);
  // True once the admin explicitly asks to remove the mobile image in
  // this edit session — distinct from "never had one", so the removal
  // Server Action is only called when there's actually something to
  // remove.
  const [mobileRemoved, setMobileRemoved] = useState(false);
  const [removingMobile, setRemovingMobile] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  // Revoke the previous object URLs whenever they're replaced or the
  // form unmounts — they're only ever used for these in-progress
  // previews.
  useEffect(() => {
    return () => {
      if (desktopPreviewUrl) URL.revokeObjectURL(desktopPreviewUrl);
    };
  }, [desktopPreviewUrl]);
  useEffect(() => {
    return () => {
      if (mobilePreviewUrl) URL.revokeObjectURL(mobilePreviewUrl);
    };
  }, [mobilePreviewUrl]);

  function handleDesktopFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (desktopPreviewUrl) URL.revokeObjectURL(desktopPreviewUrl);
    setDesktopFile(selected);
    setDesktopPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  function handleMobileFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (mobilePreviewUrl) URL.revokeObjectURL(mobilePreviewUrl);
    setMobileFile(selected);
    setMobilePreviewUrl(selected ? URL.createObjectURL(selected) : null);
    if (selected) setMobileRemoved(false);
  }

  async function handleRemoveMobile() {
    if (!initial) return;
    setRemovingMobile(true);
    const result = await removeGalleryMobileImage(initial.id);
    setRemovingMobile(false);
    if (!result.ok) {
      setErrorKey(result.errorKey);
      return;
    }
    if (mobilePreviewUrl) URL.revokeObjectURL(mobilePreviewUrl);
    setMobileFile(null);
    setMobilePreviewUrl(null);
    setMobileRemoved(true);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKey(null);

    if (mode === "create" && !desktopFile) {
      setErrorKey("required");
      return;
    }

    setPending(true);
    const metadata = { title, altText, objectPosition };

    if (mode === "create") {
      const uploadedDesktopPath = await uploadPhoto(desktopFile!);
      if (!uploadedDesktopPath) {
        setErrorKey("invalidFile");
        setPending(false);
        return;
      }
      let uploadedMobilePath: string | null = null;
      if (mobileFile) {
        uploadedMobilePath = await uploadPhoto(mobileFile);
        if (!uploadedMobilePath) {
          setErrorKey("invalidFile");
          setPending(false);
          return;
        }
      }
      const result = await createGalleryImage(uploadedDesktopPath, metadata, uploadedMobilePath);
      if (!result.ok) {
        setErrorKey(result.errorKey);
        setPending(false);
        return;
      }
    } else if (initial) {
      if (desktopFile) {
        const uploadedPath = await uploadPhoto(desktopFile);
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
      if (mobileFile) {
        const uploadedPath = await uploadPhoto(mobileFile);
        if (!uploadedPath) {
          setErrorKey("invalidFile");
          setPending(false);
          return;
        }
        const replaceResult = await replaceGalleryMobileImage(initial.id, uploadedPath);
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

  const hasMobile = Boolean(mobileFile || (initial?.mobileUrl && !mobileRemoved));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-alt p-5">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ImageVariantField
          label={t("desktopPhoto")}
          hint={t("desktopPhotoHint")}
          currentUrl={initial?.url ?? null}
          currentNote={initial?.url && !desktopPreviewUrl ? t("photoCurrent") : null}
          objectPosition={objectPosition}
          onFileChange={handleDesktopFileChange}
          previewUrl={desktopPreviewUrl}
        />
        <ImageVariantField
          label={t("mobilePhoto")}
          hint={`${t("mobilePhotoHint")} — ${t("mobilePhotoOptional")}`}
          currentUrl={initial?.mobileUrl && !mobileRemoved ? initial.mobileUrl : null}
          currentNote={
            !hasMobile
              ? t("mobilePhotoNotSet")
              : initial?.mobileUrl && !mobilePreviewUrl && !mobileRemoved
                ? t("photoCurrent")
                : null
          }
          objectPosition={objectPosition}
          onFileChange={handleMobileFileChange}
          previewUrl={mobilePreviewUrl}
          extra={
            mode === "edit" && initial?.mobileUrl && !mobileRemoved ? (
              <button
                type="button"
                onClick={handleRemoveMobile}
                disabled={removingMobile}
                className={`${dangerButtonClasses} self-start`}
              >
                {removingMobile ? t("removingMobilePhoto") : t("removeMobilePhoto")}
              </button>
            ) : null
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("singlePhotoHint")}</p>
        {!adding && images.length === 0 ? (
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
          {images.map((image) => {
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
                      mobileUrl: image.mobileUrl,
                    }}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                </div>
              );
            }

            return (
              <div key={image.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="relative h-40 w-full overflow-hidden rounded-lg bg-surface-alt">
                      <Image
                        src={image.url}
                        alt={image.alt_text ?? ""}
                        fill
                        className="object-cover"
                        style={{ objectPosition: image.object_position ?? "center" }}
                      />
                    </div>
                    <p className="text-center text-xs text-muted">{t("desktopPhoto")}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="relative h-40 w-full overflow-hidden rounded-lg bg-surface-alt">
                      <Image
                        src={image.mobileUrl ?? image.url}
                        alt={image.alt_text ?? ""}
                        fill
                        className="object-cover"
                        style={{ objectPosition: image.object_position ?? "center" }}
                      />
                    </div>
                    <p className="text-center text-xs text-muted">
                      {image.mobileUrl ? t("mobilePhoto") : t("mobilePhotoNotSet")}
                    </p>
                  </div>
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
