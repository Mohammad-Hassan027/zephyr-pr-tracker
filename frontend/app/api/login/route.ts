import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  backendUrl,
  sessionCookieOptions,
} from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const backendRes = await fetch(backendUrl("/auth/admin/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  const data = await backendRes.json().catch(() => ({}));

  if (!backendRes.ok || !data.token) {
    return NextResponse.json(
      { error: data.error || "Wrong password" },
      { status: backendRes.status === 500 ? 500 : 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, data.token, sessionCookieOptions);
  res.cookies.delete("pr_session");
  return res;
}
