"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setCourseStatus } from "@/lib/actions/admin-courses";
import type { CourseStatus } from "@/lib/courses/types";

export function CourseStatusButtons({ id, status }: { id: string; status: CourseStatus }) {
  const t = useTranslations("admin.courses");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: CourseStatus) {
    startTransition(async () => {
      await setCourseStatus(id, next);
      router.refresh();
    });
  }

  const buttonClass =
    "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50";

  if (status === "draft") {
    return (
      <button type="button" onClick={() => change("published")} disabled={pending} className={buttonClass}>
        {t("publish")}
      </button>
    );
  }

  if (status === "published") {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => change("closed")} disabled={pending} className={buttonClass}>
          {t("close")}
        </button>
        <button type="button" onClick={() => change("archived")} disabled={pending} className={buttonClass}>
          {t("archive")}
        </button>
      </div>
    );
  }

  if (status === "closed") {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => change("published")} disabled={pending} className={buttonClass}>
          {t("reopen")}
        </button>
        <button type="button" onClick={() => change("archived")} disabled={pending} className={buttonClass}>
          {t("archive")}
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => change("draft")} disabled={pending} className={buttonClass}>
      {t("unarchive")}
    </button>
  );
}
