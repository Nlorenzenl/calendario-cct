"use client";

import React, { useEffect, useMemo, useState } from "react";
import { gsAppend, gsRead, gsReplaceAll, makeId } from "@/lib/google-sheet";
import type { PMAItem } from "@/lib/pma-types";
import { parsePMAFile } from "@/lib/pma-parser";

type OpatTrabajo = {
  id?: string;
  pt: string;
  zona?: string;
  area?: string;
  tipo?: string;
  inicio?: string;
  fin?: string;
  ssee?: string;
  comp?: string;
  desc?: string;
  obs?: string;
  re?: string;
  req_ro?: string;
  prog?: string;
  aviso?: string;
  sodi?: string;
  estado?: string;
  fInicio?: string;
  fFin?: string;
  to1?: string;
  to2?: string;
  go1?: string;
  go2?: string;
  gop?: string;
  esSodi?: string;
  sodiCorrelativo?: string;
  sodiPara?: string;
  sodiDe?: string;
  gm?: string;
  ultima_modificacion?: string;
  historial?: string;
};

type TrabajoUI = {
  id: string;
  original: OpatTrabajo;
  fecha: string;
  pt: string;
  horaInicio: string;
  horaFin: string;
  subestacion: string;
  componente: string;
  actividad: string;
  estado: string;
  tipo: string;
  observacion: string;
  programador: string;
  area: string;
  aviso: string;
  sodi: string;
};

type CalendarDay = {
  date: Date;
  iso: string;
  inMonth: boolean;
};

type NewPTForm = {
  pt: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  subestacion: string;
  componente: string;
  actividad: string;
  observacion: string;
  estado: string;
  tipo: string;
  programador: string;
  aviso: string;
  sodi: string;
};

type EditPTForm = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  subestacion: string;
  componente: string;
  actividad: string;
  observacion: string;
  estado: string;
  tipo: string;
  programador: string;
  aviso: string;
  sodi: string;
};

type SodiTercerosForm = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  subestacion: string;
  componente: string;
  actividad: string;
  observacion: string;
  programador: string;
  aviso: string;
};

type HistoryItem = {
  id: string;
  tipo: "reprogramacion" | "suspension" | "acople";
  pt: string;
  fechaOrigen: string;
  fechaDestino: string;
  motivo: string;
  timestamp: string;
  detalle?: string;
  usuario?: string;
  origen?: string;
};

type ToastState = {
  visible: boolean;
  message: string;
};

type CenAlertItem = {
  id: string;
  pt: string;
  fecha: string;
  subestacion: string;
  componente: string;
  actividad: string;
  aviso: string;
  motivo: "4_dias_habiles" | "12_dias_corridos";
};

type AcopleGroup = {
  id: string;
  leaderId: string;
  memberIds: string[];
  createdAt: string;
};

type DayOverflowState = {
  open: boolean;
  date: string;
};

type EssentialPattern = {
  source: string;
  category: "barra" | "lltt" | "transformador";
  tokens: string[];
};

type PmaSummary = {
  total: number;
  pendientes: number;
  ejecutados: number;
  reprogramados: number;
  anulados: number;
  otros: number;
};

type ProgramadosSummary = {
  total: number;
  enProgramacion: number;
  autorizados: number;
  suspendidos: number;
};

const LS_ACOPLES_KEY = "cct_acoples_v1";
const LS_HISTORIAL_KEY = "cct_historial_v1";
const DEFAULT_USUARIO = "Nicolás Lorenzen";
const DEFAULT_ORIGEN = "APP_CALENDARIO_CCT";

const PMA_HEADERS = [
  "id",
  "ot",
  "pt",
  "subestacionOriginal",
  "subestacionNormalizada",
  "textoBreve",
  "descripcionActividad",
  "descripcion1",
  "actividadResumen",
  "componenteDetectado",
  "componenteTipo",
  "especialidad",
  "plan",
  "fechaBase",
  "fechaProgramada",
  "fecha1",
  "fechaReprogramacionFinal",
  "estadoOriginal",
  "estadoNormalizado",
  "pendiente",
  "reprogramado",
  "ptRepetido",
  "mesPma",
  "mesPmaBarra",
];

const CHILE_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-04-03",
  "2026-04-04",
  "2026-05-01",
  "2026-05-21",
  "2026-06-21",
  "2026-06-29",
  "2026-07-16",
  "2026-08-15",
  "2026-09-18",
  "2026-09-19",
  "2026-10-12",
  "2026-10-31",
  "2026-11-01",
  "2026-12-08",
  "2026-12-25",
];

const ESSENTIAL_BARRAS = [
  "BA S/E KAPATUR 220KV BP1",
  "BA S/E KAPATUR 220KV BP2",
  "BA S/E BUIN (ENEL TRANSMISION) 110KV BP1",
  "BA S/E CHENA 110KV BP1",
  "BA S/E EL SALTO 110KV BP1-1",
  "BA S/E EL SALTO 110KV BP1-2",
  "BA S/E FLORIDA 110KV BP1",
  "BA S/E LOS ALMENDROS 110KV BP1",
  "BA S/E OCHAGAVIA 110KV BP1",
  "BA S/E OCHAGAVIA 110KV BP2",
  "BA S/E EL SALTO 110KV BP2-1",
  "BA S/E EL SALTO 110KV BP2-2",
  "BA S/E ANTILLANCA 110KV BP1",
  "BA S/E VALDIVIA (STS) 66KV BP1-S1",
  "BA S/E PILAUCO 66KV BP1",
  "BA S/E CHILOE 110KV BP1",
  "BA S/E CHENA 110KV BP2",
  "BA S/E CERRO NAVIA (STM II) 110KV B1",
  "BA S/E CERRO NAVIA (STM II) 110KV B2",
  "BA S/E EL SALTO 220KV BP1",
  "BA S/E LOS ALMENDROS 220KV BP2",
  "BA S/E ANTILLANCA 220KV BP1",
  "BA S/E PILAUCO 220KV BA1",
  "BA S/E CHENA 220KV BP1",
  "BA S/E CHENA 220KV BP2 (AIS)",
  "BA S/E MONTENEGRO 154KV BP1",
  "BA S/E PARGUA 220KV BP1",
  "BA S/E PARGUA 220KV BP2",
  "BA S/E CHILOE 220KV BP1",
  "BA S/E CHILOE 220KV BP2",
  "BA S/E PUERTO MONTT (STS) 220KV BP3",
  "BA S/E NUEVA LAMPA 220KV BP1",
  "BA S/E NUEVA LAMPA 220KV BP2",
];

const ESSENTIAL_LLTT = [
  "PUERTO MONTT - MELIPULLI 220KV",
  "ALTO JAHUEL - BUIN (STM) 220KV",
  "SAN BERNARDO - MALLOCO 110KV",
  "ALTO JAHUEL - FLORIDA 110KV",
  "ALTO JAHUEL - LOS ALMENDROS 220KV",
  "CERRO NAVIA (STM) - CHENA 110KV",
  "LOS ALMENDROS - EL SALTO 110KV",
  "FLORIDA - LOS ALMENDROS 110KV",
  "TAP LO ESPEJO - BUIN (STM) 110KV",
  "LO ESPEJO - OCHAGAVIA 110KV",
  "OCHAGAVIA - FLORIDA 110KV",
  "POLPAICO (TRANSELEC) - EL SALTO 220KV",
  "EL SALTO - CERRO NAVIA (STM) 110KV",
  "RAHUE - PILAUCO 220KV",
  "ANTILLANCA - RAHUE 220KV",
  "KAPATUR - O'HIGGINS 220KV",
  "MELIPULLI - PARGUA 220KV",
  "LLANQUIHUE - TAP LLANQUIHUE 220KV",
  "PARGUA - NUEVA ANCUD 220KV",
  "NUEVA ANCUD - CHILOE 220KV",
];

const ESSENTIAL_TRANSFORMERS = [
  "ANTILLANCA 220/110/23KV 180MVA ATR T1 + UR",
  "ATR N°1 220/110/13.8KV 400MVA",
  "CERRO NAVIA ATR N°2 220/110/13.2KV 400MVA",
  "CHENA 220/110/13.8KV 400MVA 1",
  "CHENA 220/110/13.8KV 400MVA 2",
  "CHILOE 220/110/23KV 90MVA ATR T1 + UR",
  "DEGAÑ 115/24KV 40MVA N°1",
  "EL SALTO 220/110/34.5KV 400MVA 1 + URC",
  "EL SALTO 220/110/34.5KV 400MVA 2 + URC",
  "LLANQUIHUE 230/69/24KV 90MVA T1",
  "LOS ALMENDROS 220/110KV 400MVA 1 + UR",
  "MELIPULLI 230/115/69KV 60MVA 11",
  "MELIPULLI 230/115/69KV 60MVA 22",
  "MONTENEGRO 230-254/69/13.8KV 75MVA T1",
  "NUEVA PICHIRROPULLI 230/69/24KV 90MVA N°1",
  "NUEVA PICHIRROPULLI 230/69/24KV 90MVA N°2",
  "PARGUA 230/115-69 KV 60MVA 1",
  "PILAUCO 220/66/23kV 120MVA ATR T1 + UR",
  "VALDIVIA 230/69/13,8KV 60MVA T1",
  "VALDIVIA 230/69/13,8KV 60MVA T4",
];

const COMMON_STOPWORDS = new Set([
  "s",
  "se",
  "e",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "en",
  "con",
  "para",
  "por",
  "ba",
  "kv",
  "mva",
  "stm",
  "sts",
  "ii",
  "iii",
  "bp",
  "n",
  "no",
  "ur",
  "urc",
  "tap",
  "cto",
]);

function truncate(text: string, max = 90) {
  if (!text) return "-";
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}

function truncateSoft(text: string, max = 28) {
  if (!text) return "-";
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}

function normalizeText(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[\/]/g, " ")
    .replace(/-/g, " ")
    .replace(/,/g, " ")
    .replace(/\./g, " ")
    .toLowerCase()
    .trim();
}

function isAssignedProgramador(programador: string) {
  const value = String(programador || "").trim();
  if (!value) return false;
  if (value === "-") return false;
  return true;
}

function compareDateTime(a: TrabajoUI, b: TrabajoUI) {
  const aKey = `${a.fecha} ${a.horaInicio || "00:00"}`;
  const bKey = `${b.fecha} ${b.horaInicio || "00:00"}`;
  return aKey.localeCompare(bKey);
}

function toLocalDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODateLocal(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}

function formatTimestamp(date: Date) {
  return date.toLocaleString("es-CL");
}

function buildMonthGrid(monthDate: Date): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startWeekDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const days: CalendarDay[] = [];

  for (let i = startWeekDay; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    days.push({
      date: d,
      iso: toLocalDateInputValue(d),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    days.push({
      date: d,
      iso: toLocalDateInputValue(d),
      inMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    const nextIndex = days.length - (startWeekDay + daysInMonth) + 1;
    const d = new Date(year, month + 1, nextIndex);
    days.push({
      date: d,
      iso: toLocalDateInputValue(d),
      inMonth: false,
    });
  }

  return days;
}

function estadoColor(estado: string, programador = "") {
  if (estado === "Autorizado") {
    return {
      background: "#edfdf3",
      color: "#0f8a43",
      border: "#b7ebc6",
    };
  }

  if (estado === "Suspendido") {
    return {
      background: "#fff1f1",
      color: "#b42318",
      border: "#f3c4c4",
    };
  }

  if (isAssignedProgramador(programador)) {
    return {
      background: "#dbeafe",
      color: "#1e3a8a",
      border: "#93c5fd",
    };
  }

  return {
    background: "#f3f6ff",
    color: "#334155",
    border: "#cdd7ff",
  };
}

function emptyNewPTForm(fecha = ""): NewPTForm {
  return {
    pt: "",
    fecha,
    horaInicio: "08:00",
    horaFin: "18:00",
    subestacion: "",
    componente: "",
    actividad: "",
    observacion: "",
    estado: "En programación",
    tipo: "DESCONEXIÓN",
    programador: "",
    aviso: "",
    sodi: "",
  };
}

function emptySodiTercerosForm(fecha = ""): SodiTercerosForm {
  return {
    fecha,
    horaInicio: "08:00",
    horaFin: "18:00",
    subestacion: "",
    componente: "",
    actividad: "",
    observacion: "",
    programador: "",
    aviso: "",
  };
}

function buildEditForm(trabajo: TrabajoUI): EditPTForm {
  return {
    fecha: trabajo.fecha,
    horaInicio: trabajo.horaInicio || "08:00",
    horaFin: trabajo.horaFin || "18:00",
    subestacion: trabajo.subestacion || "",
    componente: trabajo.componente || "",
    actividad: trabajo.actividad || "",
    observacion: trabajo.observacion || "",
    estado: trabajo.estado || "En programación",
    tipo: trabajo.tipo || "DESCONEXIÓN",
    programador: trabajo.programador || "",
    aviso: trabajo.aviso || "",
    sodi: trabajo.sodi || "",
  };
}

function classifyPmaStatus(item: PMAItem): keyof Omit<PmaSummary, "total"> {
  if (item.reprogramado) return "reprogramados";

  const estado = normalizeText(item.estadoOriginal || "");

  if (
    estado.includes("ejecut") ||
    estado.includes("realiz") ||
    estado.includes("termin")
  ) {
    return "ejecutados";
  }

  if (estado.includes("anul") || estado.includes("cancel")) {
    return "anulados";
  }

  if (
    estado.includes("pend") ||
    estado.includes("program") ||
    estado.includes("planific") ||
    estado.includes("no ejecut")
  ) {
    return "pendientes";
  }

  return "otros";
}

function buildPmaSummary(items: PMAItem[]): PmaSummary {
  const summary: PmaSummary = {
    total: items.length,
    pendientes: 0,
    ejecutados: 0,
    reprogramados: 0,
    anulados: 0,
    otros: 0,
  };

  for (const item of items) {
    summary[classifyPmaStatus(item)] += 1;
  }

  return summary;
}

function buildProgramadosSummary(items: TrabajoUI[]): ProgramadosSummary {
  let enProgramacion = 0;
  let autorizados = 0;
  let suspendidos = 0;

  for (const item of items) {
    if (item.estado === "Autorizado") {
      autorizados += 1;
    } else if (item.estado === "Suspendido") {
      suspendidos += 1;
    } else {
      enProgramacion += 1;
    }
  }

  return {
    total: items.length,
    enProgramacion,
    autorizados,
    suspendidos,
  };
}

function mapPmaToSheetRow(item: PMAItem) {
  return [
    item.id,
    item.ot,
    item.pt,
    item.subestacionOriginal,
    item.subestacionNormalizada,
    item.textoBreve,
    item.descripcionActividad,
    item.descripcion1,
    item.actividadResumen,
    item.componenteDetectado,
    item.componenteTipo,
    item.especialidad,
    item.plan,
    item.fechaBase,
    item.fechaProgramada,
    item.fecha1,
    item.fechaReprogramacionFinal,
    item.estadoOriginal,
    item.estadoNormalizado,
    item.pendiente ? "true" : "false",
    item.reprogramado ? "true" : "false",
    item.ptRepetido,
    item.mesPma,
    item.mesPmaBarra,
  ];
}
function containsCenCorrelativo(value: string) {
  return /\d{8,}/.test(value || "");
}

function requiresCenReview(trabajo: TrabajoUI) {
  if (normalizeText(trabajo.estado) === "suspendido") return false;

  const aviso = normalizeText(trabajo.aviso);

  if (!aviso) return true;
  if (aviso === "pendiente") return true;
  if (aviso === "no requiere") return false;
  if (containsCenCorrelativo(trabajo.aviso)) return false;

  return true;
}

function isHoliday(date: Date) {
  return CHILE_HOLIDAYS_2026.includes(toLocalDateInputValue(date));
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  return !isWeekend && !isHoliday(date);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subtractBusinessDays(date: Date, businessDays: number) {
  let d = new Date(date);
  let remaining = businessDays;

  while (remaining > 0) {
    d = addDays(d, -1);
    if (isBusinessDay(d)) {
      remaining -= 1;
    }
  }

  return d;
}

function subtractCalendarDays(date: Date, days: number) {
  return addDays(date, -days);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEffectiveOperationalDate(now: Date) {
  const base = startOfDay(now);
  if (now.getHours() < 7) {
    return addDays(base, -1);
  }
  return base;
}

function sameDate(a: Date, b: Date) {
  return toLocalDateInputValue(a) === toLocalDateInputValue(b);
}

function tokenizeForEssential(value: string) {
  const normalized = normalizeText(value)
    .replace(/\bs\/e\b/g, " se ")
    .replace(/\bcto\b/g, " circuito ")
    .replace(/\bctos\b/g, " circuito ")
    .replace(/\bint\b/g, " interruptor ")
    .replace(/\btr\b/g, " transformador ")
    .replace(/\batr\b/g, " atr ")
    .replace(/\bn°/g, " n ")
    .replace(/\bnº/g, " n ")
    .replace(/\s+/g, " ")
    .trim();

  const rawTokens = normalized.split(" ").filter(Boolean);

  return rawTokens.filter((token) => {
    if (COMMON_STOPWORDS.has(token)) return false;
    if (/^\d+$/.test(token)) return true;
    if (token.length <= 1) return false;
    return true;
  });
}

function buildEssentialPatterns(): EssentialPattern[] {
  const barras = ESSENTIAL_BARRAS.map((source) => ({
    source,
    category: "barra" as const,
    tokens: tokenizeForEssential(source),
  }));

  const lltt = ESSENTIAL_LLTT.map((source) => ({
    source,
    category: "lltt" as const,
    tokens: tokenizeForEssential(source),
  }));

  const transformadores = ESSENTIAL_TRANSFORMERS.map((source) => ({
    source,
    category: "transformador" as const,
    tokens: tokenizeForEssential(source),
  }));

  return [...barras, ...lltt, ...transformadores];
}

const ESSENTIAL_PATTERNS = buildEssentialPatterns();

function countMatches(tokens: string[], haystack: string) {
  let matches = 0;
  for (const token of tokens) {
    if (haystack.includes(` ${token} `)) {
      matches += 1;
    }
  }
  return matches;
}

function detectFlexibleEssentialByRules(trabajo: TrabajoUI) {
  const haystack = ` ${tokenizeForEssential(
    [
      trabajo.subestacion,
      trabajo.componente,
      trabajo.actividad,
      trabajo.tipo,
      trabajo.observacion,
    ].join(" ")
  ).join(" ")} `;

  const hasVoltage =
    haystack.includes(" 110 ") ||
    haystack.includes(" 220 ") ||
    haystack.includes(" 154 ") ||
    haystack.includes(" 66 ");

  const hasLineWord =
    haystack.includes(" circuito ") ||
    haystack.includes(" linea ") ||
    haystack.includes(" interruptor ");

  const hasTransformerWord =
    haystack.includes(" atr ") ||
    haystack.includes(" transformador ") ||
    haystack.includes(" t1 ") ||
    haystack.includes(" t2 ") ||
    haystack.includes(" n1 ") ||
    haystack.includes(" n2 ");

  if (hasVoltage && hasLineWord) {
    const matchedSubstations = [
      "chena",
      "navia",
      "cerro",
      "salto",
      "florida",
      "almendros",
      "buin",
      "malloco",
      "san",
      "bernardo",
      "ochagavia",
      "polpaico",
      "kapatur",
      "ohiggins",
      "pilauco",
      "antillanca",
      "pichirropulli",
      "pargua",
      "chiloe",
      "puerto",
      "montt",
      "llanquihue",
      "nueva",
      "ancud",
      "alto",
      "jahuel",
      "melipulli",
      "vitacura",
      "apoquindo",
      "brasil",
      "macul",
    ].filter((name) => haystack.includes(` ${name} `));

    if (matchedSubstations.length >= 2) {
      return true;
    }
  }

  if (hasTransformerWord && hasVoltage) {
    return true;
  }

  return false;
}

function isEssentialInstallation(trabajo: TrabajoUI) {
  const haystack = ` ${tokenizeForEssential(
    [
      trabajo.subestacion,
      trabajo.componente,
      trabajo.actividad,
      trabajo.tipo,
      trabajo.observacion,
    ].join(" ")
  ).join(" ")} `;

  const hasLineHint =
    haystack.includes(" linea ") ||
    haystack.includes(" circuito ") ||
    haystack.includes(" interruptor ") ||
    haystack.includes(" 110 ") ||
    haystack.includes(" 220 ") ||
    haystack.includes(" 154 ");

  const hasTransformerHint =
    haystack.includes(" atr ") ||
    haystack.includes(" transformador ") ||
    haystack.includes(" t1 ") ||
    haystack.includes(" t2 ") ||
    haystack.includes(" n1 ") ||
    haystack.includes(" n2 ");

  const hasBarraHint =
    haystack.includes(" barra ") ||
    haystack.includes(" bp1 ") ||
    haystack.includes(" bp2 ") ||
    haystack.includes(" b1 ") ||
    haystack.includes(" b2 ");

  for (const pattern of ESSENTIAL_PATTERNS) {
    const matches = countMatches(pattern.tokens, haystack);

    if (pattern.category === "lltt" && hasLineHint && matches >= 2) {
      return true;
    }

    if (pattern.category === "transformador" && hasTransformerHint && matches >= 2) {
      return true;
    }

    if (pattern.category === "barra" && (hasBarraHint || hasLineHint) && matches >= 2) {
      return true;
    }
  }

  return detectFlexibleEssentialByRules(trabajo);
}

function getCenAlertItems(trabajos: TrabajoUI[], now: Date) {
  const effectiveToday = getEffectiveOperationalDate(now);

  const normal: CenAlertItem[] = [];
  const essential: CenAlertItem[] = [];

  for (const trabajo of trabajos) {
    if (!trabajo.fecha) continue;
    if (!requiresCenReview(trabajo)) continue;

    const workDate = parseISODateLocal(trabajo.fecha);
    const lastDay4Business = subtractBusinessDays(workDate, 5);
    const lastDay12Calendar = subtractCalendarDays(workDate, 13);

    if (sameDate(lastDay4Business, effectiveToday)) {
      normal.push({
        id: `normal-${trabajo.id}`,
        pt: trabajo.pt,
        fecha: trabajo.fecha,
        subestacion: trabajo.subestacion,
        componente: trabajo.componente,
        actividad: trabajo.actividad,
        aviso: trabajo.aviso,
        motivo: "4_dias_habiles",
      });
    }

    if (isEssentialInstallation(trabajo) && sameDate(lastDay12Calendar, effectiveToday)) {
      essential.push({
        id: `essential-${trabajo.id}`,
        pt: trabajo.pt,
        fecha: trabajo.fecha,
        subestacion: trabajo.subestacion,
        componente: trabajo.componente,
        actividad: trabajo.actividad,
        aviso: trabajo.aviso,
        motivo: "12_dias_corridos",
      });
    }
  }

  return { normal, essential, effectiveToday };
}

function getLeaderGroupForTrabajo(trabajoId: string, groups: AcopleGroup[]) {
  return groups.find(
    (g) => g.leaderId === trabajoId || g.memberIds.includes(trabajoId)
  );
}

function groupTrabajosByAcoples(trabajos: TrabajoUI[], groups: AcopleGroup[]) {
  const mapById = new Map(trabajos.map((t) => [t.id, t]));
  const alreadyGrouped = new Set<string>();

  const result: Array<{
    kind: "single" | "group";
    leader: TrabajoUI;
    members: TrabajoUI[];
    groupId?: string;
  }> = [];

  for (const t of trabajos) {
    if (alreadyGrouped.has(t.id)) continue;

    const group = groups.find((g) => g.leaderId === t.id);

    if (group) {
      const members = [
        t,
        ...group.memberIds.map((id) => mapById.get(id)).filter(Boolean),
      ] as TrabajoUI[];

      members.forEach((m) => alreadyGrouped.add(m.id));
      result.push({
        kind: "group",
        leader: t,
        members,
        groupId: group.id,
      });
      continue;
    }

    const belongsAsMember = groups.some((g) => g.memberIds.includes(t.id));
    if (belongsAsMember) {
      alreadyGrouped.add(t.id);
      continue;
    }

    alreadyGrouped.add(t.id);
    result.push({
      kind: "single",
      leader: t,
      members: [t],
    });
  }

  return result;
}

function loadAcoplesFromStorage(): AcopleGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_ACOPLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAcoplesToStorage(acoples: AcopleGroup[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_ACOPLES_KEY, JSON.stringify(acoples));
}

function loadHistorialFromStorage(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_HISTORIAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistorialToStorage(historial: HistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_HISTORIAL_KEY, JSON.stringify(historial));
}

function parseHistorialRows(rows: any[][]): HistoryItem[] {
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => ({
      id: String(row[0] || ""),
      timestamp: String(row[1] || ""),
      tipo: String(row[2] || "") as HistoryItem["tipo"],
      pt: String(row[3] || ""),
      fechaOrigen: String(row[4] || ""),
      fechaDestino: String(row[5] || ""),
      motivo: String(row[6] || ""),
      detalle: String(row[7] || ""),
      usuario: String(row[8] || ""),
      origen: String(row[9] || ""),
    }));
}

function parseAcoplesRows(rows: any[][]): AcopleGroup[] {
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => ({
      id: String(row[0] || ""),
      leaderId: String(row[1] || ""),
      memberIds: (() => {
        try {
          return JSON.parse(String(row[2] || "[]"));
        } catch {
          return [];
        }
      })(),
      createdAt: String(row[3] || ""),
    }));
}
export default function Page() {
  const [data, setData] = useState<OpatTrabajo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [updatingDetail, setUpdatingDetail] = useState(false);
  const [creatingSodiTerceros, setCreatingSodiTerceros] = useState(false);

  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"calendario" | "tabla" | "historial" | "pma">(
    "calendario"
  );

  const [newPTOpen, setNewPTOpen] = useState(false);
  const [newPTForm, setNewPTForm] = useState<NewPTForm>(emptyNewPTForm());
  const [newPTError, setNewPTError] = useState("");

  const [sodiTercerosOpen, setSodiTercerosOpen] = useState(false);
  const [sodiTercerosForm, setSodiTercerosForm] = useState<SodiTercerosForm>(
    emptySodiTercerosForm()
  );
  const [sodiTercerosError, setSodiTercerosError] = useState("");

  const [centralityUsername, setCentralityUsername] =
    useState("Nicolás.Lorenzen");
  const [centralityPassword, setCentralityPassword] = useState("");

  const [editForm, setEditForm] = useState<EditPTForm | null>(null);
  const [editError, setEditError] = useState("");

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
  });

  const [historial, setHistorial] = useState<HistoryItem[]>([]);
  const [acoples, setAcoples] = useState<AcopleGroup[]>([]);
  const [persistReady, setPersistReady] = useState(false);

  const [draggingId, setDraggingId] = useState<string>("");
  const [dropTargetDate, setDropTargetDate] = useState<string>("");
  const [moveReasonOpen, setMoveReasonOpen] = useState(false);
  const [moveReason, setMoveReason] = useState("");
  const [moveReasonError, setMoveReasonError] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    trabajoId: string;
    fromDate: string;
    toDate: string;
  } | null>(null);

  const [suspensionReasonOpen, setSuspensionReasonOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspensionReasonError, setSuspensionReasonError] = useState("");
  const [pendingSuspensionSave, setPendingSuspensionSave] = useState(false);

  const [dayOverflow, setDayOverflow] = useState<DayOverflowState>({
    open: false,
    date: "",
  });
  const [acopleTargetId, setAcopleTargetId] = useState<string>("");

  const [pmaData, setPmaData] = useState<PMAItem[]>([]);
  const [pmaLoading, setPmaLoading] = useState(false);
  const [pmaError, setPmaError] = useState("");
  const [pmaFileName, setPmaFileName] = useState("");

  const today = new Date();
  const now = new Date();
  const [monthCursor, setMonthCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const mostrarToast = (message: string) => {
    setToast({ visible: true, message });
  };

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: "" });
    }, 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const cargarPersistencia = async () => {
      try {
        const [rawHistorial, rawAcoples] = await Promise.all([
          gsRead("HistorialCambios"),
          gsRead("Acoples"),
        ]);

        setHistorial(parseHistorialRows(rawHistorial));
        setAcoples(parseAcoplesRows(rawAcoples));
      } catch (gsError) {
        console.error(
          "No se pudo cargar Google Sheet, uso localStorage como respaldo:",
          gsError
        );
        setAcoples(loadAcoplesFromStorage());
        setHistorial(loadHistorialFromStorage());
      } finally {
        setPersistReady(true);
      }
    };

    cargarPersistencia();
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    saveAcoplesToStorage(acoples);
  }, [acoples, persistReady]);

  useEffect(() => {
    if (!persistReady) return;
    saveHistorialToStorage(historial);
  }, [historial, persistReady]);

  const appendHistorialPersist = async (item: HistoryItem) => {
    try {
      await gsAppend("HistorialCambios", [
        item.id,
        item.timestamp,
        item.tipo,
        item.pt,
        item.fechaOrigen,
        item.fechaDestino,
        item.motivo,
        item.detalle || "",
        item.usuario || DEFAULT_USUARIO,
        item.origen || DEFAULT_ORIGEN,
      ]);
    } catch (err) {
      console.error("No se pudo guardar historial en Google Sheet:", err);
    }
  };

  const appendAcoplePersist = async (group: AcopleGroup) => {
    try {
      await gsAppend("Acoples", [
        group.id,
        group.leaderId,
        JSON.stringify(group.memberIds),
        group.createdAt,
      ]);
    } catch (err) {
      console.error("No se pudo guardar acople en Google Sheet:", err);
    }
  };

  const replacePmaPersist = async (items: PMAItem[]) => {
    try {
      const rows = items.map(mapPmaToSheetRow);
      await gsReplaceAll("PMAData", PMA_HEADERS, rows);
    } catch (err) {
      console.error("No se pudo reemplazar PMAData en Google Sheet:", err);
    }
  };

  const cargarOPAT = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/opat", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("No se pudo obtener la agenda desde OPAT");
      }

      const json = await res.json();

      if (!Array.isArray(json)) {
        throw new Error("La respuesta de OPAT no tiene el formato esperado");
      }

      setData(json);
      const actual = new Date();
      setMonthCursor(new Date(actual.getFullYear(), actual.getMonth(), 1));
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al cargar los datos desde OPAT");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarArchivoPMA = async (file: File) => {
    try {
      setPmaLoading(true);
      setPmaError("");

      const parsed = await parsePMAFile(file);
      setPmaData(parsed);
      setPmaFileName(file.name);

      await replacePmaPersist(parsed);
      mostrarToast(`PMA cargado: ${parsed.length} registros`);
    } catch (err) {
      console.error(err);
      setPmaError("No se pudo leer o guardar el archivo PMA.");
    } finally {
      setPmaLoading(false);
    }
  };

  const onPMAFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await cargarArchivoPMA(file);
    e.target.value = "";
  };

  const trabajos = useMemo<TrabajoUI[]>(() => {
    return data
      .map((item, index) => ({
        id:
          item.id?.toString() ||
          `${item.pt || "sin-pt"}-${item.fInicio || "sin-fecha"}-${index}`,
        original: item,
        fecha: item.fInicio || "",
        pt: item.pt || "",
        horaInicio: item.inicio || "",
        horaFin: item.fin || "",
        subestacion: item.ssee || "",
        componente: item.comp || "",
        actividad: item.desc || "",
        estado: item.estado || "",
        tipo: item.tipo || "",
        observacion: item.obs || "",
        programador: item.prog || "",
        area: item.area || "",
        aviso: item.aviso || "",
        sodi: item.sodi || "",
      }))
      .sort(compareDateTime);
  }, [data]);

  const cenAlerts = useMemo(() => {
    return getCenAlertItems(trabajos, now);
  }, [trabajos, now]);

  const trabajosFiltrados = useMemo(() => {
    const q = normalizeText(busqueda);

    return trabajos.filter((t) => {
      if (!q) return true;

      const textoCompleto = normalizeText(
        [
          t.pt,
          t.subestacion,
          t.componente,
          t.actividad,
          t.estado,
          t.tipo,
          t.programador,
          t.aviso,
          t.sodi,
        ].join(" ")
      );

      return textoCompleto.includes(q);
    });
  }, [trabajos, busqueda]);

  const pmaFiltrado = useMemo(() => {
    const q = normalizeText(busqueda);

    return pmaData.filter((item) => {
      if (!q) return true;

      const texto = normalizeText(
        [
          item.ot,
          item.pt,
          item.subestacionOriginal,
          item.subestacionNormalizada,
          item.actividadResumen,
          item.componenteDetectado,
          item.componenteTipo,
          item.especialidad,
          item.estadoOriginal,
          item.fechaBase,
        ].join(" ")
      );

      return texto.includes(q);
    });
  }, [pmaData, busqueda]);

  const pmaSummary = useMemo(() => buildPmaSummary(pmaData), [pmaData]);

  const programadosSummary = useMemo(
    () => buildProgramadosSummary(trabajosFiltrados),
    [trabajosFiltrados]
  );

  const trabajoSeleccionado =
    trabajosFiltrados.find((t) => t.id === selectedId) ||
    trabajos.find((t) => t.id === selectedId) ||
    null;

  useEffect(() => {
    if (trabajoSeleccionado) {
      setEditForm(buildEditForm(trabajoSeleccionado));
      setEditError("");
    } else {
      setEditForm(null);
      setEditError("");
    }
  }, [selectedId, trabajoSeleccionado?.id]);

  const trabajosPorFecha = useMemo(() => {
    const map = new Map<string, TrabajoUI[]>();
    for (const t of trabajosFiltrados) {
      if (!t.fecha) continue;
      if (!map.has(t.fecha)) map.set(t.fecha, []);
      map.get(t.fecha)!.push(t);
    }
    return map;
  }, [trabajosFiltrados]);

  const gruposPorFecha = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        kind: "single" | "group";
        leader: TrabajoUI;
        members: TrabajoUI[];
        groupId?: string;
      }>
    >();

    for (const [fecha, items] of trabajosPorFecha.entries()) {
      map.set(fecha, groupTrabajosByAcoples(items, acoples));
    }

    return map;
  }, [trabajosPorFecha, acoples]);

  const diasMes = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  const cambiarMes = (delta: number) => {
    setMonthCursor(
      new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1)
    );
  };

  const irHoy = () => {
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const trabajosMesActual = useMemo(() => {
    const ym = `${monthCursor.getFullYear()}-${String(
      monthCursor.getMonth() + 1
    ).padStart(2, "0")}`;
    return trabajosFiltrados.filter((t) => t.fecha.startsWith(ym));
  }, [trabajosFiltrados, monthCursor]);

  const limpiarBusqueda = () => {
    setBusqueda("");
  };

  const cerrarModal = () => {
    if (updatingDetail) return;
    setSelectedId("");
  };

  const abrirNuevoPT = (fecha: string) => {
    setNewPTError("");
    setNewPTForm(emptyNewPTForm(fecha));
    setNewPTOpen(true);
  };

  const abrirDayOverflow = (dateIso: string) => {
    setDayOverflow({ open: true, date: dateIso });
  };

  const abrirSodiDesdeNuevoPT = () => {
    setSodiTercerosError("");
    setSodiTercerosForm({
      fecha: newPTForm.fecha,
      horaInicio: newPTForm.horaInicio,
      horaFin: newPTForm.horaFin,
      subestacion: newPTForm.subestacion,
      componente: newPTForm.componente,
      actividad: newPTForm.actividad,
      observacion: newPTForm.observacion,
      programador: newPTForm.programador,
      aviso: newPTForm.aviso,
    });
    setNewPTOpen(false);
    setSodiTercerosOpen(true);
  };
    const cerrarSodiTerceros = () => {
    if (creatingSodiTerceros) return;
    setSodiTercerosOpen(false);
    setSodiTercerosError("");
  };

  const updateSodiTercerosField = (
    field: keyof SodiTercerosForm,
    value: string
  ) => {
    setSodiTercerosForm((prev) => ({ ...prev, [field]: value }));
  };

  const abrirCopiaDesdeTrabajo = (trabajo: TrabajoUI) => {
    setSelectedId("");
    setEditError("");
    setNewPTError("");
    setNewPTForm({
      pt: "",
      fecha: trabajo.fecha || "",
      horaInicio: trabajo.horaInicio || "08:00",
      horaFin: trabajo.horaFin || "18:00",
      subestacion: trabajo.subestacion || "",
      componente: trabajo.componente || "",
      actividad: trabajo.actividad || "",
      observacion: trabajo.observacion || "",
      estado: trabajo.estado || "En programación",
      tipo: trabajo.tipo || "DESCONEXIÓN",
      programador: trabajo.programador || "",
      aviso: trabajo.aviso || "",
      sodi: trabajo.sodi || "",
    });
    setNewPTOpen(true);
  };

  const duplicarFormularioNuevo = () => {
    setNewPTForm((prev) => ({
      ...prev,
      pt: "",
    }));
    mostrarToast("Formulario duplicado. Ingresa el nuevo PT");
  };

  const cerrarNuevoPT = () => {
    if (saving) return;
    setNewPTOpen(false);
    setNewPTError("");
  };

  const updateNewPTField = (field: keyof NewPTForm, value: string) => {
    setNewPTForm((prev) => ({ ...prev, [field]: value }));
  };

  const guardarNuevoPT = async () => {
    try {
      setNewPTError("");

      if (!newPTForm.pt.trim()) {
        setNewPTError("Debes ingresar el PT.");
        return;
      }

      if (!newPTForm.fecha) {
        setNewPTError("Debes ingresar la fecha.");
        return;
      }

      setSaving(true);

      const payload = {
        pt: newPTForm.pt.trim(),
        area: "",
        tipo: newPTForm.tipo,
        inicio: newPTForm.horaInicio,
        fin: newPTForm.horaFin,
        ssee: newPTForm.subestacion.trim(),
        comp: newPTForm.componente.trim(),
        desc: newPTForm.actividad.trim(),
        obs: newPTForm.observacion.trim(),
        re: "No",
        prog: newPTForm.programador.trim(),
        aviso: newPTForm.aviso.trim(),
        sodi: newPTForm.sodi.trim(),
        estado: newPTForm.estado,
        fInicio: newPTForm.fecha,
        fFin: newPTForm.fecha,
        to1: "0",
        to2: "0",
        go1: "",
        go2: "",
        gop: "",
        esSodi: "false",
        sodiCorrelativo: "",
        sodiPara: "",
        sodiDe: "",
        gm: "[]",
      };

      const res = await fetch("/api/opat/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || json?.opatResponse?.mensaje || "No se pudo guardar el PT.");
      }

      setData((prev) => [
        {
          pt: payload.pt,
          area: payload.area,
          tipo: payload.tipo,
          inicio: payload.inicio,
          fin: payload.fin,
          ssee: payload.ssee,
          comp: payload.comp,
          desc: payload.desc,
          obs: payload.obs,
          re: payload.re,
          prog: payload.prog,
          aviso: payload.aviso,
          sodi: payload.sodi,
          estado: payload.estado,
          fInicio: payload.fInicio,
          fFin: payload.fFin,
          to1: payload.to1,
          to2: payload.to2,
          go1: payload.go1,
          go2: payload.go2,
          gop: payload.gop,
          esSodi: payload.esSodi,
          sodiCorrelativo: payload.sodiCorrelativo,
          sodiPara: payload.sodiPara,
          sodiDe: payload.sodiDe,
          gm: payload.gm,
        },
        ...prev,
      ]);

      setNewPTOpen(false);
      setNewPTError("");
      setNewPTForm(emptyNewPTForm());
      mostrarToast("PT guardado en OPAT");
    } catch (err: any) {
      console.error(err);
      setNewPTError(err?.message || "No se pudo guardar el PT en OPAT.");
    } finally {
      setSaving(false);
    }
  };

  const guardarSodiTerceros = async () => {
    try {
      setSodiTercerosError("");

      if (!centralityUsername.trim() || !centralityPassword.trim()) {
        setSodiTercerosError("Debes ingresar usuario y contraseña de Centrality.");
        return;
      }

      if (!sodiTercerosForm.fecha) {
        setSodiTercerosError("Debes ingresar la fecha.");
        return;
      }

      if (!sodiTercerosForm.subestacion.trim()) {
        setSodiTercerosError("Debes ingresar la subestación.");
        return;
      }

      if (!sodiTercerosForm.actividad.trim()) {
        setSodiTercerosError("Debes ingresar la descripción del trabajo.");
        return;
      }

      setCreatingSodiTerceros(true);

      const centralityRes = await fetch("/api/centrality/copy-pt-base", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: centralityUsername.trim(),
          password: centralityPassword,
          ptBase: "2026-06560",
        }),
      });

      const centralityJson = await centralityRes.json();

      if (!centralityRes.ok || !centralityJson?.ok || !centralityJson?.newPtId) {
        throw new Error(
          centralityJson?.error ||
            "No se pudo crear el SODI TERCERO en Centrality."
        );
      }

      const nuevoPt = String(centralityJson.newPtId).trim();

      const opatPayload = {
        pt: nuevoPt,
        area: "",
        tipo: "SODI DE TERCEROS",
        inicio: sodiTercerosForm.horaInicio,
        fin: sodiTercerosForm.horaFin,
        ssee: sodiTercerosForm.subestacion.trim(),
        comp: sodiTercerosForm.componente.trim(),
        desc: sodiTercerosForm.actividad.trim(),
        obs: sodiTercerosForm.observacion.trim(),
        re: "No",
        prog: sodiTercerosForm.programador.trim(),
        aviso: sodiTercerosForm.aviso.trim(),
        sodi: nuevoPt,
        estado: "En programación",
        fInicio: sodiTercerosForm.fecha,
        fFin: sodiTercerosForm.fecha,
        to1: "0",
        to2: "0",
        go1: "",
        go2: "",
        gop: "",
        esSodi: "true",
        sodiCorrelativo: "",
        sodiPara: "",
        sodiDe: "",
        gm: "[]",
      };

      const opatRes = await fetch("/api/opat/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(opatPayload),
      });

      const opatJson = await opatRes.json();

      if (!opatRes.ok || !opatJson?.success) {
        throw new Error(
          opatJson?.error || opatJson?.opatResponse?.mensaje || "Se creó en Centrality, pero falló OPAT."
        );
      }

      await cargarOPAT();
      setSodiTercerosOpen(false);
      setSodiTercerosForm(emptySodiTercerosForm());
      mostrarToast(`SODI TERCERO creado: ${nuevoPt}`);
    } catch (err: any) {
      console.error(err);
      setSodiTercerosError(
        err?.message || "No se pudo crear el SODI TERCERO."
      );
    } finally {
      setCreatingSodiTerceros(false);
    }
  };

  const onDragStartTrabajo = (trabajoId: string) => {
    setDraggingId(trabajoId);
  };

  const onDragStartAcople = (trabajoId: string) => {
    setDraggingId(trabajoId);
  };

  const onDragEnterTrabajoCard = (trabajoId: string) => {
    if (!draggingId || draggingId === trabajoId) return;
    setAcopleTargetId(trabajoId);
  };

  const onDragLeaveTrabajoCard = (trabajoId: string) => {
    if (acopleTargetId === trabajoId) {
      setAcopleTargetId("");
    }
  };

  const onDropSobreTrabajo = async (
    targetTrabajoId: string,
    e: React.DragEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingId || draggingId === targetTrabajoId) {
      setAcopleTargetId("");
      return;
    }

    const dragged = trabajos.find((t) => t.id === draggingId);
    const target = trabajos.find((t) => t.id === targetTrabajoId);

    if (!dragged || !target) {
      setAcopleTargetId("");
      return;
    }

    if (dragged.fecha !== target.fecha) {
      setAcopleTargetId("");
      mostrarToast("Solo puedes acoplar trabajos del mismo día");
      return;
    }

    const draggedGroup = getLeaderGroupForTrabajo(draggingId, acoples);
    const targetGroup = getLeaderGroupForTrabajo(targetTrabajoId, acoples);

    if (draggedGroup && targetGroup && draggedGroup.id === targetGroup.id) {
      setAcopleTargetId("");
      return;
    }

    let nextAcoples = [...acoples];

    if (draggedGroup) {
      nextAcoples = nextAcoples.filter((g) => g.id !== draggedGroup.id);
    }

    if (targetGroup) {
      nextAcoples = nextAcoples.filter((g) => g.id !== targetGroup.id);
    }

    const mergedMemberIds = new Set<string>();

    if (targetGroup) {
      mergedMemberIds.add(targetGroup.leaderId);
      targetGroup.memberIds.forEach((id) => mergedMemberIds.add(id));
    } else {
      mergedMemberIds.add(targetTrabajoId);
    }

    if (draggedGroup) {
      mergedMemberIds.add(draggedGroup.leaderId);
      draggedGroup.memberIds.forEach((id) => mergedMemberIds.add(id));
    } else {
      mergedMemberIds.add(draggingId);
    }

    mergedMemberIds.delete(targetTrabajoId);

    const nuevoAcople: AcopleGroup = {
      id: makeId("acople"),
      leaderId: targetTrabajoId,
      memberIds: Array.from(mergedMemberIds),
      createdAt: new Date().toISOString(),
    };

    nextAcoples.push(nuevoAcople);
    setAcoples(nextAcoples);

    await appendAcoplePersist(nuevoAcople);

    const historialItem: HistoryItem = {
      id: makeId("hist"),
      tipo: "acople",
      pt: target.pt,
      fechaOrigen: target.fecha,
      fechaDestino: target.fecha,
      motivo: "Acoplamiento manual en calendario",
      timestamp: formatTimestamp(new Date()),
      detalle: `${dragged.pt} acoplado con ${target.pt}`,
      usuario: DEFAULT_USUARIO,
      origen: DEFAULT_ORIGEN,
    };

    setHistorial((prev) => [historialItem, ...prev]);
    await appendHistorialPersist(historialItem);

    setDraggingId("");
    setDropTargetDate("");
    setAcopleTargetId("");
    mostrarToast("PTs acoplados en la agenda");
  };

  const desacoplarGrupo = async (groupId: string, leaderPt: string, fecha: string) => {
    setAcoples((prev) => prev.filter((g) => g.id !== groupId));

    const historialItem: HistoryItem = {
      id: makeId("hist"),
      tipo: "acople",
      pt: leaderPt,
      fechaOrigen: fecha,
      fechaDestino: fecha,
      motivo: "Desacople manual en calendario",
      timestamp: formatTimestamp(new Date()),
      detalle: `Se eliminó acople visual del grupo ${groupId}`,
      usuario: DEFAULT_USUARIO,
      origen: DEFAULT_ORIGEN,
    };

    setHistorial((prev) => [historialItem, ...prev]);
    await appendHistorialPersist(historialItem);

    mostrarToast("Acople eliminado");
  };

  const onDragEndTrabajo = () => {
    setDraggingId("");
    setDropTargetDate("");
    setAcopleTargetId("");
  };

  const onDragOverDay = (
    dateIso: string,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    if (!draggingId) return;
    setDropTargetDate(dateIso);
  };

  const onDropDay = (dateIso: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!draggingId) return;

    const trabajo = trabajos.find((t) => t.id === draggingId);
    if (!trabajo) {
      setDraggingId("");
      setDropTargetDate("");
      return;
    }

    if (trabajo.fecha === dateIso) {
      setDraggingId("");
      setDropTargetDate("");
      return;
    }

    setPendingMove({
      trabajoId: trabajo.id,
      fromDate: trabajo.fecha,
      toDate: dateIso,
    });
    setMoveReason("");
    setMoveReasonError("");
    setMoveReasonOpen(true);
    setDraggingId("");
    setDropTargetDate("");
    setAcopleTargetId("");
  };

  const cerrarMoveReasonModal = () => {
    if (moving) return;
    setMoveReasonOpen(false);
    setMoveReason("");
    setMoveReasonError("");
    setPendingMove(null);
  };

  const confirmarMovimiento = async () => {
    try {
      if (!pendingMove) return;

      const motivo = moveReason.trim();
      if (!motivo) {
        setMoveReasonError("Debes ingresar el motivo del cambio.");
        return;
      }

      const trabajo = trabajos.find((t) => t.id === pendingMove.trabajoId);
      if (!trabajo) {
        setMoveReasonError("No se encontró el trabajo a mover.");
        return;
      }

      setMoving(true);
      setMoveReasonError("");

      const original = trabajo.original;

      const updatedPayload: OpatTrabajo = {
        ...original,
        fInicio: pendingMove.toDate,
        fFin: pendingMove.toDate,
      };

      const res = await fetch("/api/opat/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedPayload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || json?.opatResponse?.mensaje || "No se pudo reprogramar el PT."
        );
      }

      setData((prev) =>
        prev.map((item) => {
          const samePT = item.pt === original.pt;
          const sameFecha = item.fInicio === original.fInicio;
          const sameInicio = item.inicio === original.inicio;
          const sameFin = item.fin === original.fin;

          if (samePT && sameFecha && sameInicio && sameFin) {
            return {
              ...item,
              fInicio: pendingMove.toDate,
              fFin: pendingMove.toDate,
            };
          }

          return item;
        })
      );

      const historialItem: HistoryItem = {
        id: makeId("hist"),
        tipo: "reprogramacion",
        pt: trabajo.pt,
        fechaOrigen: pendingMove.fromDate,
        fechaDestino: pendingMove.toDate,
        motivo,
        timestamp: formatTimestamp(new Date()),
        usuario: DEFAULT_USUARIO,
        origen: DEFAULT_ORIGEN,
      };

      setHistorial((prev) => [historialItem, ...prev]);
      await appendHistorialPersist(historialItem);

      setMoveReasonOpen(false);
      setPendingMove(null);
      setMoveReason("");
      setMoveReasonError("");
      mostrarToast("PT reprogramado en OPAT");
    } catch (err: any) {
      console.error(err);
      setMoveReasonError(
        err?.message || "No se pudo reprogramar el PT en OPAT."
      );
    } finally {
      setMoving(false);
    }
  };

  const cerrarSuspensionReasonModal = () => {
    if (updatingDetail) return;
    setSuspensionReasonOpen(false);
    setSuspensionReason("");
    setSuspensionReasonError("");
    setPendingSuspensionSave(false);
  };

  const ejecutarGuardadoEdicion = async (motivoSuspension?: string) => {
    try {
      if (!trabajoSeleccionado || !editForm) return;

      setUpdatingDetail(true);
      setEditError("");

      const original = trabajoSeleccionado.original;
      const oldEstado = trabajoSeleccionado.estado;

      const updatedPayload: OpatTrabajo = {
        ...original,
        tipo: editForm.tipo,
        inicio: editForm.horaInicio,
        fin: editForm.horaFin,
        ssee: editForm.subestacion.trim(),
        comp: editForm.componente.trim(),
        desc: editForm.actividad.trim(),
        obs: editForm.observacion.trim(),
        prog: editForm.programador.trim(),
        aviso: editForm.aviso.trim(),
        sodi: editForm.sodi.trim(),
        estado: editForm.estado,
        fInicio: editForm.fecha,
        fFin: editForm.fecha,
      };

      const res = await fetch("/api/opat/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedPayload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || json?.opatResponse?.mensaje || "No se pudo actualizar el trabajo."
        );
      }

      setData((prev) =>
        prev.map((item) => {
          const samePT = item.pt === original.pt;
          const sameFecha = item.fInicio === original.fInicio;
          const sameInicio = item.inicio === original.inicio;
          const sameFin = item.fin === original.fin;

          if (samePT && sameFecha && sameInicio && sameFin) {
            return {
              ...item,
              tipo: updatedPayload.tipo,
              inicio: updatedPayload.inicio,
              fin: updatedPayload.fin,
              ssee: updatedPayload.ssee,
              comp: updatedPayload.comp,
              desc: updatedPayload.desc,
              obs: updatedPayload.obs,
              prog: updatedPayload.prog,
              aviso: updatedPayload.aviso,
              sodi: updatedPayload.sodi,
              estado: updatedPayload.estado,
              fInicio: updatedPayload.fInicio,
              fFin: updatedPayload.fFin,
            };
          }

          return item;
        })
      );

      if (oldEstado !== "Suspendido" && editForm.estado === "Suspendido") {
        const historialItem: HistoryItem = {
          id: makeId("hist"),
          tipo: "suspension",
          pt: trabajoSeleccionado.pt,
          fechaOrigen: trabajoSeleccionado.fecha,
          fechaDestino: editForm.fecha,
          motivo:
            (motivoSuspension || "").trim() ||
            "Cambio de estado a Suspendido desde el calendario",
          timestamp: formatTimestamp(new Date()),
          usuario: DEFAULT_USUARIO,
          origen: DEFAULT_ORIGEN,
        };

        setHistorial((prev) => [historialItem, ...prev]);
        await appendHistorialPersist(historialItem);
      }

      mostrarToast("Cambios guardados en OPAT");
      setSelectedId("");
      setSuspensionReasonOpen(false);
      setSuspensionReason("");
      setSuspensionReasonError("");
      setPendingSuspensionSave(false);
    } catch (err: any) {
      console.error(err);
      setEditError(
        err?.message || "No se pudo guardar la edición en OPAT."
      );
    } finally {
      setUpdatingDetail(false);
    }
  };

  const confirmarSuspensionConMotivo = async () => {
    const motivo = suspensionReason.trim();

    if (!motivo) {
      setSuspensionReasonError("Debes ingresar el motivo de suspensión.");
      return;
    }

    await ejecutarGuardadoEdicion(motivo);
  };

  const updateEditField = (field: keyof EditPTForm, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const guardarEdicionTrabajo = async () => {
    if (!trabajoSeleccionado || !editForm) return;

    setEditError("");

    const oldEstado = trabajoSeleccionado.estado;
    const newEstado = editForm.estado;

    if (oldEstado !== "Suspendido" && newEstado === "Suspendido") {
      setSuspensionReason("");
      setSuspensionReasonError("");
      setPendingSuspensionSave(true);
      setSuspensionReasonOpen(true);
      return;
    }

    await ejecutarGuardadoEdicion();
  };

  const irAlTrabajoDesdeAlerta = (item: CenAlertItem) => {
    const targetDate = parseISODateLocal(item.fecha);
    setVista("calendario");
    setMonthCursor(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));

    const found = trabajos.find(
      (t) =>
        t.pt === item.pt &&
        t.fecha === item.fecha &&
        (normalizeText(t.subestacion) === normalizeText(item.subestacion) ||
          normalizeText(t.componente) === normalizeText(item.componente))
    );

    if (found) {
      setSelectedId(found.id);
    }
  };

  const cerrarDayOverflow = () => {
    setDayOverflow({ open: false, date: "" });
  };
    return (
    <main style={styles.page}>
      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>Calendario CCT · Agenda OPAT</h1>
            <p style={styles.subtitle}>
              Vista mensual operativa basada en trabajos traídos desde OPAT.
            </p>
          </div>

          <div style={styles.headerButtons}>
            <button
              onClick={cargarOPAT}
              disabled={loading}
              style={{
                ...styles.primaryBlueButton,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Cargando..." : "Cargar OPAT"}
            </button>

            <label style={styles.secondaryButton}>
              {pmaLoading ? "Cargando PMA..." : "Cargar PMA CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onPMAFileChange}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total cargados</span>
          <strong style={styles.summaryValue}>
            {vista === "pma" ? pmaData.length : trabajos.length}
          </strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Mostrados</span>
          <strong style={styles.summaryValue}>
            {vista === "pma" ? pmaFiltrado.length : trabajosFiltrados.length}
          </strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>En mes visible</span>
          <strong style={styles.summaryValue}>
            {vista === "pma" ? pmaData.length : trabajosMesActual.length}
          </strong>
        </div>
      </div>

      {trabajos.length > 0 && vista !== "pma" && (
        <div style={styles.alertsWrapNew}>
          <section style={styles.alertBoxNew}>
            <div style={styles.alertCounterAmber}>{cenAlerts.normal.length}</div>

            <h2 style={styles.alertTitleNew}>Avisos CEN por 4 días hábiles</h2>
            <p style={styles.alertSubtitleNew}>
              Último día operativo: {toLocalDateInputValue(cenAlerts.effectiveToday)}
            </p>

            <div style={styles.alertListNew}>
              {cenAlerts.normal.length === 0 ? (
                <div style={styles.alertEmptyNew}>
                  Hoy no hay trabajos que venzan por la regla de 4 días hábiles.
                </div>
              ) : (
                cenAlerts.normal.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => irAlTrabajoDesdeAlerta(item)}
                    style={styles.alertItemButtonNew}
                  >
                    <div style={styles.alertItemPt}>{item.pt}</div>
                    <div style={styles.alertItemMeta}>
                      {item.fecha} · {item.subestacion || "-"}
                    </div>
                    <div style={styles.alertItemDesc}>
                      {truncate(item.componente || item.actividad || "-", 80)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section style={styles.alertBoxEssentialNew}>
            <div style={styles.alertCounterRed}>{cenAlerts.essential.length}</div>

            <h2 style={styles.alertTitleNew}>Avisos CEN instalaciones esenciales</h2>
            <p style={styles.alertSubtitleNew}>Regla de 12 días corridos · corte 07:00</p>

            <div style={styles.alertListNew}>
              {cenAlerts.essential.length === 0 ? (
                <div style={styles.alertEmptyNew}>
                  Hoy no hay trabajos esenciales que venzan por la regla de 12 días.
                </div>
              ) : (
                cenAlerts.essential.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => irAlTrabajoDesdeAlerta(item)}
                    style={styles.alertItemButtonNew}
                  >
                    <div style={styles.alertItemPt}>{item.pt}</div>
                    <div style={styles.alertItemMeta}>
                      {item.fecha} · {item.subestacion || "-"}
                    </div>
                    <div style={styles.alertItemDesc}>
                      {truncate(item.componente || item.actividad || "-", 80)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <div style={styles.filtersCard}>
        <div style={styles.filtersGridSimple}>
          <div style={styles.field}>
            <label style={styles.label}>Buscar</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="PT, subestación, componente, OT..."
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.actionsRow}>
          <div style={styles.segmented}>
            <button
              onClick={() => setVista("calendario")}
              style={{
                ...styles.segmentButton,
                ...(vista === "calendario" ? styles.segmentButtonActive : {}),
              }}
            >
              Calendario
            </button>
            <button
              onClick={() => setVista("tabla")}
              style={{
                ...styles.segmentButton,
                ...(vista === "tabla" ? styles.segmentButtonActive : {}),
              }}
            >
              Tabla
            </button>
            <button
              onClick={() => setVista("historial")}
              style={{
                ...styles.segmentButton,
                ...(vista === "historial" ? styles.segmentButtonActive : {}),
              }}
            >
              Historial
            </button>
            <button
              onClick={() => setVista("pma")}
              style={{
                ...styles.segmentButton,
                ...(vista === "pma" ? styles.segmentButtonActive : {}),
              }}
            >
              PMA
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {pmaFileName ? <span style={styles.fileBadge}>{pmaFileName}</span> : null}
            <button onClick={limpiarBusqueda} style={styles.secondaryButton}>
              Limpiar búsqueda
            </button>
          </div>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {pmaError && <div style={styles.errorBox}>{pmaError}</div>}

      {!loading && !error && trabajos.length === 0 && vista !== "pma" && (
        <div style={styles.emptyBox}>
          Presiona <strong>Cargar OPAT</strong> para traer la agenda.
        </div>
      )}

      {vista === "pma" && (
        <>
          <div style={styles.pmaChartsWrap}>
            <div style={styles.pmaChartCard}>
              <div style={styles.pmaChartHeader}>
                <h2 style={styles.pmaChartTitle}>Avance PMA</h2>
                <div style={styles.pmaChartSubtitle}>
                  Resumen según estado del archivo PMA cargado
                </div>
              </div>

              <div style={styles.pmaKpiRow}>
                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Total</span>
                  <strong style={styles.pmaKpiValue}>{pmaSummary.total}</strong>
                </div>
                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Pendientes</span>
                  <strong style={styles.pmaKpiValue}>{pmaSummary.pendientes}</strong>
                </div>
                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Ejecutados</span>
                  <strong style={styles.pmaKpiValue}>{pmaSummary.ejecutados}</strong>
                </div>
                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Reprogramados</span>
                  <strong style={styles.pmaKpiValue}>{pmaSummary.reprogramados}</strong>
                </div>
                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Anulados</span>
                  <strong style={styles.pmaKpiValue}>{pmaSummary.anulados}</strong>
                </div>
                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Otros</span>
                  <strong style={styles.pmaKpiValue}>{pmaSummary.otros}</strong>
                </div>
              </div>

              <div style={styles.pmaBarsWrap}>
                {[
                  { key: "pendientes", label: "Pendientes", value: pmaSummary.pendientes },
                  { key: "ejecutados", label: "Ejecutados", value: pmaSummary.ejecutados },
                  { key: "reprogramados", label: "Reprogramados", value: pmaSummary.reprogramados },
                  { key: "anulados", label: "Anulados", value: pmaSummary.anulados },
                  { key: "otros", label: "Otros", value: pmaSummary.otros },
                ].map((item) => {
                  const max = Math.max(
                    pmaSummary.pendientes,
                    pmaSummary.ejecutados,
                    pmaSummary.reprogramados,
                    pmaSummary.anulados,
                    pmaSummary.otros,
                    1
                  );
                  const widthPct = (item.value / max) * 100;

                  return (
                    <div key={item.key} style={styles.pmaBarRow}>
                      <div style={styles.pmaBarLabel}>{item.label}</div>
                      <div style={styles.pmaBarTrack}>
                        <div
                          style={{
                            ...styles.pmaBarFill,
                            width: `${widthPct}%`,
                          }}
                        />
                      </div>
                      <div style={styles.pmaBarValue}>{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>OT</th>
                  <th style={styles.th}>PT</th>
                  <th style={styles.th}>Subestación</th>
                  <th style={styles.th}>Componente detectado</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Actividad</th>
                  <th style={styles.th}>Especialidad</th>
                  <th style={styles.th}>Fecha base</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Reprogramado</th>
                </tr>
              </thead>
              <tbody>
                {pmaFiltrado.map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>{item.ot || "-"}</td>
                    <td style={styles.td}>{item.pt || "-"}</td>
                    <td style={styles.td}>{item.subestacionOriginal || "-"}</td>
                    <td style={styles.td}>{item.componenteDetectado || "-"}</td>
                    <td style={styles.td}>{item.componenteTipo || "-"}</td>
                    <td style={styles.td} title={item.actividadResumen || "-"}>
                      {truncate(item.actividadResumen, 90)}
                    </td>
                    <td style={styles.td}>{item.especialidad || "-"}</td>
                    <td style={styles.td}>{item.fechaBase || "-"}</td>
                    <td style={styles.td}>{item.estadoOriginal || "-"}</td>
                    <td style={styles.td}>{item.reprogramado ? "Sí" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pmaFiltrado.length === 0 && (
              <div style={styles.emptyInner}>
                {pmaData.length === 0
                  ? "Carga un archivo PMA CSV para visualizar la tabla."
                  : "No hay registros PMA que coincidan con la búsqueda."}
              </div>
            )}
          </div>
        </>
      )}

      {vista === "tabla" && (
        <>
          <div style={styles.programadosWrap}>
            <div style={styles.programadosCard}>
              <div style={styles.programadosHeader}>
                <h2 style={styles.programadosTitle}>Avance Trabajos Programados</h2>
                <div style={styles.programadosSubtitle}>
                  Resumen de PTs actualmente visibles en la tabla
                </div>
              </div>

              <div style={styles.programadosKpiRow}>
                <div style={styles.programadosKpiCard}>
                  <span style={styles.programadosKpiLabel}>Total PTs cargados</span>
                  <strong style={styles.programadosKpiValue}>{programadosSummary.total}</strong>
                </div>
                <div style={styles.programadosKpiCard}>
                  <span style={styles.programadosKpiLabel}>En programación</span>
                  <strong style={styles.programadosKpiValue}>
                    {programadosSummary.enProgramacion}
                  </strong>
                </div>
                <div style={styles.programadosKpiCard}>
                  <span style={styles.programadosKpiLabel}>Autorizados</span>
                  <strong style={styles.programadosKpiValue}>
                    {programadosSummary.autorizados}
                  </strong>
                </div>
                <div style={styles.programadosKpiCard}>
                  <span style={styles.programadosKpiLabel}>Suspendidos</span>
                  <strong style={styles.programadosKpiValue}>
                    {programadosSummary.suspendidos}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>PT</th>
                  <th style={styles.th}>Hora</th>
                  <th style={styles.th}>Subestación</th>
                  <th style={styles.th}>Componente</th>
                  <th style={styles.th}>Actividad</th>
                  <th style={styles.th}>Programador</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {trabajosFiltrados.map((trabajo) => (
                  <tr
                    key={trabajo.id}
                    onClick={() => setSelectedId(trabajo.id)}
                    style={{
                      ...styles.tr,
                      cursor: "pointer",
                      background:
                        trabajo.estado === "En programación" && isAssignedProgramador(trabajo.programador)
                          ? "#eff6ff"
                          : "transparent",
                    }}
                  >
                    <td style={styles.td}>{trabajo.fecha || "-"}</td>
                    <td style={styles.td}>{trabajo.pt || "-"}</td>
                    <td style={styles.td}>
                      {trabajo.horaInicio || "-"}{" "}
                      {trabajo.horaFin ? `- ${trabajo.horaFin}` : ""}
                    </td>
                    <td style={styles.td}>{trabajo.subestacion || "-"}</td>
                    <td style={styles.td}>{trabajo.componente || "-"}</td>
                    <td style={styles.td}>{truncate(trabajo.actividad, 85)}</td>
                    <td style={styles.td}>{trabajo.programador || "-"}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.estadoChip,
                          background: estadoColor(trabajo.estado, trabajo.programador).background,
                          color: estadoColor(trabajo.estado, trabajo.programador).color,
                          border: `1px solid ${estadoColor(trabajo.estado, trabajo.programador).border}`,
                        }}
                      >
                        {trabajo.estado || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {trabajosFiltrados.length === 0 && (
              <div style={styles.emptyInner}>
                No hay trabajos que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </>
      )}

      {vista === "historial" && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>PT</th>
                <th style={styles.th}>Fecha origen</th>
                <th style={styles.th}>Fecha destino</th>
                <th style={styles.th}>Motivo</th>
                <th style={styles.th}>Detalle</th>
                <th style={styles.th}>Fecha registro</th>
                <th style={styles.th}>Usuario</th>
                <th style={styles.th}>Origen</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((item) => (
                <tr key={item.id} style={styles.tr}>
                  <td style={styles.td}>
                    {item.tipo === "reprogramacion"
                      ? "Reprogramación"
                      : item.tipo === "suspension"
                      ? "Suspensión"
                      : "Acople"}
                  </td>
                  <td style={styles.td}>{item.pt}</td>
                  <td style={styles.td}>{item.fechaOrigen}</td>
                  <td style={styles.td}>{item.fechaDestino}</td>
                  <td style={styles.td}>{item.motivo}</td>
                  <td style={styles.td}>{item.detalle || "-"}</td>
                  <td style={styles.td}>{item.timestamp}</td>
                  <td style={styles.td}>{item.usuario || "-"}</td>
                  <td style={styles.td}>{item.origen || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {historial.length === 0 && (
            <div style={styles.emptyInner}>
              Aún no hay cambios históricos registrados.
            </div>
          )}
        </div>
      )}

      {vista === "calendario" && trabajos.length > 0 && (
        <>
          <div style={styles.calendarToolbarNew}>
            <div>
              <h2 style={styles.calendarMainTitle}>Calendario operativo</h2>
              <div style={styles.calendarMonthLabel}>{formatMonthLabel(monthCursor)}</div>
            </div>

            <div style={styles.calendarNav}>
              <button onClick={() => cambiarMes(-1)} style={styles.secondaryButton}>
                ← Mes anterior
              </button>
              <button onClick={irHoy} style={styles.secondaryButton}>
                Mes actual
              </button>
              <button onClick={() => cambiarMes(1)} style={styles.secondaryButton}>
                Mes siguiente →
              </button>
            </div>
          </div>

          <div style={styles.calendarWrapNew}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <div key={day} style={styles.weekHeaderBlack}>
                {day}
              </div>
            ))}

            {diasMes.map((day) => {
              const groupedItems = gruposPorFecha.get(day.iso) || [];
              const isToday = day.iso === toLocalDateInputValue(today);
              const isDropTarget = dropTargetDate === day.iso && !!draggingId;

              return (
                <div
                  key={day.iso}
                  onClick={() => abrirDayOverflow(day.iso)}
                  onDragOver={(e) => onDragOverDay(day.iso, e)}
                  onDrop={(e) => onDropDay(day.iso, e)}
                  style={{
                    ...styles.dayCellNew,
                    background: day.inMonth ? "#fff" : "#f8fafc",
                    opacity: day.inMonth ? 1 : 0.7,
                    border: isDropTarget
                      ? "1px solid #16a34a"
                      : isToday
                      ? "1px solid #93c5fd"
                      : "1px solid #d6dfec",
                    boxShadow: isDropTarget
                      ? "inset 0 0 0 2px rgba(22,163,74,0.18)"
                      : groupedItems.length > 0
                      ? "0 8px 20px rgba(15, 23, 42, 0.06)"
                      : "none",
                    cursor: "pointer",
                  }}
                >
                  <div style={styles.dayHeaderNew}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirDayOverflow(day.iso);
                      }}
                      style={styles.dayNumberButtonNew}
                      title="Ver trabajos del día"
                    >
                      <span
                        style={{
                          ...styles.dayNumberNew,
                          background: isToday ? "#dbeafe" : "transparent",
                          color: isToday ? "#1d4ed8" : day.inMonth ? "#0f172a" : "#94a3b8",
                          padding: isToday ? "2px 10px" : 0,
                        }}
                      >
                        {day.date.getDate()}
                      </span>
                    </button>

                    <div style={styles.dayHeaderActions}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirNuevoPT(day.iso);
                        }}
                        style={styles.addDayButton}
                        title="Crear nuevo PT"
                      >
                        +
                      </button>

                      {groupedItems.length > 0 && (
                        <span style={styles.dayCountNew}>{groupedItems.length}</span>
                      )}
                    </div>
                  </div>

                  {groupedItems.length > 0 ? (
                    <div style={styles.dayBadgesRow}>
                      <span style={styles.tinyBadgeBlue}>{groupedItems.length} PT</span>
                    </div>
                  ) : null}

                  <div style={styles.dayItemsNew}>
                    {groupedItems.slice(0, 4).map((entry) => {
                      const trabajo = entry.leader;
                      const colors = estadoColor(trabajo.estado, trabajo.programador);
                      const isAcopleTarget = acopleTargetId === trabajo.id;

                      if (entry.kind === "group") {
                        return (
                          <div
                            key={entry.groupId}
                            style={{
                              ...styles.groupCardNew,
                              background: colors.background,
                              border: `1px solid ${colors.border}`,
                              boxShadow: isAcopleTarget
                                ? "0 0 0 2px rgba(251,191,36,0.35)"
                                : "none",
                            }}
                          >
                            <button
                              type="button"
                              draggable
                              onDragStart={() => onDragStartAcople(trabajo.id)}
                              onDragEnd={onDragEndTrabajo}
                              onDragEnter={() => onDragEnterTrabajoCard(trabajo.id)}
                              onDragLeave={() => onDragLeaveTrabajoCard(trabajo.id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => onDropSobreTrabajo(trabajo.id, e)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(trabajo.id);
                              }}
                              style={{
                                ...styles.eventCardCompactNew,
                                background: "transparent",
                                color: colors.color,
                                border: "none",
                                padding: 0,
                              }}
                            >
                              <div style={styles.groupHeaderRow}>
                                <div style={styles.eventCompactSubNew}>
                                  {truncateSoft(trabajo.subestacion || "-", 24)}
                                </div>
                                <span style={styles.groupBadgeNew}>
                                  {entry.members.length} PT
                                </span>
                              </div>

                              <div style={styles.eventCompactPtNew}>
                                {trabajo.pt || "Sin PT"}
                              </div>

                              <div style={styles.eventCompactCompNew}>
                                {truncateSoft(
                                  trabajo.componente || trabajo.actividad || "-",
                                  28
                                )}
                              </div>
                            </button>

                            <div style={styles.groupMembersNew}>
                              {entry.members.slice(1).map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(m.id);
                                  }}
                                  style={styles.groupMemberButtonNew}
                                >
                                  <div style={styles.groupMemberPtNew}>{m.pt}</div>
                                  <div style={styles.groupMemberCompNew}>
                                    {truncateSoft(
                                      m.componente || m.actividad || "-",
                                      24
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>

                            <div style={styles.groupActionsNew}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  desacoplarGrupo(
                                    entry.groupId || "",
                                    trabajo.pt,
                                    trabajo.fecha
                                  );
                                }}
                                style={styles.unlinkButton}
                              >
                                Desacoplar
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={trabajo.id}
                          draggable
                          onDragStart={() => onDragStartTrabajo(trabajo.id)}
                          onDragEnd={onDragEndTrabajo}
                          onDragEnter={() => onDragEnterTrabajoCard(trabajo.id)}
                          onDragLeave={() => onDragLeaveTrabajoCard(trabajo.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDropSobreTrabajo(trabajo.id, e)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(trabajo.id);
                          }}
                          style={{
                            ...styles.eventCardCompactNew,
                            background: colors.background,
                            color: colors.color,
                            border: `1px solid ${colors.border}`,
                            opacity: draggingId === trabajo.id ? 0.55 : 1,
                            boxShadow: isAcopleTarget
                              ? "0 0 0 2px rgba(251,191,36,0.35)"
                              : "none",
                          }}
                        >
                          <div style={styles.eventCompactSubNew}>
                            {truncateSoft(trabajo.subestacion || "-", 24)}
                          </div>

                          <div style={styles.eventCompactPtNew}>
                            {trabajo.pt || "Sin PT"}
                          </div>

                          <div style={styles.eventCompactCompNew}>
                            {truncateSoft(
                              trabajo.componente || trabajo.actividad || "-",
                              28
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {groupedItems.length > 0 ? (
                    <div style={styles.dayFooterNew}>
                      <div style={styles.dayFooterText}>
                        {groupedItems.length} trabajo(s)
                      </div>

                      {groupedItems.length > 4 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirDayOverflow(day.iso);
                          }}
                          style={styles.moreItemsButtonNew}
                        >
                          +{groupedItems.length - 4} más
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}

      {trabajoSeleccionado && editForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalXL} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Detalle del trabajo</h2>
                <div style={styles.modalSubtitle}>
                  {trabajoSeleccionado.subestacion || "-"} · {trabajoSeleccionado.pt || "-"}
                </div>
              </div>

              <button onClick={cerrarModal} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {editError && <div style={styles.errorBox}>{editError}</div>}

            <div style={styles.detailGrid4}>
              <FormField label="PT">
                <input
                  value={trabajoSeleccionado.pt || ""}
                  disabled
                  style={styles.inputReadonly}
                />
              </FormField>

              <FormField label="Fecha">
                <input
                  type="date"
                  value={editForm.fecha}
                  onChange={(e) => updateEditField("fecha", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora inicio">
                <input
                  type="time"
                  value={editForm.horaInicio}
                  onChange={(e) => updateEditField("horaInicio", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora fin">
                <input
                  type="time"
                  value={editForm.horaFin}
                  onChange={(e) => updateEditField("horaFin", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Subestación">
                <input
                  value={editForm.subestacion}
                  onChange={(e) => updateEditField("subestacion", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Componente">
                <input
                  value={editForm.componente}
                  onChange={(e) => updateEditField("componente", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Estado">
                <select
                  value={editForm.estado}
                  onChange={(e) => updateEditField("estado", e.target.value)}
                  style={styles.input}
                >
                  <option value="En programación">En programación</option>
                  <option value="Autorizado">Autorizado</option>
                  <option value="Suspendido">Suspendido</option>
                </select>
              </FormField>

              <FormField label="Tipo">
                <select
                  value={editForm.tipo}
                  onChange={(e) => updateEditField("tipo", e.target.value)}
                  style={styles.input}
                >
                  <option value="DESCONEXIÓN">DESCONEXIÓN</option>
                  <option value="INTERVENCIÓN">INTERVENCIÓN</option>
                  <option value="INFORMATIVA">INFORMATIVA</option>
                  <option value="SODI DESCONEXIÓN">SODI DESCONEXIÓN</option>
                  <option value="SODI INFORMATIVA">SODI INFORMATIVA</option>
                  <option value="SODI DE TERCEROS">SODI DE TERCEROS</option>
                </select>
              </FormField>

              <FormField label="Programador">
                <input
                  value={editForm.programador}
                  onChange={(e) => updateEditField("programador", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Aviso al CEN">
                <input
                  value={editForm.aviso}
                  onChange={(e) => updateEditField("aviso", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="SODI">
                <input
                  value={editForm.sodi}
                  onChange={(e) => updateEditField("sodi", e.target.value)}
                  style={styles.input}
                />
              </FormField>
            </div>

            <div style={styles.detailBlock}>
              <FormField label="Actividad">
                <textarea
                  value={editForm.actividad}
                  onChange={(e) => updateEditField("actividad", e.target.value)}
                  style={styles.textareaWide}
                />
              </FormField>
            </div>

            <div style={styles.detailBlock}>
              <FormField label="Observación">
                <textarea
                  value={editForm.observacion}
                  onChange={(e) => updateEditField("observacion", e.target.value)}
                  style={styles.textareaWide}
                />
              </FormField>
            </div>

            <div style={styles.modalActionsRight}>
              <button
                onClick={() => abrirCopiaDesdeTrabajo(trabajoSeleccionado)}
                style={styles.secondaryButton}
              >
                Copiar trabajo
              </button>

              <button onClick={cerrarModal} style={styles.secondaryButton}>
                Cerrar
              </button>

              <button
                onClick={guardarEdicionTrabajo}
                disabled={updatingDetail}
                style={{
                  ...styles.primaryBlueButton,
                  opacity: updatingDetail ? 0.7 : 1,
                }}
              >
                {updatingDetail ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newPTOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalXL} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Nuevo PT</h2>
                <div style={styles.modalSubtitle}>
                  Crear trabajo manual para {newPTForm.fecha || "-"}
                </div>
              </div>

              <button onClick={cerrarNuevoPT} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {newPTError && <div style={styles.errorBox}>{newPTError}</div>}

            <div style={styles.newPtGrid4}>
              <FormField label="PT">
                <input
                  value={newPTForm.pt}
                  onChange={(e) => updateNewPTField("pt", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Fecha">
                <input
                  type="date"
                  value={newPTForm.fecha}
                  onChange={(e) => updateNewPTField("fecha", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora inicio">
                <input
                  type="time"
                  value={newPTForm.horaInicio}
                  onChange={(e) => updateNewPTField("horaInicio", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora fin">
                <input
                  type="time"
                  value={newPTForm.horaFin}
                  onChange={(e) => updateNewPTField("horaFin", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Subestación">
                <input
                  value={newPTForm.subestacion}
                  onChange={(e) => updateNewPTField("subestacion", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Componente">
                <input
                  value={newPTForm.componente}
                  onChange={(e) => updateNewPTField("componente", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Estado">
                <select
                  value={newPTForm.estado}
                  onChange={(e) => updateNewPTField("estado", e.target.value)}
                  style={styles.input}
                >
                  <option value="En programación">En programación</option>
                  <option value="Autorizado">Autorizado</option>
                  <option value="Suspendido">Suspendido</option>
                </select>
              </FormField>

              <FormField label="Tipo">
                <select
                  value={newPTForm.tipo}
                  onChange={(e) => updateNewPTField("tipo", e.target.value)}
                  style={styles.input}
                >
                  <option value="DESCONEXIÓN">DESCONEXIÓN</option>
                  <option value="INTERVENCIÓN">INTERVENCIÓN</option>
                  <option value="INFORMATIVA">INFORMATIVA</option>
                  <option value="SODI DESCONEXIÓN">SODI DESCONEXIÓN</option>
                  <option value="SODI INFORMATIVA">SODI INFORMATIVA</option>
                  <option value="SODI DE TERCEROS">SODI DE TERCEROS</option>
                </select>
              </FormField>
            </div>

            <div style={styles.newPtGrid3}>
              <FormField label="Programador">
                <input
                  value={newPTForm.programador}
                  onChange={(e) => updateNewPTField("programador", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Aviso al CEN">
                <input
                  value={newPTForm.aviso}
                  onChange={(e) => updateNewPTField("aviso", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="SODI">
                <input
                  value={newPTForm.sodi}
                  onChange={(e) => updateNewPTField("sodi", e.target.value)}
                  style={styles.input}
                />
              </FormField>
            </div>

            <div style={styles.detailBlock}>
              <FormField label="Actividad">
                <textarea
                  value={newPTForm.actividad}
                  onChange={(e) => updateNewPTField("actividad", e.target.value)}
                  style={styles.textareaWide}
                />
              </FormField>
            </div>

            <div style={styles.detailBlock}>
              <FormField label="Observación">
                <textarea
                  value={newPTForm.observacion}
                  onChange={(e) => updateNewPTField("observacion", e.target.value)}
                  style={styles.textareaWide}
                />
              </FormField>
            </div>

            <div style={styles.modalActionsRight}>
              <button onClick={abrirSodiDesdeNuevoPT} style={styles.secondaryButton}>
                Crear SODI TERCERO
              </button>

              <button onClick={duplicarFormularioNuevo} style={styles.secondaryButton}>
                Duplicar borrando PT
              </button>

              <button onClick={cerrarNuevoPT} style={styles.secondaryButton}>
                Cancelar
              </button>

              <button
                onClick={guardarNuevoPT}
                disabled={saving}
                style={{
                  ...styles.primaryBlueButton,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Guardando..." : "Guardar en OPAT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sodiTercerosOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Crear SODI TERCERO</h2>
                <div style={styles.modalSubtitle}>
                  Crea en Centrality y luego lo registra en OPAT
                </div>
              </div>

              <button onClick={cerrarSodiTerceros} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {sodiTercerosError && <div style={styles.errorBox}>{sodiTercerosError}</div>}

            <div style={styles.formGrid}>
              <FormField label="Usuario Centrality">
                <input
                  value={centralityUsername}
                  onChange={(e) => setCentralityUsername(e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Contraseña Centrality">
                <input
                  type="password"
                  value={centralityPassword}
                  onChange={(e) => setCentralityPassword(e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Fecha">
                <input
                  type="date"
                  value={sodiTercerosForm.fecha}
                  onChange={(e) => updateSodiTercerosField("fecha", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora inicio">
                <input
                  type="time"
                  value={sodiTercerosForm.horaInicio}
                  onChange={(e) => updateSodiTercerosField("horaInicio", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora fin">
                <input
                  type="time"
                  value={sodiTercerosForm.horaFin}
                  onChange={(e) => updateSodiTercerosField("horaFin", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Subestación">
                <input
                  value={sodiTercerosForm.subestacion}
                  onChange={(e) => updateSodiTercerosField("subestacion", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Componente">
                <input
                  value={sodiTercerosForm.componente}
                  onChange={(e) => updateSodiTercerosField("componente", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Programador">
                <input
                  value={sodiTercerosForm.programador}
                  onChange={(e) => updateSodiTercerosField("programador", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Aviso">
                <input
                  value={sodiTercerosForm.aviso}
                  onChange={(e) => updateSodiTercerosField("aviso", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Actividad" full>
                <textarea
                  value={sodiTercerosForm.actividad}
                  onChange={(e) => updateSodiTercerosField("actividad", e.target.value)}
                  style={{ ...styles.input, minHeight: 84, resize: "vertical" }}
                />
              </FormField>

              <FormField label="Observación" full>
                <textarea
                  value={sodiTercerosForm.observacion}
                  onChange={(e) => updateSodiTercerosField("observacion", e.target.value)}
                  style={{ ...styles.input, minHeight: 84, resize: "vertical" }}
                />
              </FormField>
            </div>

            <div style={styles.modalActions}>
              <button onClick={cerrarSodiTerceros} style={styles.secondaryButton}>
                Cancelar
              </button>

              <button
                onClick={guardarSodiTerceros}
                disabled={creatingSodiTerceros}
                style={{
                  ...styles.primaryDarkButton,
                  opacity: creatingSodiTerceros ? 0.7 : 1,
                }}
              >
                {creatingSodiTerceros ? "Creando..." : "Crear SODI TERCERO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {moveReasonOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Motivo de reprogramación</h2>
              </div>

              <button onClick={cerrarMoveReasonModal} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {moveReasonError && <div style={styles.errorBox}>{moveReasonError}</div>}

            <textarea
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
              placeholder="Escribe el motivo del cambio..."
            />

            <div style={styles.modalActions}>
              <button onClick={cerrarMoveReasonModal} style={styles.secondaryButton}>
                Cancelar
              </button>
              <button
                onClick={confirmarMovimiento}
                disabled={moving}
                style={{
                  ...styles.primaryBlueButton,
                  opacity: moving ? 0.7 : 1,
                }}
              >
                {moving ? "Guardando..." : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {suspensionReasonOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Motivo de suspensión</h2>
              </div>

              <button onClick={cerrarSuspensionReasonModal} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {suspensionReasonError && <div style={styles.errorBox}>{suspensionReasonError}</div>}

            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
              placeholder="Escribe el motivo de suspensión..."
            />

            <div style={styles.modalActions}>
              <button onClick={cerrarSuspensionReasonModal} style={styles.secondaryButton}>
                Cancelar
              </button>
              <button
                onClick={confirmarSuspensionConMotivo}
                disabled={updatingDetail}
                style={{
                  ...styles.primaryBlueButton,
                  opacity: updatingDetail ? 0.7 : 1,
                }}
              >
                {updatingDetail ? "Guardando..." : "Confirmar suspensión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {dayOverflow.open && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Trabajos del día</h2>
                <div style={styles.modalSubtitle}>{dayOverflow.date}</div>
              </div>

              <button onClick={cerrarDayOverflow} style={styles.closeButton}>
                ✕
              </button>
            </div>

            <div style={styles.overflowActions}>
              <button
                onClick={() => {
                  cerrarDayOverflow();
                  abrirNuevoPT(dayOverflow.date);
                }}
                style={styles.secondaryButton}
              >
                Nuevo PT en este día
              </button>
            </div>

            <div style={styles.overflowList}>
              {(gruposPorFecha.get(dayOverflow.date) || []).map((entry) => {
                const trabajo = entry.leader;
                const colors = estadoColor(trabajo.estado, trabajo.programador);

                return (
                  <button
                    key={entry.groupId || trabajo.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(trabajo.id);
                      cerrarDayOverflow();
                    }}
                    style={{
                      ...styles.overflowItem,
                      background: colors.background,
                      border: `1px solid ${colors.border}`,
                      color: colors.color,
                    }}
                  >
                    <div style={styles.overflowItemPt}>{trabajo.pt || "Sin PT"}</div>
                    <div style={styles.overflowItemMeta}>
                      {trabajo.subestacion || "-"} · {trabajo.fecha}
                    </div>
                    <div style={styles.overflowItemDesc}>
                      {trabajo.componente || trabajo.actividad || "-"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {toast.visible && <div style={styles.toast}>{toast.message}</div>}
    </main>
  );
}

function FormField({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ ...styles.field, gridColumn: full ? "1 / -1" : undefined }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#edf2f8",
    padding: 20,
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
  },
  headerCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
    marginBottom: 16,
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  headerButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  subtitle: {
    marginTop: 8,
    color: "#475569",
  },
  primaryBlueButton: {
    border: "none",
    background: "#2563eb",
    color: "white",
    borderRadius: 12,
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
    minWidth: 140,
  },
  primaryDarkButton: {
    border: "none",
    background: "#0f172a",
    color: "white",
    borderRadius: 12,
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 12,
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  fileBadge: {
    display: "inline-flex",
    alignItems: "center",
    background: "#e2e8f0",
    color: "#0f172a",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    background: "white",
    borderRadius: 14,
    padding: 14,
    border: "1px solid #dbe5f1",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  summaryValue: {
    display: "block",
    marginTop: 8,
    fontWeight: 800,
    fontSize: 32,
  },
  alertsWrapNew: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 16,
  },
  alertBoxNew: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    border: "1px solid #f5d46f",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    position: "relative",
  },
  alertBoxEssentialNew: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    border: "1px solid #f3b1b1",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    position: "relative",
  },
  alertCounterAmber: {
    position: "absolute",
    top: 12,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 26,
    color: "#b45309",
    background: "#b4530922",
  },
  alertCounterRed: {
    position: "absolute",
    top: 12,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 26,
    color: "#dc2626",
    background: "#dc262622",
  },
  alertTitleNew: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
  },
  alertSubtitleNew: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
  },
  alertListNew: {
    marginTop: 14,
    display: "grid",
    gap: 8,
  },
  alertEmptyNew: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 18,
    color: "#64748b",
    background: "#f8fafc",
  },
  alertItemButtonNew: {
    border: "1px solid #dbe5f1",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },
  alertItemPt: {
    fontWeight: 800,
    fontSize: 16,
    color: "#0f172a",
  },
  alertItemMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#475569",
  },
  alertItemDesc: {
    marginTop: 8,
    fontSize: 13,
    color: "#0f172a",
  },
  filtersCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
    marginBottom: 16,
  },
  filtersGridSimple: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 800,
    color: "#0f172a",
  },
  input: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    background: "white",
    boxSizing: "border-box",
  },
  inputReadonly: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    background: "#f8fafc",
    boxSizing: "border-box",
    color: "#334155",
  },
  actionsRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
  },
  segmented: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  segmentButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  segmentButtonActive: {
    background: "#0f172a",
    color: "white",
    borderColor: "#0f172a",
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    padding: 14,
    borderRadius: 12,
    fontWeight: 700,
    marginBottom: 12,
  },
  emptyBox: {
    background: "white",
    borderRadius: 18,
    padding: 22,
    border: "1px solid #dbe5f1",
    color: "#475569",
  },
  emptyInner: {
    padding: 18,
    color: "#64748b",
  },
  pmaChartsWrap: {
    marginBottom: 16,
  },
  pmaChartCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
  },
  pmaChartHeader: {
    marginBottom: 14,
  },
  pmaChartTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  pmaChartSubtitle: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
  },
  pmaKpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 10,
    marginBottom: 18,
  },
  pmaKpiCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  pmaKpiLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
  },
  pmaKpiValue: {
    display: "block",
    marginTop: 6,
    fontSize: 26,
    fontWeight: 800,
    color: "#0f172a",
  },
  pmaBarsWrap: {
    display: "grid",
    gap: 12,
  },
  pmaBarRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 60px",
    gap: 12,
    alignItems: "center",
  },
  pmaBarLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  },
  pmaBarTrack: {
    width: "100%",
    height: 14,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },
  pmaBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "#2563eb",
  },
  pmaBarValue: {
    textAlign: "right",
    fontWeight: 800,
    color: "#0f172a",
  },
  programadosWrap: {
    marginBottom: 16,
  },
  programadosCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
  },
  programadosHeader: {
    marginBottom: 14,
  },
  programadosTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  programadosSubtitle: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
  },
  programadosKpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
  },
  programadosKpiCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  programadosKpiLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
  },
  programadosKpiValue: {
    display: "block",
    marginTop: 6,
    fontSize: 26,
    fontWeight: 800,
    color: "#0f172a",
  },
  calendarToolbarNew: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  calendarMainTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
  },
  calendarMonthLabel: {
    marginTop: 8,
    color: "#475569",
    fontWeight: 700,
    textTransform: "capitalize",
  },
  calendarNav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  calendarWrapNew: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 12,
  },
  weekHeaderBlack: {
    textAlign: "center",
    fontWeight: 800,
    color: "white",
    background: "#0f172a",
    borderRadius: 12,
    padding: "10px 0",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
  },
  dayCellNew: {
    height: 255,
    minHeight: 255,
    maxHeight: 255,
    borderRadius: 18,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflow: "hidden",
  },
  dayHeaderNew: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  dayHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  addDayButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  dayNumberButtonNew: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
  },
  dayNumberNew: {
    fontWeight: 800,
    fontSize: 24,
    borderRadius: 999,
  },
  dayCountNew: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "#2563eb",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    padding: "0 7px",
  },
  dayBadgesRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  tinyBadgeBlue: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 800,
    color: "#1d4ed8",
    background: "#dbeafe",
    border: "1px solid #bfdbfe",
  },
  dayItemsNew: {
    display: "grid",
    gap: 6,
    flex: 1,
    overflowY: "auto",
    maxHeight: 150,
    minHeight: 150,
    paddingRight: 4,
  },
  eventCardCompactNew: {
    borderRadius: 12,
    padding: "6px 8px",
    display: "grid",
    gap: 3,
    textAlign: "left",
    cursor: "pointer",
  },
  eventCompactSubNew: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  eventCompactPtNew: {
    fontWeight: 800,
    fontSize: 10,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  eventCompactCompNew: {
    fontSize: 10,
    color: "#475569",
    lineHeight: 1.25,
    display: "-webkit-box",
    WebkitLineClamp: 2 as any,
    WebkitBoxOrient: "vertical" as any,
    overflow: "hidden",
  },
  dayFooterNew: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
    paddingTop: 4,
  },
  dayFooterText: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
  },
  moreItemsButtonNew: {
    border: "none",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  groupCardNew: {
    borderRadius: 12,
    padding: 8,
    display: "grid",
    gap: 6,
  },
  groupHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  groupBadgeNew: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 10,
    fontWeight: 800,
    background: "rgba(255,255,255,0.8)",
    color: "#0f172a",
  },
  groupMembersNew: {
    display: "grid",
    gap: 4,
  },
  groupMemberButtonNew: {
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.65)",
    background: "rgba(255,255,255,0.75)",
    borderRadius: 10,
    padding: "6px 8px",
    cursor: "pointer",
  },
  groupMemberPtNew: {
    fontWeight: 800,
    fontSize: 10,
    color: "#0f172a",
  },
  groupMemberCompNew: {
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
  },
  groupActionsNew: {
    display: "flex",
    justifyContent: "flex-end",
  },
  unlinkButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  tableWrap: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeadRow: {
    background: "#f8fafc",
  },
  th: {
    textAlign: "left",
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },
  tr: {
    borderBottom: "1px solid #eef2f7",
  },
  td: {
    padding: 12,
    fontSize: 13,
    color: "#0f172a",
    verticalAlign: "top",
  },
  estadoChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.42)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 1000,
  },
  modalLarge: {
    width: "min(980px, 100%)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "white",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
    border: "1px solid #dbe5f1",
  },
  modalXL: {
    width: "min(1180px, 100%)",
    maxHeight: "92vh",
    overflow: "auto",
    background: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
    border: "1px solid #dbe5f1",
  },
  modalSmall: {
    width: "min(620px, 100%)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "white",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
    border: "1px solid #dbe5f1",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
  },
  modalSubtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 14,
  },
  closeButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  detailGrid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    alignItems: "start",
  },
  newPtGrid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    alignItems: "start",
  },
  newPtGrid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    alignItems: "start",
    marginTop: 10,
  },
  detailBlock: {
    marginTop: 10,
  },
  textareaWide: {
    width: "100%",
    minHeight: 78,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    background: "white",
    boxSizing: "border-box",
    resize: "vertical",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  modalActionsRight: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  overflowActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  overflowList: {
    display: "grid",
    gap: 10,
  },
  overflowItem: {
    borderRadius: 14,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
  },
  overflowItemPt: {
    fontWeight: 800,
    fontSize: 16,
  },
  overflowItemMeta: {
    marginTop: 6,
    fontSize: 13,
  },
  overflowItemDesc: {
    marginTop: 8,
    fontSize: 13,
  },
  toast: {
    position: "fixed",
    right: 20,
    bottom: 20,
    background: "#0f172a",
    color: "white",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 800,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.2)",
    zIndex: 1200,
  },
};