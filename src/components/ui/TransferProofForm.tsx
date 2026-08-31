"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  submitTransferProof,
  requestTransferProofUploadUrl,
  type TransferProofState,
} from "@/lib/actions/payments";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function TransferProofForm({ orderId }: { orderId: string }) {
  const t = useTranslations("books.checkout.transfer");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<TransferProofState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({ status: "idle" });

    const formData = new FormData(event.currentTarget);
    formData.set("order_id", orderId);
    const file = formData.get("proof_file");
    formData.delete("proof_file");

    // The proof file (often a phone screenshot, easily a few MB) goes
    // straight to Storage via a signed URL — never through this form's
    // Server Action body, which is capped well below that in production.
    if (file instanceof File && file.size > 0) {
      const extension = file.name.split(".").pop() ?? "bin";
      const urlResult = await requestTransferProofUploadUrl(orderId, extension);
      if (!urlResult.ok) {
        setState({ status: "error", errorKey: "generic" });
        setPending(false);
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.storage
        .from(urlResult.bucket)
        .uploadToSignedUrl(urlResult.path, urlResult.token, file);
      if (error) {
        setState({ status: "error", errorKey: "generic" });
        setPending(false);
        return;
      }
      formData.set("proof_path", urlResult.path);
    }

    const result = await submitTransferProof(state, formData);
    setState(result);
    setPending(false);
  }

  if (state.status === "success") {
    return (
      <p role="status" className="rounded-xl bg-success/10 p-4 text-sm font-medium text-success">
        {t("proofSubmitted")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("proofIntro")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("operationNumber")}
          <input name="operation_number" className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("declaredAmount")}
          <input name="declared_amount" type="number" step="0.01" min="0" className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("declaredDate")}
          <input name="declared_date" type="date" className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("proofFile")}
          <input
            name="proof_file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className={inputClasses}
          />
        </label>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t("proofError")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
      >
        {pending ? t("submittingProof") : t("submitProof")}
      </button>
    </form>
  );
}
