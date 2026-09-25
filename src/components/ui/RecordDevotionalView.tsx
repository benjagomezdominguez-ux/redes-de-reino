"use client";

import { useEffect, useRef } from "react";
import { recordDevotionalView } from "@/lib/actions/devotional-views";

// Renders nothing — a pure side-effect component. The read page only
// mounts this when getAuthProfile() already found a real signed-in
// user (see devocionales/[id]/page.tsx); recordDevotionalView() itself
// also re-checks that server-side regardless, so this component never
// needs to know or care who's logged in, only *that* someone is.
//
// Fires after the article has already rendered (a sibling in the tree,
// not a blocking ancestor) and runs in an effect, so it can never delay
// first paint or the devotional's own content. useRef guards against
// firing twice under React 18/19 StrictMode's dev-only double-effect —
// this must stay a true "once per page view", not "once or twice
// depending on environment", since a second real call would just bump
// view_count again (harmless, but pointless and worth avoiding).
export function RecordDevotionalView({ devotionalId }: { devotionalId: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    recordDevotionalView(devotionalId).catch((err) => {
      // recordDevotionalView() already swallows its own errors — this
      // catch only guards against the unexpected (e.g. a network-level
      // failure to even reach the Server Action), so a devotional never
      // fails to display over a stats write.
      console.error("RecordDevotionalView failed", err);
    });
  }, [devotionalId]);

  return null;
}
