import { NextRequest, NextResponse } from "next/server";
import { readTokenStore } from "@/lib/token-store";
import { inspectWorkbookFromBuffer } from "@/lib/excel-source";
import { parseExcelRowsToJobs } from "@/lib/excel-parser";

const EXCEL_PATH = "/Calendario_Trabajos.xlsx";

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

    const jobs = parseExcelRowsToJobs(inspection.allRows);

    return NextResponse.json({
      ok: true,
      source: {
        owner: tokenStore.username,
        path: EXCEL_PATH,
        selectedSheetName: inspection.selectedSheetName,
      },
      totalJobs: jobs.length,
      jobs,
    });
  } catch (error: any) {
    console.error("Error leyendo trabajos Excel:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error inesperado",
      },
      { status: 500 }
    );
  }
}