"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addContact, type WhatsAppActionState } from "@/lib/actions/admin-whatsapp";

const initialState: WhatsAppActionState = { status: "idle" };

export function WhatsAppContactForm({ groupId }: { groupId: string }) {
  const t = useTranslations("admin.whatsapp.contactForm");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: WhatsAppActionState, formData: FormData) => {
    const result = await addContact(prev, formData);
    if (result.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("phone")}
        <input
          name="phone"
          required
          placeholder="+5491122334455"
          className="w-48 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("displayName")}
        <input
          name="displayName"
          className="w-48 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
      >
        {pending ? t("saving") : t("add")}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="w-full text-sm font-medium text-error">
          {t(`errors.${state.errorKey ?? "generic"}`)}
        </p>
      ) : null}
    </form>
  );
}
