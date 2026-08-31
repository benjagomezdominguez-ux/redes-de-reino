"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setGroupStatus } from "@/lib/actions/admin-whatsapp";

export function WhatsAppGroupStatusButton({ groupId, status }: { groupId: string; status: "active" | "inactive" }) {
  const t = useTranslations("admin.whatsapp.groupDetail");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = status === "active" ? "inactive" : "active";
    startTransition(async () => {
      await setGroupStatus(groupId, next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
    >
      {status === "active" ? t("deactivate") : t("activate")}
    </button>
  );
}
