"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createDevotional, updateDevotional } from "@/lib/actions/admin-devotionals";

type ErrorKey = "required" | "notFound" | "generic";

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";
const primaryButtonClasses =
  "inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60";
const secondaryButtonClasses =
  "inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-60";

export type DevotionalFormInitial = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
};

export function DevotionalForm({ mode, initial }: { mode: "create" | "edit"; initial?: DevotionalFormInitial }) {
  const t = useTranslations("admin.devotionals.form");
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [pending, setPending] = useState<"draft" | "published" | null>(null);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(targetStatus: "draft" | "published") {
    if (!title.trim() || !content.trim()) {
      setErrorKey("required");
      return;
    }

    setPending(targetStatus);
    setErrorKey(null);
    setSaved(false);

    const result =
      mode === "create"
        ? await createDevotional({ title, content, status: targetStatus })
        : await updateDevotional(initial!.id, { title, content, status: targetStatus });

    setPending(null);

    if (!result.ok) {
      setErrorKey(result.errorKey);
      return;
    }

    setSaved(true);
    if (mode === "create") {
      router.push(`/admin/devotionals/${result.id}/edit`);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("title")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClasses} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("content")}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          className={`${inputClasses} leading-relaxed`}
        />
        <span className="text-xs text-muted">{t("contentHint")}</span>
      </label>

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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => handleSave("draft")}
          className={secondaryButtonClasses}
        >
          {pending === "draft" ? t("saving") : t("saveDraft")}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => handleSave("published")}
          className={primaryButtonClasses}
        >
          {pending === "published" ? t("publishing") : t("publish")}
        </button>
      </div>
    </div>
  );
}
