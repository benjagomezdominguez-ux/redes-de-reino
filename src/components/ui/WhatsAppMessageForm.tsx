"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { saveMessage, requestMessageImageUploadUrl, attachMessageImage } from "@/lib/actions/admin-whatsapp";
import type { WhatsAppMessageRow } from "@/lib/admin/whatsapp-queries";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function WhatsAppMessageForm({
  campaignId,
  position,
  message,
  editable,
}: {
  campaignId: string;
  position: number;
  message: WhatsAppMessageRow | undefined;
  editable: boolean;
}) {
  const t = useTranslations("admin.whatsapp.messageForm");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(false);
    setSaved(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const imageFile = formData.get("image");
    formData.delete("image");
    formData.set("campaignId", campaignId);
    formData.set("sequencePosition", String(position));

    const result = await saveMessage({ status: "idle" }, formData);
    if (result.status !== "success" || !result.id) {
      setError(true);
      setPending(false);
      return;
    }

    if (imageFile instanceof File && imageFile.size > 0) {
      const extension = imageFile.name.split(".").pop() ?? "jpg";
      const urlResult = await requestMessageImageUploadUrl(campaignId, extension);
      if (!urlResult.ok) {
        setError(true);
        setPending(false);
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(urlResult.bucket)
        .uploadToSignedUrl(urlResult.path, urlResult.token, imageFile);
      if (uploadError) {
        setError(true);
        setPending(false);
        return;
      }
      await attachMessageImage(result.id, urlResult.path);
    }

    setPending(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg font-medium text-primary-900">{t("position", { position })}</h4>
        {message ? (
          <span className="rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
            {t(`status.${message.status}`)}
          </span>
        ) : null}
      </div>

      <fieldset disabled={!editable} className="flex flex-col gap-4 disabled:opacity-60">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("title")}
          <input name="title" required defaultValue={message?.title ?? ""} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("bodyText")}
          <textarea name="bodyText" rows={4} required defaultValue={message?.body_text ?? ""} className={inputClasses} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("scheduledDate")}
            <input name="scheduledDate" type="date" required defaultValue={message?.scheduled_date ?? ""} className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("scheduledTime")}
            <input
              name="scheduledTime"
              type="time"
              required
              defaultValue={message?.scheduled_time?.slice(0, 5) ?? "18:00"}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("templateName")}
            <input name="templateName" defaultValue={message?.whatsapp_template_name ?? ""} className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("templateLanguage")}
            <input name="templateLanguage" defaultValue={message?.whatsapp_template_language ?? "es"} className={inputClasses} />
          </label>
        </div>
        <p className="text-xs text-muted">{t("templateHint")}</p>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("image")}
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className={inputClasses} />
        </label>
        {message?.image_url ? (
          <div className="relative h-32 w-24 overflow-hidden rounded bg-surface-alt">
            <Image src={message.image_url} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : null}
      </fieldset>

      {editable ? (
        <button
          type="submit"
          disabled={pending}
          className="self-start inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
        >
          {pending ? t("saving") : t("save")}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t("error")}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm font-medium text-success">
          {t("saved")}
        </p>
      ) : null}

      {message && message.total_recipients > 0 ? (
        <p className="text-xs text-muted">
          {t("deliveryProgress", { sent: message.sent_count, failed: message.failed_count, total: message.total_recipients })}
        </p>
      ) : null}
    </form>
  );
}
