import { NextRequest, NextResponse } from "next/server";
import { getGraphClient, encodeSharingUrl } from "@/lib/graph";

const DEFAULT_EXCEL_URL =
  "https://1drv.ms/x/c/47d725223a1454d8/IQCi76yAHJJFSq6coiwBhiSKAW9XXYri66fm3H9RuaPBg4g?e=9CHRdl";

export async function GET(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("graph_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "No hay access token. Debes iniciar sesión primero." },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const sharedUrl = url.searchParams.get("url") || DEFAULT_EXCEL_URL;
    const requestedSheet = url.searchParams.get("sheet");

    const client = getGraphClient(accessToken);
    const shareId = encodeSharingUrl(sharedUrl);

    const sharedItem = await client.api(`/shares/${shareId}/driveItem`).get();

    const driveId = sharedItem?.parentReference?.driveId;
    const itemId = sharedItem?.id;

    if (!driveId || !itemId) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo resolver driveId/itemId del archivo compartido.",
          sharedItem,
        },
        { status: 400 }
      );
    }

    const worksheetsResponse = await client
      .api(`/drives/${driveId}/items/${itemId}/workbook/worksheets`)
      .get();

    const worksheets = worksheetsResponse?.value ?? [];
    const selectedSheetName =
      requestedSheet || worksheets?.[0]?.name || null;

    if (!selectedSheetName) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se encontraron hojas en el workbook.",
          worksheets,
        },
        { status: 400 }
      );
    }

    const usedRange = await client
      .api(
        `/drives/${driveId}/items/${itemId}/workbook/worksheets('${selectedSheetName}')/usedRange(valuesOnly=true)`
      )
      .get();

    const values = usedRange?.values ?? [];

    return NextResponse.json({
      ok: true,
      file: {
        id: itemId,
        driveId,
        name: sharedItem?.name ?? null,
        webUrl: sharedItem?.webUrl ?? null,
      },
      availableSheets: worksheets.map((w: any) => ({
        id: w.id,
        name: w.name,
        position: w.position,
      })),
      selectedSheetName,
      rowCount: Array.isArray(values) ? values.length : 0,
      sampleTopRows: Array.isArray(values) ? values.slice(0, 25) : [],
      rawValues: values,
    });
  } catch (error: any) {
    console.error("Error leyendo Excel compartido:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "No se pudo leer el Excel compartido",
        details: error?.body || null,
      },
      { status: 500 }
    );
  }
}