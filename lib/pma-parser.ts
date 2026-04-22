import type { PMAItem, PMAOriginalRow } from "@/lib/pma-types";
import {
  buildActividadResumen,
  detectComponent,
  getPreferredFecha,
  isPendienteEstado,
  makeSafeId,
  normalizeEstado,
  normalizeSubstation,
  normalizeText,
  parseBooleanLike,
} from "@/lib/pma-normalizers";

function decodeLatin1(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("latin1").decode(buffer);
  } catch {
    return new TextDecoder().decode(buffer);
  }
}

function splitCsvLineSemicolon(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ";" && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((x) => x.trim());
}

function parseCsvSemicolon(text: string) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (!lines.length) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const headers = splitCsvLineSemicolon(lines[0]).map((h) => h.trim());

  const rows = lines.slice(1).map((line) => splitCsvLineSemicolon(line));

  return { headers, rows };
}

function buildOriginalRow(headers: string[], row: string[]): PMAOriginalRow {
  const obj: PMAOriginalRow = {};

  headers.forEach((header, idx) => {
    obj[header] = row[idx] ?? "";
  });

  return obj;
}

function getField(original: PMAOriginalRow, names: string[]) {
  for (const name of names) {
    if (name in original) {
      return String(original[name] || "");
    }
  }
  return "";
}

export async function parsePMAFile(file: File): Promise<PMAItem[]> {
  const buffer = await file.arrayBuffer();
  const text = decodeLatin1(buffer);
  const { headers, rows } = parseCsvSemicolon(text);

  const items: PMAItem[] = [];

  rows.forEach((row, index) => {
    const original = buildOriginalRow(headers, row);

    const ot = normalizeText(getField(original, ["OT"]));
    const pt = normalizeText(getField(original, ["PT"]));

    const textoBreve = normalizeText(getField(original, ["Texto breve"]));
    const descripcionActividad = normalizeText(
      getField(original, ["DESCRIPCIÓN DE ACTIVIDAD", "DESCRIPCION DE ACTIVIDAD"])
    );
    const descripcion1 = normalizeText(
      getField(original, ["DESCRIPCIÓN_1", "DESCRIPCION_1"])
    );

    const subestacionOriginal = normalizeText(
      getField(original, ["Subestacion", "Subestación"])
    );
    const subestacionNormalizada = normalizeSubstation(subestacionOriginal);

    const especialidad = normalizeText(getField(original, ["Especialidad"]));
    const plan = normalizeText(getField(original, ["Plan"]));

    const fechaProgramada = normalizeText(getField(original, ["Fecha Programada"]));
    const fecha1 = normalizeText(getField(original, ["Fecha 1"]));
    const fechaReprogramacionFinal = normalizeText(
      getField(original, ["Fecha Reprogramación final", "Fecha Reprogramacion final"])
    );

    const estadoOriginal = normalizeText(getField(original, ["Estado"]));
    const estadoNormalizado = normalizeEstado(estadoOriginal);

    const reprogramadoRaw = normalizeText(getField(original, ["Reprogramado"]));
    const ptRepetido = normalizeText(getField(original, ["PT REPETIDO"]));
    const mesPma = normalizeText(getField(original, ["Mes PMA"]));
    const mesPmaBarra = normalizeText(getField(original, ["MES PMA Barra"]));

    const fechaBase = getPreferredFecha(
      fechaProgramada,
      fecha1,
      fechaReprogramacionFinal
    );

    const actividadResumen = buildActividadResumen(
      textoBreve,
      descripcionActividad,
      descripcion1
    );

    const { componenteDetectado, componenteTipo } = detectComponent(
      textoBreve,
      descripcionActividad,
      descripcion1,
      especialidad
    );

    const item: PMAItem = {
      id: makeSafeId("pma", index, ot, pt),
      ot,
      pt,

      subestacionOriginal,
      subestacionNormalizada,

      textoBreve,
      descripcionActividad,
      descripcion1,

      actividadResumen,

      componenteDetectado,
      componenteTipo,

      especialidad,
      plan,

      fechaBase,
      fechaProgramada,
      fecha1,
      fechaReprogramacionFinal,

      estadoOriginal,
      estadoNormalizado,
      pendiente: isPendienteEstado(estadoOriginal),

      reprogramado: parseBooleanLike(reprogramadoRaw),
      ptRepetido,

      mesPma,
      mesPmaBarra,

      original,
    };

    items.push(item);
  });

  return items;
}