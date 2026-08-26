import { NextRequest, NextResponse } from "next/server";
import {
  backendUrl,
  PR_CODE_COOKIE,
  PR_SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, password, clubSlug, clubId, club } = body;

  const backendRes = await fetch(backendUrl("/members/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, password, clubSlug, clubId, club }),
    cache: "no-store",
  });
  const data = await backendRes.json().catch(() => ({}));

  if (!backendRes.ok || !data.token) {
    return NextResponse.json(
      { error: data.error || "Login failed" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ name: data.name, code: data.code });
  res.cookies.set(PR_SESSION_COOKIE, data.token, sessionCookieOptions);
  res.cookies.set(PR_CODE_COOKIE, data.code, sessionCookieOptions);
  return res;
}
