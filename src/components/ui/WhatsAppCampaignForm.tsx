"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createCampaign, type WhatsAppActionState } from "@/lib/actions/admin-whatsapp";
import { useRouter } from "@/i18n/navigation";

const initialState: WhatsAppActionState = { status: "idle" };

export function WhatsAppCampaignForm({ groupId }: { groupId: string }) {
  const t = useTranslations("admin.whatsapp.campaignForm");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: WhatsAppActionState, formData: FormData) => {
    const result = await createCampaign(prev, formData);
    if (result.status === "success" && result.id) {
      router.push(`/admin/whatsapp/campaigns/${result.id}`);
    }
    return result;
  }, initialState);

  const inputClasses =
    "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("name")}
        <input name="name" required className={inputClasses} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("startDate")}
          <input name="startDate" type="date" required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("cycleDurationDays")}
          <input name="cycleDurationDays" type="number" min="1" defaultValue={30} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900 sm:col-span-2">
          {t("timezone")}
          <input name="timezone" defaultValue="America/Argentina/Buenos_Aires" className={inputClasses} />
        </label>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t("error")}
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
