import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(id)}/request-correction`,
    await getSessionToken(ADMIN_SESSION_COOKIE),
    {
      method: "PATCH",
      headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
      body,
    },
  );
}
