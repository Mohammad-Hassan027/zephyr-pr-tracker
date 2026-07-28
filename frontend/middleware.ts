import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "pr_admin_session";
const PR_SESSION_COOKIE = "pr_member_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/pr/dashboard")) {
    const session = req.cookies.get(PR_SESSION_COOKIE)?.value;
    if (!session) return NextResponse.redirect(new URL("/pr", req.url));
    return NextResponse.next();
  }

  const session = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/pr/dashboard/:path*"],
};
