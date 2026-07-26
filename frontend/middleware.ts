import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/pr/dashboard")) {
    const prCode = req.cookies.get("pr_code")?.value;
    if (!prCode) return NextResponse.redirect(new URL("/pr", req.url));
    return NextResponse.next();
  }

  const session = req.cookies.get("pr_session")?.value;
  if (session !== process.env.PR_ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/pr/dashboard/:path*"],
};
