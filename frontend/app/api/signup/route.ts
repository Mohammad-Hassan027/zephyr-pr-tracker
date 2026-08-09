import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  backendUrl,
  sessionCookieOptions,
} from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { name, slug, email, password } = await req.json();

    const backendRes = await fetch(backendUrl("/clubs/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, email, password }),
      cache: "no-store",
    });
    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok || !data.token) {
      return NextResponse.json(
        { error: data.error || "Signup failed" },
        { status: backendRes.status || 400 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, data.token, sessionCookieOptions);
    res.cookies.delete("pr_session");
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signup failed" },
      { status: 500 },
    );
  }
}
