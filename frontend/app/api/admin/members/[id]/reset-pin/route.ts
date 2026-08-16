import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = getSessionToken(ADMIN_SESSION_COOKIE);

  return proxyBackendRequest(
    `/members/${encodeURIComponent(params.id)}/reset-pin`,
    token,
    {
      method: "POST",
    },
  );
}
