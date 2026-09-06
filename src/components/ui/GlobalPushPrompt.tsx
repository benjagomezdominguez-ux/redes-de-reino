import { PushPermissionBanner } from "@/components/chat/PushPermissionBanner";

const GLOBAL_DISMISS_KEY = "global_push_prompt_dismissed";

// Site-wide invite to activate push notifications — rendered for any
// authenticated user, on any page (see [locale]/layout.tsx), right where
// a fresh login lands (there's no cheap "just logged in" signal to hook
// into instead — see the architecture note in PushPermissionBanner.tsx).
// A separate dismiss key from the /account and /admin/chat banners: "no
// gracias" here must never hide the option to turn it on later from
// Account (rule: "mostrar posteriormente una opción... desde
// Ajustes/Perfil").
export function GlobalPushPrompt() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-4 sm:px-8">
      <PushPermissionBanner namespace="notifications.push" floating dismissKey={GLOBAL_DISMISS_KEY} />
    </div>
  );
}
