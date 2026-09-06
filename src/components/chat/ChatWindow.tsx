"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { sendMessage, markConversationRead } from "@/lib/actions/chat";
import { getSupabaseBrowserSessionClientReady } from "@/lib/supabase/browser-session";

type ChatRole = "user" | "admin";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_role: ChatRole;
  content: string;
  created_at: string;
  read_at: string | null;
};

type ConnectionState = "connecting" | "connected" | "disconnected";

export function ChatWindow({
  conversationId,
  currentUserId,
  viewerRole,
  headerTitle,
  headerSubtitle,
}: {
  conversationId: string;
  currentUserId: string;
  viewerRole: ChatRole;
  headerTitle: string;
  headerSubtitle?: string;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 2000;

    // Merges rather than replaces — a message that already arrived via
    // realtime while this fetch was in flight (most likely right after a
    // reconnect, see below) must never be dropped by an overwrite here.
    // Also what actually closes the gap a dead/reconnecting channel would
    // otherwise leave: every (re)connect re-syncs the full history, so a
    // message that arrived while disconnected is never permanently lost.
    async function fetchAndMerge(supabase: Awaited<ReturnType<typeof getSupabaseBrowserSessionClientReady>>) {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!active) return;
      const fetched = (data as Message[] | null) ?? [];
      setMessages((prev) => {
        const byId = new Map((prev ?? []).map((m) => [m.id, m]));
        for (const m of fetched) byId.set(m.id, m);
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }

    // Schedules exactly one reconnect attempt (guarded by retryTimeout so
    // a burst of CHANNEL_ERROR/TIMED_OUT callbacks can't stack multiple
    // timers), with a capped backoff — a dead channel used to mean "stuck
    // until the user reloads the page"; this is what actually recovers it.
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
      // Must resolve before opening the channel — a session restored
      // from cookies (as this client does) doesn't propagate to
      // Realtime's websocket auth until getSession() is awaited once.
      // Skipping this connects the channel with no error at all, but it
      // then silently never delivers a single RLS-gated event.
      const supabase = await getSupabaseBrowserSessionClientReady();
      if (!active) return;

      await fetchAndMerge(supabase);
      if (!active) return;
      markConversationRead(conversationId);

      channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload: RealtimePostgresChangesPayload<Message>) => {
            const incoming = payload.new as Message;
            setMessages((prev) => {
              const base = prev ?? [];
              if (base.some((m) => m.id === incoming.id)) return base;
              return [...base, incoming];
            });
            if (incoming.sender_role !== viewerRole) {
              markConversationRead(conversationId);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload: RealtimePostgresChangesPayload<Message>) => {
            const updated = payload.new as Message;
            setMessages((prev) => (prev ?? []).map((m) => (m.id === updated.id ? updated : m)));
          }
        )
        .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
          if (!active) return;
          if (status === "SUBSCRIBED") {
            setConnection("connected");
            retryDelayMs = 2000; // reset backoff after a real recovery
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnection("disconnected");
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
  }, [conversationId, viewerRole]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);

    const result = await sendMessage(conversationId, content);
    setSending(false);

    if (result.status !== "success") {
      setError(t(`errors.${result.errorKey}`));
      return;
    }

    // Optimistic local echo — don't wait on the realtime round trip to
    // show the message as sent. Keyed on the real server-assigned id
    // (returned by the insert, not a temp/random client id), and guarded
    // the same way the realtime INSERT handler is: the two are racing
    // independent round trips (the Server Action's HTTP response vs. the
    // websocket event), and either can arrive first. Without this guard,
    // a realtime event landing first would insert the row unconditionally,
    // then this block would append a second, identically-keyed entry —
    // a real, confirmed duplicate-render bug.
    setMessages((prev) => {
      const base = prev ?? [];
      if (base.some((m) => m.id === result.messageId)) return base;
      return [
        ...base,
        {
          id: result.messageId,
          conversation_id: conversationId,
          sender_id: currentUserId,
          sender_role: viewerRole,
          content,
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ];
    });
    setDraft("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-border bg-surface shadow-soft">
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-medium text-primary-900">{headerTitle}</h2>
        {headerSubtitle ? <p className="text-sm text-muted">{headerSubtitle}</p> : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages === null ? (
          <p className="mt-8 text-center text-sm text-muted">{t("loading")}</p>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => {
              const isOwn = m.sender_role === viewerRole;
              return (
                <li key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      isOwn ? "bg-primary-900 text-white" : "bg-surface-alt text-text"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`mt-1 text-[11px] ${isOwn ? "text-white/70" : "text-muted"}`}>
                      {formatTime(m.created_at, locale)}
                      {isOwn && m.read_at ? ` · ${t("read")}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {connection === "disconnected" ? (
        <p role="status" className="border-t border-border bg-error/5 px-6 py-2 text-xs text-error">
          {t("disconnected")}
        </p>
      ) : null}

      <div className="border-t border-border p-4">
        {error ? (
          <p role="alert" className="mb-2 text-xs font-medium text-error">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t("placeholder")}
            className="max-h-32 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
          >
            {sending ? t("sending") : t("send")}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
