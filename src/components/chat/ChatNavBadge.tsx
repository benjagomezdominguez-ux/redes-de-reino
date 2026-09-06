"use client";

import { useEffect, useId, useState } from "react";
import type { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { getMyUnreadCount } from "@/lib/actions/chat";
import { getSupabaseBrowserSessionClientReady } from "@/lib/supabase/browser-session";

export function ChatNavBadge() {
  const [count, setCount] = useState(0);
  // Navbar renders this twice at once (desktop + mobile account menus,
  // same as CartIcon) — a channel name built only from conversationId
  // would collide between the two mounts. See the identical fix/comment
  // in NotificationBell.tsx (confirmed live: "cannot add callbacks...
  // after subscribe()").
  const instanceId = useId();

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 2000;
    let conversationId: string | null = null;

    // Same reconnect gap as ChatWindow.tsx (see its comment) — without
    // this, a dropped channel means the unread badge silently freezes.
    function scheduleReconnect() {
      if (!active || retryTimeout || !conversationId) return;
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
      const result = await getMyUnreadCount();
      if (!active) return;
      setCount(result.count);
      conversationId = result.conversationId;
      if (!conversationId) return;

      // See ChatWindow.tsx for why this await is required before opening
      // any channel — otherwise it subscribes with no error but never
      // delivers a single event.
      const supabase = await getSupabaseBrowserSessionClientReady();
      if (!active) return;

      channel = supabase
        .channel(`nav-unread:${conversationId}:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          async () => {
            const refreshed = await getMyUnreadCount();
            if (active) setCount(refreshed.count);
          }
        )
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
  }, [instanceId]);

  if (count === 0) return null;

  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
      {count}
    </span>
  );
}
