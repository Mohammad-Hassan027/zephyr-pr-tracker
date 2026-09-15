import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } },
) {
  try {
    const params = await Promise.resolve(context.params);
    const slug = String(params.slug || "")
      .trim()
      .toLowerCase();

    if (!slug) {
      return NextResponse.json(
        { error: "Club slug is required" },
        { status: 400 },
      );
    }

    const res = await fetch(
      backendUrl(`/clubs/public/${encodeURIComponent(slug)}`),
      { cache: "no-store" },
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: (data && data.error) || "Club not found" },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (_err) {
    return NextResponse.json(
      { error: "Backend service unavailable" },
      { status: 502 },
    );
  }
}
