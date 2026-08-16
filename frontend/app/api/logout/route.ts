import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  PR_CODE_COOKIE,
  PR_SESSION_COOKIE,
} from "@/lib/server-auth";

const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  const deleteCookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  };

  res.cookies.set(ADMIN_SESSION_COOKIE, "", deleteCookieOptions);
  res.cookies.set(PR_SESSION_COOKIE, "", deleteCookieOptions);
  res.cookies.set(PR_CODE_COOKIE, "", deleteCookieOptions);
  res.cookies.set(PLATFORM_SESSION_COOKIE, "", deleteCookieOptions);

  return res;
}
