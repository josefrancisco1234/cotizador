import { NextRequest, NextResponse } from "next/server";

const PASSWORD = "maricarmen";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!password || password.toLowerCase() !== PASSWORD) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("icd_auth", "authenticated", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return response;
}
