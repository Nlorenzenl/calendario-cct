import { parse } from "csv-parse/sync";

export async function GET() {
  try {
    const CSV_URL =
      "https://docs.google.com/spreadsheets/d/1LRs1bUpAMiArvxbSfMQX56hikI2DWPErkC8fHp24ja0/export?format=csv";

    const response = await fetch(CSV_URL);

    if (!response.ok) {
      return Response.json(
        { error: "No se pudo descargar el CSV" },
        { status: 500 }
      );
    }

    const text = await response.text();

    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
    });

    const trabajos = records.map((row: any) => {
      const [day, month, year] = row["Fecha"].split("/");

      return {
        fecha: new Date(`${year}-${month}-${day}`),
        pt: row["N° PT"] || "Sin PT",
        ssee: row["SSEE O LT"] || "",
        descripcion: row["Descripcion"] || "",
      };
    });

    return Response.json({
      total: trabajos.length,
      trabajos,
    });
  } catch (error) {
    return Response.json(
      { error: "Error leyendo CSV" },
      { status: 500 }
    );
  }
}