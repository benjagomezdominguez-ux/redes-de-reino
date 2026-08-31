"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  confirmBankTransfer,
  rejectBankTransfer,
  type AdminPaymentActionState,
} from "@/lib/actions/admin-payments";

const initialState: AdminPaymentActionState = { status: "idle" };

export function AdminPaymentReviewActions({ paymentId }: { paymentId: string }) {
  const t = useTranslations("admin.orderDetail.payment");
  const router = useRouter();
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmBankTransfer, initialState);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectBankTransfer, initialState);

  useEffect(() => {
    if (confirmState.status === "success" || rejectState.status === "success") {
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState.status, rejectState.status]);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-sm font-semibold text-primary-900">{t("reviewTitle")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={confirmAction} className="flex flex-1 flex-col gap-2">
          <input type="hidden" name="payment_id" value={paymentId} />
          <input
            name="notes"
            placeholder={t("notesPlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={confirmPending}
            className="inline-flex items-center justify-center rounded-full bg-success px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {confirmPending ? t("confirming") : t("confirm")}
          </button>
        </form>

        <form action={rejectAction} className="flex flex-1 flex-col gap-2">
          <input type="hidden" name="payment_id" value={paymentId} />
          <input
            name="notes"
            placeholder={t("notesPlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={rejectPending}
            className="inline-flex items-center justify-center rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
          >
            {rejectPending ? t("rejecting") : t("reject")}
          </button>
        </form>
      </div>

      {confirmState.status === "error" || rejectState.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t("actionError")}
        </p>
      ) : null}
    </div>
  );
}
