"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createCourse, updateCourse, requestCourseCoverUploadUrl, attachCourseCover } from "@/lib/actions/admin-courses";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export type CourseFormInitial = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
};

type ErrorKey = "generic" | "required" | "invalidFile";

// Same direct-to-Storage upload pattern as BookForm.tsx: cover bytes
// never go through this Server Action's own body (Next's default ~1MB
// limit, Vercel's ~4.5MB hard ceiling) — the browser uploads straight to
// Storage via a short-lived signed URL, and only the resulting path ever
// reaches the server.
async function uploadCoverDirect(courseId: string, file: File): Promise<{ path: string } | null> {
  const extension = file.name.split(".").pop() ?? "bin";
  const urlResult = await requestCourseCoverUploadUrl(courseId, extension);
  if (!urlResult.ok) return null;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(urlResult.bucket).uploadToSignedUrl(urlResult.path, urlResult.token, file);
  if (error) return null;
  return { path: urlResult.path };
}

export function CourseForm({ mode, initial }: { mode: "create" | "edit"; initial?: CourseFormInitial }) {
  const t = useTranslations("admin.courses.form");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorKey(null);
    setSaved(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const coverFile = formData.get("cover");
    formData.delete("cover");

    if (mode === "edit" && initial) {
      formData.set("courseId", initial.id);
    }

    const result = await (mode === "create" ? createCourse : updateCourse)({ status: "idle" }, formData);

    if (result.status !== "success" || !result.courseId) {
      setErrorKey(result.errorKey ?? "generic");
      setPending(false);
      return;
    }

    const courseId = result.courseId;

    if (coverFile instanceof File && coverFile.size > 0) {
      const uploaded = await uploadCoverDirect(courseId, coverFile);
      if (!uploaded) {
        setErrorKey("invalidFile");
        setPending(false);
        return;
      }
      await attachCourseCover(courseId, uploaded.path);
    }

    setPending(false);
    setSaved(true);
    if (mode === "create") {
      router.push(`/admin/courses/${courseId}/edit`);
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("title")}
          <input name="title" required defaultValue={initial?.title ?? ""} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("description")}
          <textarea name="description" rows={5} defaultValue={initial?.description ?? ""} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("cover")}
          <input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className={inputClasses} />
          {initial?.cover_url ? <span className="text-xs text-muted">{t("coverCurrent")}</span> : null}
        </label>
      </div>

      {errorKey ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm font-medium text-success">
          {t("saved")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
