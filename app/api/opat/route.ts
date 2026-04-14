import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(
      "https://opat.cl/operaciones_sts/api.php?accion=obtenerAgenda",
      {
        method: "GET",
        headers: {
          // IMPORTANTE: copiar cookies desde tu navegador
          cookie: req.headers.get("cookie") || "",
        },
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Error obteniendo OPAT" });
  }
}