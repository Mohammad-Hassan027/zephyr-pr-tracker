import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "pr_admin_session";
export const PR_SESSION_COOKIE = "pr_member_session";
export const PR_CODE_COOKIE = "pr_code";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//.test(url);
}

export function backendUrl(path: string) {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const baseUrl =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    (publicApiUrl && isAbsoluteUrl(publicApiUrl) ? publicApiUrl : undefined) ||
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:5000/api");

  if (!baseUrl) {
    throw new Error("Missing absolute BACKEND_API_URL for server-side API calls");
  }

  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getSessionToken(cookieName: string) {
  return cookies().get(cookieName)?.value;
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function proxyBackendRequest(
  path: string,
  token: string | undefined,
  init: RequestInit = {},
) {
  if (!token) return unauthorized();

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const backendRes = await fetch(backendUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
  const body = await backendRes.text();
  const responseHeaders = new Headers();
  const contentType = backendRes.headers.get("content-type");

  if (contentType) responseHeaders.set("Content-Type", contentType);

  return new NextResponse(body, {
    status: backendRes.status,
    headers: responseHeaders,
  });
}
