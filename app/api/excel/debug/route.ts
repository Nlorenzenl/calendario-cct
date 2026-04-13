import { NextRequest, NextResponse } from "next/server";
import { readTokenStore } from "@/lib/token-store";
import { inspectWorkbookFromBuffer } from "@/lib/excel-source";

const EXCEL_PATH = "/Calendario_Trabajos.xlsx";

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRowToAK(row: unknown[]) {
  const trimmed = row.slice(0, 11); // A:K
  while (trimmed.length < 11) trimmed.push("");
  return trimmed.map(normalizeText);
}

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
    const preferredSheetName = url.searchParams.get("sheet") || undefined;

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

    const inspection = inspectWorkbookFromBuffer(
      fileBuffer,
      preferredSheetName
    );

    const preview = inspection.allRows.slice(0, 80).map((row, index) => ({
      rowNumber: index + 1,
      valuesAK: normalizeRowToAK(row),
    }));

    return NextResponse.json({
      ok: true,
      selectedSheetName: inspection.selectedSheetName,
      totalRows: inspection.allRows.length,
      preview,
    });
  } catch (error: any) {
    console.error("Error debug Excel:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error inesperado",
      },
      { status: 500 }
    );
  }
}