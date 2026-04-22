import { NextResponse } from "next/server";
import { getOpatCookieOrThrow } from "@/lib/opat-session";

export async function GET() {
  try {
    const cookie = getOpatCookieOrThrow();

    const response = await fetch(
      "https://opat.cl/operaciones_sts/api.php?accion=obtenerAgenda",
      {
        method: "GET",
        headers: {
          cookie,
        },
        redirect: "manual",
      }
    );

    const text = await response.text();

    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "OPAT no devolvió JSON válido al obtener agenda.",
          rawPreview: text.slice(0, 1200),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Error obteniendo OPAT",
      },
      { status: 500 }
    );
  }
}