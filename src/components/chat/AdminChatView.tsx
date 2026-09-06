"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { refreshAdminConversations } from "@/lib/actions/chat";
import type { AdminConversationListItem } from "@/lib/admin/chat-queries";
import { getSupabaseBrowserSessionClientReady } from "@/lib/supabase/browser-session";

export function AdminChatView({
  initialConversations,
  adminId,
}: {
  initialConversations: AdminConversationListItem[];
  adminId: string;
}) {
  const t = useTranslations("chat");
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("conversation") ?? initialConversations[0]?.id ?? null
  );

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 2000;

    async function refresh() {
      const next = await refreshAdminConversations();
      if (active) setConversations(next);
    }

    // Same reconnect gap as ChatWindow.tsx (see its comment) — a dead
    // channel here used to mean the admin inbox silently stopped updating
    // until a manual reload, with no indication anything was wrong.
    function scheduleReconnect() {
      if (!active || retryTimeout) return;
      retryTimeout = setTimeout(() => {
        retryTimeout = null;
        if (!active) return;
        channel?.unsubscribe();
        channel = null;
        retryDelayMs = Math.min(retryDelayMs * 1.5, 15000);
        connect();
      }, retryDelayMs);
    }

    async function connect() {
      // See ChatWindow.tsx for why this await is required before opening
      // any channel — otherwise it subscribes with no error but never
      // delivers a single event.
      const supabase = await getSupabaseBrowserSessionClientReady();
      if (!active) return;

      // Always re-sync on (re)connect — closes the gap a dead channel
      // would otherwise leave (a message that arrived while disconnected
      // must still show up once reconnected, not just future ones).
      await refresh();
      if (!active) return;

      // Broad, unfiltered subscription: any message insert/update
      // anywhere can change this list's ordering, previews, or unread
      // counts. RLS already restricts what actually reaches this
      // admin's socket to rows they're allowed to see (which, being
      // Ariel specifically, is every conversation).
      channel = supabase
        .channel("admin-chat-list")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, refresh)
        .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
          if (!active) return;
          if (status === "SUBSCRIBED") {
            retryDelayMs = 2000;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            scheduleReconnect();
          }
        });
    }
    connect();

    return () => {
      active = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      channel?.unsubscribe();
    };
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex max-h-[70vh] flex-col overflow-y-auto rounded-2xl border border-border bg-surface shadow-soft">
        {conversations.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t("admin.noConversations")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-primary-900/5 ${
                    selectedId === c.id ? "bg-primary-900/10" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text">{c.userName}</span>
                    {c.unreadCount > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-1 text-xs text-muted">{c.lastMessage ?? t("admin.noMessagesYet")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <ChatWindow
          key={selected.id}
          conversationId={selected.id}
          currentUserId={adminId}
          viewerRole="admin"
          headerTitle={selected.userName}
          headerSubtitle={selected.userEmail ?? undefined}
        />
      ) : (
        <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted">
          {t("admin.selectConversation")}
        </div>
      )}
    </div>
  );
}
