import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await getSessionToken(ADMIN_SESSION_COOKIE);
  const body = await req.text();

  return proxyBackendRequest(`/members/${encodeURIComponent(id)}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await getSessionToken(ADMIN_SESSION_COOKIE);

  return proxyBackendRequest(`/members/${encodeURIComponent(id)}`, token, {
    method: "DELETE",
  });
}
