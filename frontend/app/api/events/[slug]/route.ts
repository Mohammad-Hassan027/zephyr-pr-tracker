import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } },
) {
  try {
    const params = await Promise.resolve(context.params);
    const slug = String(params.slug || "").trim();

    if (!slug) {
      return NextResponse.json(
        { error: "Event slug is required" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/events/${encodeURIComponent(slug)}?${queryString}`
      : `/events/${encodeURIComponent(slug)}`;

    const res = await fetch(backendUrl(endpoint), {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: (data && data.error) || "Event not found" },
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
