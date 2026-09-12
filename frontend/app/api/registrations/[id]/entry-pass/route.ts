import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/server-auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const accessToken = request.headers.get("x-registration-access-token");
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["x-registration-access-token"] = accessToken;
  }

  return proxyBackendRequest(`/registrations/${id}/entry-pass`, undefined, {
    method: "GET",
    headers,
  });
}