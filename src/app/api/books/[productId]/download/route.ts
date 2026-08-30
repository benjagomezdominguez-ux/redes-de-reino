import { NextResponse } from "next/server";
import { resolveDigitalAccessUrl } from "@/lib/books/digital-access";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/books/[productId]/download">
) {
  const { productId } = await context.params;
  const result = await resolveDigitalAccessUrl(productId);

  if (!result.granted) {
    const status = result.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.redirect(result.url);
}
