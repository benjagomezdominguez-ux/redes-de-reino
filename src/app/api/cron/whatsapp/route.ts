import { NextResponse } from "next/server";
import { runWhatsappScheduler } from "@/lib/whatsapp/scheduler";

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`
// automatically (see vercel.json) — this check is what stops anyone else
// from triggering sends by just requesting the URL. Rule 11: this must
// run server-side on a schedule, never depend on a browser tab being
// open.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runWhatsappScheduler();
  return NextResponse.json({ status: "ok", ...summary });
}
