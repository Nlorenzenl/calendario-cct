import { NextResponse } from "next/server";
import { readTokenStore } from "@/lib/token-store";

export async function GET() {
  const tokenData = readTokenStore();

  if (!tokenData || !tokenData.accessToken) {
    return NextResponse.json({
      ok: true,
      connected: false,
      username: "",
      savedAt: "",
    });
  }

  return NextResponse.json({
    ok: true,
    connected: true,
    username: tokenData.username,
    savedAt: tokenData.savedAt,
  });
}