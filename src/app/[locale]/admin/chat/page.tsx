import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/supabase/require-auth";
import { listConversationsForAdmin } from "@/lib/admin/chat-queries";
import { AdminChatView } from "@/components/chat/AdminChatView";
import { PushPermissionBanner } from "@/components/chat/PushPermissionBanner";

export default async function AdminChatPage({
  params,
}: PageProps<"/[locale]/admin/chat">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const admin = await requireAdmin();
  const conversations = await listConversationsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PushPermissionBanner />
      <Suspense>
        <AdminChatView initialConversations={conversations} adminId={admin.id} />
      </Suspense>
    </div>
  );
}
