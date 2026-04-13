import { parse } from "csv-parse/sync";

type Trabajo = {
  fecha: string;
  pt: string;
  ssee: string;
  descripcion: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeDate(value: string): string {
  const clean = normalizeText(value);

  if (!clean) return "";

  const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    return `${day}/${month}/${year}`;
  }

  return clean;
}

export async function GET() {
  try {
    const CSV_URL =
      "https://docs.google.com/spreadsheets/d/1LRs1bUpAMiArvxbSfMQX56hikI2DWPErkC8fHp24ja0/export?format=csv&gid=161464463";

    const response = await fetch(CSV_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        {
          error: "No se pudo descargar el CSV",
          status: response.status,
        },
        { status: 500 }
      );
    }

    const text = await response.text();

    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, string>[];

    const trabajos: Trabajo[] = records
      .map((row) => {
        const fecha = normalizeDate(row["Fecha"]);
        const pt = normalizeText(row["N° PT"] || row["Nº PT"] || "");
        const ssee = normalizeText(row["SSEE O LT"] || row["SSEE o LT"] || "");
        const descripcion = normalizeText(
          row["Descripcion"] ||
            row["Descripción"] ||
            row["Descripción del trabajo general"] ||
            ""
        );

        if (!fecha) return null;
        if (!pt && !ssee && !descripcion) return null;

        return {
          fecha,
          pt: pt || "Sin PT",
          ssee,
          descripcion,
        };
      })
      .filter((item): item is Trabajo => item !== null);

    return Response.json({
      total: trabajos.length,
      trabajos,
    });
  } catch (error: any) {
    console.error("Error leyendo CSV:", error);

    return Response.json(
      {
        error: "Error leyendo CSV",
        details: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}