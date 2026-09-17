"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { Container } from "@/components/ui/Container";

// Root error boundary for everything under [locale] — most importantly,
// the one place that recovers from a real, reproduced production bug:
// a Server Action (signIn included) invoked from JS that was loaded
// before a newer deploy went out fails with "Server Action ... was not
// found on the server" (confirmed live: the server responds 404 with
// x-nextjs-action-not-found, and Next.js's own client runtime throws
// UnrecognizedActionError for it — see server-action-reducer.js). This
// app never caught that error anywhere, so it fell through to a raw,
// unexplained crash. It hits hardest for users who already
// installed/opened the PWA before a deploy and never got a fresh page
// load since — their JS just keeps running the old build. A plain
// reload fetches the current deployment's JS/action ids and resolves it
// completely, so that's the whole fix: detect this one error shape and
// reload once, automatically. Any other error still gets a normal,
// visible fallback with a manual reload button.
export default function LocaleError({ error }: { error: Error & { digest?: string } }) {
  const t = useTranslations("errors");
  const isStaleVersion = unstable_isUnrecognizedActionError(error);

  useEffect(() => {
    if (isStaleVersion) {
      window.location.reload();
    }
  }, [isStaleVersion]);

  if (isStaleVersion) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <p className="text-center text-sm text-muted">{t("staleVersion")}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Container className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
        <h1 className="font-display text-2xl font-medium text-primary-900">
          {t("unexpected.title")}
        </h1>
        <p className="text-muted">{t("unexpected.body")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("unexpected.cta")}
        </button>
      </Container>
    </main>
  );
}
