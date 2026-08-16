import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = getSessionToken(ADMIN_SESSION_COOKIE);
  const body = await req.text();

  return proxyBackendRequest(`/events/${encodeURIComponent(params.id)}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = getSessionToken(ADMIN_SESSION_COOKIE);

  return proxyBackendRequest(`/events/${encodeURIComponent(params.id)}`, token, {
    method: "DELETE",
  });
}
