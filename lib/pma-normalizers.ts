import type { PMAComponentType } from "@/lib/pma-types";

function removeAccents(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(value: string) {
  return removeAccents(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTextUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

export function makeSafeId(prefix: string, index: number, ot: string, pt: string) {
  const base = `${prefix}-${index}-${ot || "sin-ot"}-${pt || "sin-pt"}`;
  return base.replace(/[^A-Z0-9_-]/gi, "-");
}

export function normalizeSubstation(value: string) {
  let text = normalizeTextUpper(value || "");

  text = text
    .replace(/\bSUBESTACION\b/g, "")
    .replace(/\bSUBESTACIÓN\b/g, "")
    .replace(/\bS\/E\b/g, "")
    .replace(/\bSSEE\b/g, "")
    .replace(/\bSE\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

export function normalizeEstado(value: string) {
  return normalizeTextUpper(value || "");
}

export function isPendienteEstado(value: string) {
  const estado = normalizeEstado(value);

  if (!estado) return false;

  return (
    estado.includes("PENDIENTE") ||
    estado.includes("PROGRAMAD") ||
    estado.includes("PLANIFIC") ||
    estado.includes("NO EJECUT") ||
    estado.includes("POR EJECUTAR")
  );
}

export function parseBooleanLike(value: string) {
  const v = normalizeTextUpper(value || "");
  return (
    v === "SI" ||
    v === "SÍ" ||
    v === "TRUE" ||
    v === "1" ||
    v === "X" ||
    v === "REPROGRAMADO"
  );
}

function normalizeDateCandidate(value: string) {
  const raw = normalizeText(value || "");
  if (!raw) return "";

  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    return raw;
  }

  const ddmmyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (ddmmyy) {
    const [, dd, mm, yy] = ddmmyy;
    const yyyy = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

export function getPreferredFecha(
  fechaProgramada: string,
  fecha1: string,
  fechaReprogramacionFinal: string
) {
  return (
    normalizeDateCandidate(fechaProgramada) ||
    normalizeDateCandidate(fecha1) ||
    normalizeDateCandidate(fechaReprogramacionFinal) ||
    ""
  );
}

export function buildActividadResumen(
  textoBreve: string,
  descripcionActividad: string,
  descripcion1: string
) {
  const parts = [textoBreve, descripcionActividad, descripcion1]
    .map((x) => normalizeText(x))
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const part of parts) {
    const key = part.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(part);
    }
  }

  return unique.join(" / ");
}

function detectTransformador(text: string, especialidad: string) {
  const isTR = normalizeTextUpper(especialidad) === "TR";

  const tMatch = text.match(/\bT\s*([1-9][0-9]*)\b/);
  const nMatch = text.match(/\bTR\s*([1-9][0-9]*)\b/);

  if (isTR && tMatch) return `Transformador T${tMatch[1]}`;
  if (isTR && nMatch) return `Transformador TR${nMatch[1]}`;

  if (isTR) return "Transformador";
  return "";
}

function detectInterruptor(text: string) {
  if (/\b52\b/.test(text)) {
    const num = text.match(/\b52[-\s]?([A-Z0-9]+)\b/);
    if (num?.[1]) return `Interruptor 52-${num[1]}`;
    return "Interruptor 52";
  }

  if (text.includes("INTERRUPTOR")) return "Interruptor";
  return "";
}

function detectDesconectador(text: string) {
  if (/\b89\b/.test(text)) {
    const num = text.match(/\b89[-\s]?([A-Z0-9]+)\b/);
    if (num?.[1]) return `Desconectador 89-${num[1]}`;
    return "Desconectador 89";
  }

  if (text.includes("DESCONECTADOR")) return "Desconectador";
  if (text.includes("SECCIONADOR")) return "Seccionador";
  return "";
}

function detectBarra(text: string) {
  if (text.includes("BARRA")) return "Barra";

  const bp = text.match(/\bBP\s*([12])\b/);
  if (bp) return `Barra BP${bp[1]}`;

  const b = text.match(/\bB\s*([12])\b/);
  if (b) return `Barra B${b[1]}`;

  return "";
}

function detectLineaCircuito(text: string) {
  if (text.includes("LINEA")) return "Línea";
  if (text.includes("LINEA")) return "Línea";
  if (text.includes("CIRCUITO")) return "Circuito";
  if (/\bCTO\b/.test(text)) return "Circuito";
  return "";
}

function detectProtecciones(text: string) {
  if (text.includes("PROTECCION")) return "Protecciones";
  if (text.includes("PROTECCIONES")) return "Protecciones";
  if (text.includes("RELE")) return "Protecciones";
  return "";
}

function detectTablero(text: string) {
  if (text.includes("TABLERO")) return "Tablero";
  if (text.includes("CELDA")) return "Celda";
  return "";
}

export function detectComponent(
  textoBreve: string,
  descripcionActividad: string,
  descripcion1: string,
  especialidad: string
): {
  componenteDetectado: string;
  componenteTipo: PMAComponentType;
} {
  const combined = normalizeTextUpper(
    [textoBreve, descripcionActividad, descripcion1].filter(Boolean).join(" / ")
  );

  const transformador = detectTransformador(combined, especialidad);
  if (transformador) {
    return {
      componenteDetectado: transformador,
      componenteTipo: "TRANSFORMADOR",
    };
  }

  const interruptor = detectInterruptor(combined);
  if (interruptor) {
    return {
      componenteDetectado: interruptor,
      componenteTipo: "INTERRUPTOR",
    };
  }

  const desconectador = detectDesconectador(combined);
  if (desconectador) {
    return {
      componenteDetectado: desconectador,
      componenteTipo: desconectador.includes("Seccionador")
        ? "SECCIONADOR"
        : "DESCONECTADOR",
    };
  }

  const barra = detectBarra(combined);
  if (barra) {
    return {
      componenteDetectado: barra,
      componenteTipo: "BARRA",
    };
  }

  const linea = detectLineaCircuito(combined);
  if (linea) {
    return {
      componenteDetectado: linea,
      componenteTipo: "LINEA_CIRCUITO",
    };
  }

  const protecciones = detectProtecciones(combined);
  if (protecciones) {
    return {
      componenteDetectado: protecciones,
      componenteTipo: "PROTECCIONES",
    };
  }

  const tablero = detectTablero(combined);
  if (tablero) {
    return {
      componenteDetectado: tablero,
      componenteTipo: "TABLERO",
    };
  }

  return {
    componenteDetectado: "No determinado",
    componenteTipo: "NO_DETERMINADO",
  };
}