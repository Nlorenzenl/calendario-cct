import { NextResponse } from "next/server";
import { getOpatCookieOrThrow } from "@/lib/opat-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isExpiredResponse(text: string) {
  const raw = text.toLowerCase();

  return (
    raw.includes("acceso denegado") ||
    raw.includes("sesión ha expirado") ||
    raw.includes("sesion ha expirado") ||
    raw.includes("inicia sesión nuevamente") ||
    raw.includes("inicia sesion nuevamente") ||
    raw.includes("login") ||
    raw.includes("password") ||
    raw.includes("contraseña")
  );
}

export async function GET() {
  try {
    const cookie = getOpatCookieOrThrow();

    const response = await fetch(
      "https://opat.cl/operaciones_sts/api.php?accion=obtenerAgenda&t=" +
        Date.now(),
      {
        method: "GET",
        headers: {
          cookie,
        },
        cache: "no-store",
        redirect: "manual",
      }
    );

    const text = await response.text();
    const rawPreview = safeText(text).slice(0, 600);

    let parsedJson: any = null;
    let parsedAsJson = false;

    try {
      parsedJson = JSON.parse(text);
      parsedAsJson = true;
    } catch {
      parsedJson = null;
    }

    const expired =
      isExpiredResponse(text) ||
      JSON.stringify(parsedJson || {}).toLowerCase().includes("expirado");

    if (expired) {
      return NextResponse.json(
        {
          success: false,
          status: "expired",
          message: "Sesión OPAT expirada.",
          rawPreview,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      status: "ok",
      parsedAsJson,
      count: Array.isArray(parsedJson) ? parsedJson.length : null,
      rawPreview,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: "error",
        message: error?.message || "No se pudo verificar la sesión OPAT.",
      },
      { status: 500 }
    );
  }
}