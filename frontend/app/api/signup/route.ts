import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { name, slug, email, password } = await req.json();

    const backendRes = await fetch(backendUrl("/clubs/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, email, password }),
      cache: "no-store",
    });
    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.error || "Signup failed" },
        { status: backendRes.status || 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: data.message || "Your club is pending approval",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signup failed" },
      { status: 500 },
    );
  }
}
