"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createGroup, type WhatsAppActionState } from "@/lib/actions/admin-whatsapp";
import { useRouter } from "@/i18n/navigation";

const initialState: WhatsAppActionState = { status: "idle" };

export function WhatsAppGroupForm() {
  const t = useTranslations("admin.whatsapp.groupForm");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: WhatsAppActionState, formData: FormData) => {
    const result = await createGroup(prev, formData);
    if (result.status === "success" && result.id) {
      router.push(`/admin/whatsapp/groups/${result.id}`);
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("name")}
        <input
          name="name"
          required
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500"
        />
      </label>

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
