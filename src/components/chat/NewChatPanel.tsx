"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listUsersToStartChat, adminStartConversation } from "@/lib/actions/chat";
import type { NewChatCandidate } from "@/lib/admin/chat-queries";

type StartErrorKey = "unauthorized" | "invalidTarget" | "generic";

// Ariel's "start a chat with anyone registered" picker — search + one
// button per user. Reuses the same adminStartConversation() Server
// Action for both "never talked before" and "already has a
// conversation" rows (it's idempotent either way), so this component
// never has to decide create-vs-open itself; it just reports whichever
// conversationId comes back.
export function NewChatPanel({
  onConversationReady,
}: {
  onConversationReady: (conversationId: string, candidate: NewChatCandidate) => void;
}) {
  const t = useTranslations("chat.admin.newChat");
  const tChat = useTranslations("chat");
  const [candidates, setCandidates] = useState<NewChatCandidate[] | null>(null);
  const [query, setQuery] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<StartErrorKey | null>(null);

  useEffect(() => {
    let active = true;
    listUsersToStartChat().then((result) => {
      if (active) setCandidates(result);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSelect(candidate: NewChatCandidate) {
    setErrorKey(null);
    setStartingId(candidate.id);
    const result = await adminStartConversation(candidate.id);
    setStartingId(null);
    if (!result.ok) {
      setErrorKey(result.errorKey);
      return;
    }
    onConversationReady(result.conversationId, candidate);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = (candidates ?? []).filter((c) => {
    if (!normalizedQuery) return true;
    return c.name.toLowerCase().includes(normalizedQuery) || (c.email ?? "").toLowerCase().includes(normalizedQuery);
  });

  return (
    <div className="flex max-h-[70vh] flex-col overflow-y-auto rounded-2xl border border-border bg-surface shadow-soft">
      <div className="border-b border-border p-4">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500"
        />
      </div>

      {errorKey ? (
        <p role="alert" className="px-4 pt-3 text-sm font-medium text-error">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      {candidates === null ? (
        <p className="p-6 text-center text-sm text-muted">{tChat("loading")}</p>
      ) : candidates.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">{t("empty")}</p>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">{t("noResults")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{c.name}</p>
                {c.email ? <p className="truncate text-xs text-muted">{c.email}</p> : null}
                {c.existingConversationId ? (
                  <p className="text-xs text-secondary-600">{t("hasConversation")}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleSelect(c)}
                disabled={startingId === c.id}
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
              >
                {startingId === c.id
                  ? t("starting")
                  : c.existingConversationId
                    ? t("openConversation")
                    : t("sendMessage")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
