import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(backendUrl("/clubs"), {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: (data && data.error) || "Failed to fetch clubs" },
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
