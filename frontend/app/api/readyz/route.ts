import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(backendUrl("/readyz"), {
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(
      {
        ok: res.ok,
        service: "zephyr-frontend",
        status: res.ok ? "ready" : "not_ready",
        backend: data,
      },
      {
        status: res.status,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        service: "zephyr-frontend",
        status: "not_ready",
        error: "Backend service unreachable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  }
}
