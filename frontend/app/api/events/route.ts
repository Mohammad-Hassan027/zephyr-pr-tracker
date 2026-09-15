import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/events?${queryString}` : "/events";

    const res = await fetch(backendUrl(endpoint), {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: (data && data.error) || "Failed to fetch events" },
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
