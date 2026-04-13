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
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value: string): string {
  const clean = normalizeText(value);

  if (!clean) return "";

  const ddmmyyyy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${day}/${month}/${year}`;
  }

  const ddmmyy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (ddmmyy) {
    const day = ddmmyy[1].padStart(2, "0");
    const month = ddmmyy[2].padStart(2, "0");
    const yy = Number(ddmmyy[3]);
    const year = yy < 50 ? `20${ddmmyy[3]}` : `19${ddmmyy[3]}`;
    return `${day}/${month}/${year}`;
  }

  return clean;
}

function isValidDate(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function isHeaderRow(row: string[]): boolean {
  const a = normalizeText(row[0]).toLowerCase();
  const b = normalizeText(row[1]).toLowerCase();
  return a === "fecha" && (b.includes("pt") || b.includes("n° pt") || b.includes("nº pt"));
}

function isDayTitleRow(row: string[]): boolean {
  const joined = row.map(normalizeText).join(" ").toLowerCase();
  return (
    joined.includes("lunes") ||
    joined.includes("martes") ||
    joined.includes("miercoles") ||
    joined.includes("miércoles") ||
    joined.includes("jueves") ||
    joined.includes("viernes") ||
    joined.includes("sabado") ||
    joined.includes("sábado") ||
    joined.includes("domingo")
  );
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => normalizeText(cell) === "");
}

function hasUsefulContent(row: string[]): boolean {
  return Boolean(
    normalizeText(row[1]) ||
    normalizeText(row[2]) ||
    normalizeText(row[5]) ||
    normalizeText(row[6]) ||
    normalizeText(row[7])
  );
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

    const rows = parse(text, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
      trim: false,
    }) as string[][];

    const trabajos: Trabajo[] = [];
    let lastFecha = "";

    for (const rawRow of rows) {
      const row = rawRow.slice(0, 11);
      while (row.length < 11) row.push("");

      const aToK = row.map(normalizeText);

      if (isEmptyRow(aToK)) continue;
      if (isDayTitleRow(aToK)) continue;
      if (isHeaderRow(aToK)) continue;

      const fechaNormalizada = normalizeDate(aToK[0]);
      if (isValidDate(fechaNormalizada)) {
        lastFecha = fechaNormalizada;
      }

      const fecha = isValidDate(fechaNormalizada) ? fechaNormalizada : lastFecha;
      if (!fecha) continue;
      if (!hasUsefulContent(aToK)) continue;

      trabajos.push({
        fecha,
        pt: aToK[1] || "Sin PT",
        area: aToK[2],
        zonal: aToK[3],
        tipoPermiso: aToK[4],
        ssee: aToK[5],
        componente: aToK[6],
        descripcion: aToK[7],
        prog: aToK[8],
        hinicio: aToK[9],
        hfinalizacion: aToK[10],
      });
    }

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