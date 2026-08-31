"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setBookStatus } from "@/lib/actions/admin-books";

export function BookStatusButtons({
  productId,
  status,
}: {
  productId: string;
  status: "draft" | "active" | "inactive";
}) {
  const t = useTranslations("admin.books");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = status === "active" ? "inactive" : "active";
    startTransition(async () => {
      await setBookStatus(productId, next);
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
      {status === "active" ? t("unpublish") : t("publish")}
    </button>
  );
}
