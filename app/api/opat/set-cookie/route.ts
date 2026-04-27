import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeCookie(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "";

  if (clean.startsWith("PHPSESSID=")) {
    return clean;
  }

  return `PHPSESSID=${clean}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookie = normalizeCookie(body?.cookie || "");

    if (!cookie || !cookie.includes("PHPSESSID=")) {
      return NextResponse.json(
        { success: false, error: "Cookie OPAT inválida." },
        { status: 400 }
      );
    }

    const dir = path.join(process.cwd(), "data");
    const filePath = path.join(dir, "opat-session.json");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      filePath,
      JSON.stringify({ cookie }, null, 2),
      "utf8"
    );

    return NextResponse.json({
      success: true,
      message: "Sesión OPAT actualizada.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo actualizar la sesión OPAT.",
      },
      { status: 500 }
    );
  }
}