import { NextRequest } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const targetUrl = backendUrl(`/registrations/${params.id}/stream`);
    const backendRes = await fetch(targetUrl, {
      headers: {
        Accept: "text/event-stream",
      },
      cache: "no-store",
    });

    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: err.message || "Failed to establish event stream" })}\n\n`,
      {
        status: 500,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }
}
