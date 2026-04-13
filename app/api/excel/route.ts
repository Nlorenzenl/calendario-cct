import { parse } from "csv-parse/sync";

type Trabajo = {
  fecha: string;
  pt: string;
  area: string;
  zonal: string;
  tipoPermiso: string;
  ssee: string;
  componente: string;
  descripcion: string;
  prog: string;
  hinicio: string;
  hfinalizacion: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeDate(value: string): string {
  const clean = normalizeText(value);
  if (!clean) return "";

  const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return clean;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];

  return `${day}/${month}/${year}`;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (key in row) return normalizeText(row[key]);
  }
  return "";
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
        // A
        const fecha = normalizeDate(
          pick(row, ["Fecha", "fecha"])
        );

        // B
        const pt = pick(row, ["N° PT", "Nº PT", "N°PT", "PT"]);

        // C
        const area = pick(row, ["Area", "Área"]);

        // D
        const zonal = pick(row, ["Zonal"]);

        // E
        const tipoPermiso = pick(row, [
          "Tipo de permiso de trabajo",
          "Tipo permiso",
          "Tipo"
        ]);

        // F
        const ssee = pick(row, [
          "SSEE o LT",
          "SSEE O LT",
          "SSEE o lt",
          "SSEE"
        ]);

        // G
        const componente = pick(row, ["Componente"]);

        // H
        const descripcion = pick(row, [
          "Descripción",
          "Descripcion",
          "Descripción del trabajo general",
          "Descripcion del trabajo general"
        ]);

        // I
        const prog = pick(row, ["Prog"]);

        // J
        const hinicio = pick(row, ["Hinicio", "Inicio", "Hinicio"]);

        // K
        const hfinalizacion = pick(row, [
          "Hfinalización",
          "Hfinalizacion",
          "Finalización",
          "Finalizacion"
        ]);

        if (!fecha) return null;

        return {
          fecha,
          pt: pt || "Sin PT",
          area,
          zonal,
          tipoPermiso,
          ssee,
          componente,
          descripcion,
          prog,
          hinicio,
          hfinalizacion,
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