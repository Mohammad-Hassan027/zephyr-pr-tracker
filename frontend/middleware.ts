import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "pr_admin_session";
const PR_SESSION_COOKIE = "pr_member_session";
const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // PR member dashboard — requires pr_member_session
  if (pathname.startsWith("/pr/dashboard")) {
    const session = req.cookies.get(PR_SESSION_COOKIE)?.value;
    if (!session) return NextResponse.redirect(new URL("/pr", req.url));
    return NextResponse.next();
  }

  // Platform admin area — requires platform_admin_session.
  // The root /platform/clubs page renders its own inline login form, so only
  // sub-paths (e.g. the API-proxied actions) are hard-gated here to prevent
  // direct access without a session cookie.
  if (pathname.startsWith("/platform/clubs/")) {
    const session = req.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
    if (!session) return NextResponse.redirect(new URL("/platform/clubs", req.url));
    return NextResponse.next();
  }

  // Club admin area — requires pr_admin_session
  const session = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/pr/dashboard/:path*",
    "/platform/clubs/:path+",
  ],
};
