import { NextResponse } from "next/server";
import { getTiendanubeStore, listTiendanubeProducts } from "@/lib/tiendanube/client";

// TEMPORARY — audit-only endpoint to verify the real Tiendanube API
// connection during the ARS/currency implementation. Removed once the
// audit is done; never meant to ship.
export async function GET(request: Request) {
  const secret = process.env.DIAGNOSTIC_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [store, products] = await Promise.all([getTiendanubeStore(), listTiendanubeProducts()]);
    return NextResponse.json({ store, products });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
