import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function POST(req: NextRequest) {
  const { code, password } = await req.json();

  const backendRes = await fetch(`${API_URL}/members/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, password }),
  });

  if (!backendRes.ok) {
    const body = await backendRes.json();
    return NextResponse.json(
      { error: body.error || "Login failed" },
      { status: 401 },
    );
  }

  const member = await backendRes.json();
  const res = NextResponse.json(member);
  res.cookies.set("pr_code", member.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
