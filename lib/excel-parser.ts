export type ParsedJob = {
  fecha: string;
  pt: string;
  area: string;
  zonal: string;
  tipoPermiso: string;
  sseeOLT: string;
  componente: string;
  descripcion: string;
  prog: string;
  inicio: string;
  finalizacion: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRowToAK(row: unknown[]) {
  const trimmed = row.slice(0, 11);
  while (trimmed.length < 11) trimmed.push("");
  return trimmed.map(normalizeText);
}

function isEmptyRow(row: string[]) {
  return row.every((cell) => cell === "");
}

function excelSerialToDateString(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;

  const utcDays = Math.floor(n - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);

  if (Number.isNaN(date.getTime())) return null;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function normalizeDateValue(value: string) {
  const clean = value.trim();

  if (!clean) return "";

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("-");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(clean)) {
    const [d, m, y] = clean.split("/");
    const year = Number(y) < 50 ? `20${y}` : `19${y}`;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${year}`;
  }

  if (/^\d+(\.\d+)?$/.test(clean)) {
    const converted = excelSerialToDateString(clean);
    if (converted) return converted;
  }

  return clean;
}

function isLikelyDate(value: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function isHeaderRow(row: string[]) {
  const joined = row.join(" ").toLowerCase();
  return (
    joined.includes("fecha") &&
    joined.includes("pt") &&
    joined.includes("area")
  );
}

function isDayTitleRow(row: string[]) {
  const joined = row.join(" ").toUpperCase();
  return (
    joined.includes("LUNES") ||
    joined.includes("MARTES") ||
    joined.includes("MIERCOLES") ||
    joined.includes("MIÉRCOLES") ||
    joined.includes("JUEVES") ||
    joined.includes("VIERNES") ||
    joined.includes("SABADO") ||
    joined.includes("SÁBADO") ||
    joined.includes("DOMINGO")
  );
}

function isNoiseRow(row: string[]) {
  const joined = row.join(" ").toUpperCase();
  if (!joined) return true;
  if (joined.includes("#VALUE!")) return true;

  const nonEmpty = row.filter(Boolean);
  if (
    nonEmpty.length > 0 &&
    nonEmpty.every((v) => /^(\d+([.,]\d+)?)$/.test(v))
  ) {
    return true;
  }

  return false;
}

function hasRelevantContent(row: string[]) {
  return Boolean(row[1] || row[5] || row[6] || row[7]);
}

export function parseExcelRowsToJobs(rows: unknown[][]): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  let lastFecha = "";

  for (const rawRow of rows) {
    const row = normalizeRowToAK(rawRow);

    if (isEmptyRow(row)) continue;
    if (isHeaderRow(row)) continue;
    if (isDayTitleRow(row)) continue;
    if (isNoiseRow(row)) continue;

    const maybeFecha = normalizeDateValue(row[0]);
    const fecha = isLikelyDate(maybeFecha) ? maybeFecha : lastFecha;

    const pt = row[1];
    const area = row[2];
    const zonal = row[3];
    const tipoPermiso = row[4];
    const sseeOLT = row[5];
    const componente = row[6];
    const descripcion = row[7];
    const prog = row[8];
    const inicio = row[9];
    const finalizacion = row[10];

    if (isLikelyDate(maybeFecha)) {
      lastFecha = maybeFecha;
    }

    if (!fecha) continue;
    if (!hasRelevantContent(row)) continue;

    jobs.push({
      fecha,
      pt,
      area,
      zonal,
      tipoPermiso,
      sseeOLT,
      componente,
      descripcion,
      prog,
      inicio,
      finalizacion,
    });
  }

  return jobs;
}