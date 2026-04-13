import { NextRequest, NextResponse } from "next/server";
import { readTokenStore } from "@/lib/token-store";
import { inspectWorkbookFromBuffer } from "@/lib/excel-source";

const EXCEL_PATH = "/Calendario_Trabajos.xlsx"; // ← ajusta si está en carpeta

export async function GET(req: NextRequest) {
  try {
    const tokenStore = readTokenStore();

    if (!tokenStore?.accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "No hay cuenta técnica conectada.",
        },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const preferredSheetName =
      url.searchParams.get("sheet") || undefined;

    // 🔥 Descargar archivo directo desde OneDrive personal
    const contentRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:${EXCEL_PATH}:/content`,
      {
        headers: {
          Authorization: `Bearer ${tokenStore.accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!contentRes.ok) {
      const err = await contentRes.text();

      return NextResponse.json(
        {
          ok: false,
          step: "download-content",
          status: contentRes.status,
          error: "No se pudo descargar el Excel.",
          details: err,
        },
        { status: 500 }
      );
    }

    const arrayBuffer = await contentRes.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 🔥 Leer Excel
    const inspection = inspectWorkbookFromBuffer(
      fileBuffer,
      preferredSheetName
    );

    return NextResponse.json({
      ok: true,
      source: {
        owner: tokenStore.username,
        path: EXCEL_PATH,
        fileSizeBytes: fileBuffer.length,
      },
      inspection,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error inesperado",
      },
      { status: 500 }
    );
  }
}