import { NextRequest, NextResponse } from "next/server";
import { backendUrl, sessionCookieOptions } from "@/lib/server-auth";

const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    const backendRes = await fetch(backendUrl("/clubs/platform/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok || !data.token) {
      return NextResponse.json(
        { error: data.error || "Invalid platform admin password" },
        { status: 401 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(PLATFORM_SESSION_COOKIE, data.token, sessionCookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 },
    );
  }
}
