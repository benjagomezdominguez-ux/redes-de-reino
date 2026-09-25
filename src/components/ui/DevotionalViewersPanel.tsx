"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { getDevotionalViewers } from "@/lib/actions/admin-devotional-views";
import type { DevotionalViewerRow } from "@/lib/admin/devotional-view-queries";

// Admin-only "who viewed this" panel for one devotional row in
// /admin/devotionals. Two pieces in one file (the inline count + trigger
// button, and the panel itself) because they always travel together and
// share the same open/data state — splitting them would only add prop
// plumbing between two components with no other consumer.
//
// Responsive strategy: one panel, no JS viewport branching (no
// mismatch/hydration risk). Tailwind breakpoints alone decide the
// shape — fixed to the bottom edge, full width, rounded top corners
// (a comfortable full-screen/bottom-sheet feel) below `sm`; a right-
// side slide-over panel with a comfortable max width at `sm` and up.
// The slide direction differs per breakpoint (y below `sm`, x at `sm`+),
// which is why this is plain CSS transform + transition (mirrors
// Reveal.tsx's own transition-based reveal) rather than the `motion`
// library — `motion` variants would need to branch on viewport in JS to
// pick an axis, reintroducing exactly the hydration hazard
// useSafeReducedMotion()'s own comment describes for anything derived
// from a client-only value. `motion-reduce:` (Tailwind's built-in
// prefers-reduced-motion variant) needs no such hook at all.
//
// Data only loads the first time the panel opens (never on the
// devotionals list page load) and every subsequent open reuses whatever
// was already fetched — reopening the same devotional twice in one
// visit doesn't re-fetch page 1 from scratch.

function formatCount(t: ReturnType<typeof useTranslations>, count: number): string {
  return t("count", { count });
}

export function DevotionalViewersPanel({
  devotionalId,
  devotionalTitle,
  initialCount,
}: {
  devotionalId: string;
  devotionalTitle: string;
  initialCount: number;
}) {
  const t = useTranslations("admin.devotionals.views");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DevotionalViewerRow[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "loadingMore" | "error" | "ready">("idle");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  async function load(targetPage: number, targetSearch: string, mode: "loading" | "loadingMore") {
    setStatus(mode);
    const result = await getDevotionalViewers(devotionalId, { page: targetPage, search: targetSearch });
    if (!result.ok) {
      setStatus("error");
      return;
    }
    setRows((prev) => (targetPage === 1 ? result.data.rows : [...prev, ...result.data.rows]));
    setTotal(result.data.total);
    setPage(result.data.page);
    setStatus("ready");
  }

  function openPanel() {
    setOpen(true);
    if (status === "idle") void load(1, "", "loading");
  }

  function closePanel() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Debounced search — refetches page 1 under the new term rather than
  // filtering the already-loaded page client-side (a match further down
  // the list than what's currently loaded must still be found).
  useEffect(() => {
    if (!open || status === "idle") return;
    const handle = setTimeout(() => void load(1, search, "loading"), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load() closes over devotionalId, which is stable for this component's lifetime
  }, [search, open]);

  // Body scroll lock + focus-into-panel while open, restored on close —
  // same "own the page while a secondary surface is up" contract a
  // modal/drawer needs regardless of which breakpoint it currently looks
  // like.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget = searchInputRef.current ?? panelRef.current;
    focusTarget?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePanel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const hasMore = rows.length < total;

  return (
    <>
      <div className="flex flex-col items-start gap-1.5">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <span aria-hidden="true">👁</span>
          {formatCount(t, initialCount)}
        </p>
        <button
          ref={triggerRef}
          type="button"
          onClick={openPanel}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
        >
          {t("trigger")}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          {/* Backdrop: mouse/touch-only close (a real <button> here would
              give keyboard/screen-reader users a second, redundant
              "Cerrar" control with no visible label of its own — Escape
              and the real close button below already cover those). */}
          <div
            aria-hidden="true"
            data-testid="devotional-viewers-backdrop"
            onClick={closePanel}
            className="absolute inset-0 h-full w-full cursor-default bg-primary-950/50 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none"
          />

          {/* Panel: bottom sheet on mobile, right side panel from `sm` up */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="absolute inset-x-0 bottom-0 flex max-h-[88vh] translate-y-0 flex-col rounded-t-3xl bg-surface shadow-lifted outline-none transition-transform duration-300 ease-out motion-reduce:transition-none sm:inset-y-0 sm:right-0 sm:bottom-auto sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:translate-x-0 sm:rounded-t-none sm:rounded-l-3xl md:max-w-lg"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-1">
                <h2 id={titleId} className="font-display text-lg font-medium text-primary-900 sm:text-xl">
                  {t("title")}
                </h2>
                <p className="line-clamp-1 text-xs text-muted">{devotionalTitle}</p>
                <p className="text-sm font-medium text-secondary-700">{formatCount(t, total)}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label={t("close")}
                className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-900/70 transition-colors hover:bg-primary-900/5 hover:text-primary-900"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="border-b border-border px-5 py-3 sm:px-6">
              <label htmlFor={`${titleId}-search`} className="sr-only">
                {t("searchLabel")}
              </label>
              <div className="relative">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  id={`${titleId}-search`}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm text-text outline-none transition-colors focus:border-primary-900/40"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 sm:px-6" aria-live="polite">
              {status === "loading" ? (
                <p className="py-10 text-center text-sm text-muted">{t("loading")}</p>
              ) : status === "error" ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-error">{t("error")}</p>
                  <button
                    type="button"
                    onClick={() => void load(1, search, "loading")}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
                  >
                    {t("retry")}
                  </button>
                </div>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">{search.trim() ? t("noResults") : t("empty")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {rows.map((viewer, index) => (
                    <ViewerRow key={viewer.userId} viewer={viewer} index={index} />
                  ))}
                </ul>
              )}

              {status === "ready" && hasMore ? (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => void load(page + 1, search, "loadingMore")}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
                  >
                    {t("loadMore")}
                  </button>
                </div>
              ) : null}
              {status === "loadingMore" ? <p className="py-4 text-center text-sm text-muted">{t("loading")}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ViewerRow({ viewer, index }: { viewer: DevotionalViewerRow; index: number }) {
  const t = useTranslations("admin.devotionals.views");
  const format = useFormatter();
  // A fixed "now" (captured once, no live ticking — this list doesn't need
  // second-by-second precision) rather than leaving it to relativeTime()'s
  // own implicit Date.now() fallback, which next-intl explicitly warns
  // against (ENVIRONMENT_FALLBACK) since it's a real hydration hazard for
  // anything that can render during SSR. Harmless here in practice (the
  // panel only ever renders after a client-side `open` click), but this
  // is the same "don't rely on an implicit client-only value lining up
  // with the server" caution useSafeReducedMotion() takes deliberately —
  // worth doing right rather than leaning on an incidental safety net.
  const now = useNow();
  const lastViewed = new Date(viewer.lastViewedAt);

  return (
    <li
      className="flex items-center gap-3 py-3 opacity-0 animate-[fade-in_0.3s_ease-out_forwards] motion-reduce:opacity-100 motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-900/5 text-base text-primary-900"
      >
        👤
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-text">{viewer.displayName}</span>
        <span className="text-xs text-muted">
          {format.relativeTime(lastViewed, now)} · {format.dateTime(lastViewed, { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>
      {viewer.viewCount > 1 ? (
        <span className="shrink-0 rounded-full bg-secondary-500/15 px-2.5 py-1 text-[11px] font-medium text-secondary-700">
          {t("viewedTimes", { count: viewer.viewCount })}
        </span>
      ) : null}
    </li>
  );
}
