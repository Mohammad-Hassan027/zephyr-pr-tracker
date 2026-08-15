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

const EXCLUDED_PROXY_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function proxiedResponseHeaders(response: Response) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (EXCLUDED_PROXY_RESPONSE_HEADERS.has(normalizedKey)) {
      return;
    }
    headers.set(key, value);
  });

  return headers;
}

/**
 * Proxy an authenticated request to the backend and stream the response body
 * directly without buffering it in memory. Eliminates the double-handling
 * overhead of the previous `await backendRes.text()` pattern.
 */
export async function proxyBackendRequest(
  path: string,
  token: string | undefined,
  init: RequestInit = {},
) {
  if (!token) return unauthorized();

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  try {
    const backendRes = await fetch(backendUrl(path), {
      ...init,
      headers,
      cache: "no-store",
    });

    const body =
      backendRes.status === 204 || backendRes.status === 304
        ? null
        : backendRes.body;

    return new NextResponse(body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: proxiedResponseHeaders(backendRes),
    });
  } catch (_err) {
    return NextResponse.json(
      { error: "Backend request failed" },
      { status: 502 },
    );
  }
}
