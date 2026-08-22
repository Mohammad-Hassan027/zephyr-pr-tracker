import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await getSessionToken(ADMIN_SESSION_COOKIE);

  return proxyBackendRequest(
    `/members/${encodeURIComponent(id)}/reset-pin`,
    token,
    {
      method: "POST",
    },
  );
}
