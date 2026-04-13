import { parseExcel } from "@/lib/excel-parser";

export async function GET() {
  try {
    const EXCEL_URL = "AQUI_TU_LINK_DE_DESCARGA_DIRECTA";

    const response = await fetch(EXCEL_URL);

    if (!response.ok) {
      return Response.json(
        { error: "No se pudo descargar el Excel" },
        { status: 500 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    const trabajos = parseExcel(arrayBuffer);

    return Response.json({
      total: trabajos.length,
      trabajos,
    });
  } catch (error) {
    return Response.json(
      { error: "Error leyendo Excel" },
      { status: 500 }
    );
  }
}