"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

// Shared by the checkout success screen and /pedidos/[id] — both show
// the exact same bank-transfer alias block, so this is the one place
// that copies it, rather than duplicating the Clipboard API handling
// (and its fallback) in two components.
export function CopyAliasButton({ alias }: { alias: string }) {
  const t = useTranslations("books.checkout.transfer");
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const aliasRef = useRef<HTMLSpanElement>(null);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleCopy() {
    if (resetTimeout.current) clearTimeout(resetTimeout.current);

    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(alias);
      setCopied(true);
      setFallback(false);
    } catch {
      // Safari without a secure context, an older browser, or a denied
      // permission all land here. Select the visible alias text itself
      // so the user can still copy it manually — long-press → Copiar on
      // mobile, Ctrl/Cmd+C on desktop — instead of leaving them with
      // nothing but a silent failure.
      const node = aliasRef.current;
      const selection = window.getSelection?.();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setCopied(false);
      setFallback(true);
    }

    resetTimeout.current = setTimeout(() => {
      setCopied(false);
      setFallback(false);
    }, 3000);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Its own full-width line, not sharing a row with the button —
          squeezing both into one flex row (an earlier version) forced
          the alias to wrap mid-word ("redeslibr" / "os.mp") on narrow
          phone screens, confirmed live. */}
      <span
        ref={aliasRef}
        className="block w-full select-all break-words rounded-lg bg-surface px-3 py-2.5 font-mono text-lg font-semibold text-primary-900"
      >
        {alias}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex w-fit items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
      >
        {t("copyAlias")}
      </button>
      {copied ? (
        <p role="status" className="text-sm font-medium text-success">
          {t("aliasCopied")}
        </p>
      ) : fallback ? (
        <p role="status" className="text-sm text-muted">
          {t("aliasCopyFallback")}
        </p>
      ) : null}
    </div>
  );
}
