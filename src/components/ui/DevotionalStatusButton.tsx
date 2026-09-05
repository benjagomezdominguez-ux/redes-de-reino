"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setDevotionalStatus } from "@/lib/actions/admin-devotionals";

export function DevotionalStatusButton({ id, status }: { id: string; status: "draft" | "published" }) {
  const t = useTranslations("admin.devotionals");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = status === "published" ? "draft" : "published";
    startTransition(async () => {
      await setDevotionalStatus(id, next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
    >
      {status === "published" ? t("unpublish") : t("publish")}
    </button>
  );
}
