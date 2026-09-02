"use client";

import { useEffect, useId, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
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

    async function load() {
      const result = await getMyUnreadCount();
      if (!active) return;
      setCount(result.count);
      if (!result.conversationId) return;

      // See ChatWindow.tsx for why this await is required before opening
      // any channel — otherwise it subscribes with no error but never
      // delivers a single event.
      const supabase = await getSupabaseBrowserSessionClientReady();
      if (!active) return;

      channel = supabase
        .channel(`nav-unread:${result.conversationId}:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${result.conversationId}` },
          async () => {
            const refreshed = await getMyUnreadCount();
            if (active) setCount(refreshed.count);
          }
        )
        .subscribe();
    }
    load();

    return () => {
      active = false;
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
