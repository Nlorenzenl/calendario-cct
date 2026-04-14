import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.pt || !body?.fInicio || !body?.fFin) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios para actualizar el PT." },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.append("data", JSON.stringify(body));

    const url =
      "https://opat.cl/operaciones_sts/api.php?accion=guardarUnPT&t=" +
      Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
      body: formData,
    });

    const text = await response.text();

    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return NextResponse.json({
      success: true,
      opatResponse: json,
      sent: body,
    });
  } catch (error) {
    console.error("Error actualizando PT en OPAT:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo actualizar el PT en OPAT." },
      { status: 500 }
    );
  }
}