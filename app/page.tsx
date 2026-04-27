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
  __manual?: boolean;
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
  isManual: boolean;
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
  conPt: number;
};

type ProgramadosSummary = {
  total: number;
  enProgramacion: number;
  autorizados: number;
  suspendidos: number;
  manuales: number;
};

type OpatHealthState = {
  status: "unknown" | "ok" | "expired" | "error" | "checking";
  message: string;
  lastCheck: string;
};

type PmaCalendarFilter = "todos" | "en_calendario" | "fuera_calendario";

type PtsDiariosMesItem = {
  fecha: string;
  dia: number;
  total: number;
};

const LS_ACOPLES_KEY = "cct_acoples_v1";
const LS_HISTORIAL_KEY = "cct_historial_v1";
const LS_MANUALES_KEY = "cct_pts_manuales_v1";

const DEFAULT_USUARIO = "Nicolás Lorenzen";
const DEFAULT_ORIGEN = "APP_CALENDARIO_CCT";

const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000;

const PMA_ESPECIALIDADES_BASE = ["EM", "TR", "SSAA", "SSGG", "EM - LLVV"];

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
// ==============================
// Helpers base
// ==============================

function formatDateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateISO(value: string): Date {
  return new Date(value + "T00:00:00");
}

function isWeekend(date: Date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function isHoliday(iso: string) {
  return CHILE_HOLIDAYS_2026.includes(iso);
}

function getMonthDays(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  const days: CalendarDay[] = [];
  const current = new Date(start);

  while (current <= end) {
    const iso = formatDateISO(current);
    days.push({
      date: new Date(current),
      iso,
      inMonth: current.getMonth() === month,
    });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function normalizeText(value?: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function isAssigned(programador?: string) {
  if (!programador) return false;
  const v = programador.trim();
  if (!v) return false;
  if (v === "-") return false;
  return true;
}

function isManualPT(trabajo: TrabajoUI) {
  return trabajo.isManual === true;
}

// ==============================
// LocalStorage helpers
// ==============================

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ==============================
// Conversión OPAT → UI
// ==============================

function mapOpatToUI(items: OpatTrabajo[]): TrabajoUI[] {
  return items.map((t, idx) => {
    const fecha = t.fInicio || "";

    return {
      id: t.id || `${t.pt}-${idx}`,
      original: t,
      fecha,
      pt: t.pt || "",
      horaInicio: t.inicio || "",
      horaFin: t.fin || "",
      subestacion: t.ssee || "",
      componente: t.comp || "",
      actividad: t.desc || "",
      estado: t.estado || "",
      tipo: t.tipo || "",
      observacion: t.obs || "",
      programador: t.prog || "",
      area: t.area || "",
      aviso: t.aviso || "",
      sodi: t.sodi || "",
      isManual: t.__manual === true,
    };
  });
}

// ==============================
// Métricas Programados
// ==============================

function buildProgramadosSummary(trabajos: TrabajoUI[]): ProgramadosSummary {
  let enProgramacion = 0;
  let autorizados = 0;
  let suspendidos = 0;
  let manuales = 0;

  trabajos.forEach((t) => {
    const estado = normalizeText(t.estado);

    if (estado.includes("program")) enProgramacion++;
    else if (estado.includes("autoriz")) autorizados++;
    else if (estado.includes("susp")) suspendidos++;

    if (t.isManual) manuales++;
  });

  return {
    total: trabajos.length,
    enProgramacion,
    autorizados,
    suspendidos,
    manuales,
  };
}
// ==============================
// Métricas PMA
// ==============================

function pmaHasPT(item: PMAItem) {
  const value = String(item.pt || "").trim();
  return value.length > 0 && value !== "-" && value.toLowerCase() !== "sin pt";
}

function buildPmaSummary(items: PMAItem[]): PmaSummary {
  let pendientes = 0;
  let ejecutados = 0;
  let reprogramados = 0;
  let anulados = 0;
  let otros = 0;
  let conPt = 0;

  items.forEach((item) => {
    const estado = normalizeText(item.estadoOriginal || item.estadoNormalizado || "");

    if (pmaHasPT(item)) conPt++;

    if (item.reprogramado || estado.includes("reprogram")) {
      reprogramados++;
    } else if (estado.includes("ejecut") || estado.includes("realiz")) {
      ejecutados++;
    } else if (estado.includes("anul") || estado.includes("cancel")) {
      anulados++;
    } else if (estado.includes("pend") || estado.includes("program")) {
      pendientes++;
    } else {
      otros++;
    }
  });

  return {
    total: items.length,
    pendientes,
    ejecutados,
    reprogramados,
    anulados,
    otros,
    conPt,
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

function buildPtSet(trabajos: TrabajoUI[]) {
  const set = new Set<string>();

  trabajos.forEach((t) => {
    const pt = String(t.pt || "").trim();
    if (pt) set.add(pt);
  });

  return set;
}

function pmaInCalendar(item: PMAItem, ptSet: Set<string>) {
  const pt = String(item.pt || "").trim();
  if (!pt) return false;

  const possiblePts = pt
    .split(/[;,/|]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (possiblePts.length === 0) return ptSet.has(pt);

  return possiblePts.some((x) => ptSet.has(x));
}

// ==============================
// PTs diarios mensual
// ==============================

function buildPtsDiariosMes(
  trabajos: TrabajoUI[],
  year: number,
  month: number
): PtsDiariosMesItem[] {
  const lastDay = new Date(year, month + 1, 0).getDate();

  const base: PtsDiariosMesItem[] = Array.from({ length: lastDay }, (_, idx) => {
    const dia = idx + 1;
    const date = new Date(year, month, dia);

    return {
      fecha: formatDateISO(date),
      dia,
      total: 0,
    };
  });

  const index = new Map(base.map((item) => [item.fecha, item]));

  trabajos.forEach((trabajo) => {
    const item = index.get(trabajo.fecha);
    if (item) item.total++;
  });

  return base;
}

// ==============================
// Estilos por estado / manual
// ==============================

function getTrabajoColors(trabajo: TrabajoUI) {
  if (trabajo.isManual) {
    return {
      background: "#fef9c3",
      border: "#fde68a",
      color: "#713f12",
    };
  }

  const estado = normalizeText(trabajo.estado);

  if (estado.includes("autoriz")) {
    return {
      background: "#ecfdf3",
      border: "#86efac",
      color: "#166534",
    };
  }

  if (estado.includes("susp")) {
    return {
      background: "#fef2f2",
      border: "#fecaca",
      color: "#991b1b",
    };
  }

  if (isAssigned(trabajo.programador)) {
    return {
      background: "#dbeafe",
      border: "#93c5fd",
      color: "#1e3a8a",
    };
  }

  return {
    background: "#eff6ff",
    border: "#bfdbfe",
    color: "#1e3a8a",
  };
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}

function formatDisplayDate(iso: string) {
  if (!iso) return "-";

  const [y, m, d] = iso.split("-");

  if (!y || !m || !d) return iso;

  return `${d}-${m}-${y}`;
}

function formatTimestamp(date: Date) {
  return date.toLocaleString("es-CL");
}
// ==============================
// Formularios base
// ==============================

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
  };
}

// ==============================
// CEN / instalaciones esenciales
// ==============================

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

function isHolidayDate(date: Date) {
  return CHILE_HOLIDAYS_2026.includes(toLocalDateInputValue(date));
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  const weekend = day === 0 || day === 6;
  return !weekend && !isHolidayDate(date);
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
    if (isBusinessDay(d)) remaining -= 1;
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

    const fourthBusinessDayBefore = subtractBusinessDays(workDate, 4);
    const lastDay4Business = addDays(fourthBusinessDayBefore, -1);
    
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

// ==============================
// Acoples / historial
// ==============================

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
          const parsed = JSON.parse(String(row[2] || "[]"));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      createdAt: String(row[3] || ""),
    }));
}

function buildMonthGrid(monthCursor: Date): CalendarDay[] {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const start = new Date(first);
  const startDay = start.getDay(); // 0 domingo, 1 lunes...
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  start.setDate(start.getDate() + mondayOffset);

  const end = new Date(last);
  const endDay = end.getDay();
  const sundayOffset = endDay === 0 ? 0 : 7 - endDay;
  end.setDate(end.getDate() + sundayOffset);

  const days: CalendarDay[] = [];
  const current = new Date(start);

  while (current <= end) {
    days.push({
      date: new Date(current),
      iso: toLocalDateInputValue(current),
      inMonth: current.getMonth() === month,
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function truncateSoft(value: string, max = 32) {
  const text = String(value || "").trim();

  if (text.length <= max) return text;

  return `${text.slice(0, max - 1)}…`;
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

  const [manualPtIds, setManualPtIds] = useState<string[]>([]);

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

  const [pmaEspecialidadesSeleccionadas, setPmaEspecialidadesSeleccionadas] =
    useState<string[]>(PMA_ESPECIALIDADES_BASE);

  const [pmaCalendarFilter, setPmaCalendarFilter] =
    useState<PmaCalendarFilter>("todos");

  const [opatHealth, setOpatHealth] = useState<OpatHealthState>({
    status: "unknown",
    message: "OPAT sin verificar",
    lastCheck: "",
  });

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewCookieValue, setRenewCookieValue] = useState("");
  const [renewError, setRenewError] = useState("");
  const [renewing, setRenewing] = useState(false);

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
    if (typeof window === "undefined") return;

    const stored = loadJSON<string[]>(LS_MANUALES_KEY, []);
    setManualPtIds(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    saveJSON(LS_MANUALES_KEY, manualPtIds);
  }, [manualPtIds]);

  const marcarPtManual = (pt: string) => {
    const clean = String(pt || "").trim();
    if (!clean) return;

    setManualPtIds((prev) => {
      if (prev.includes(clean)) return prev;
      return [...prev, clean];
    });
  };

  const checkOpatHealth = async (silent = true) => {
    try {
      if (!silent) {
        setOpatHealth((prev) => ({
          ...prev,
          status: "checking",
          message: "Verificando OPAT...",
        }));
      }

      const res = await fetch("/api/opat/health", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      const checkTime = new Date().toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (res.ok && json?.success && json?.status === "ok") {
        setOpatHealth({
          status: "ok",
          message: `OPAT OK · ${json?.count ?? "-"} trabajos`,
          lastCheck: checkTime,
        });

        return true;
      }

      if (json?.status === "expired") {
        setOpatHealth({
          status: "expired",
          message: "Sesión OPAT expirada",
          lastCheck: checkTime,
        });

        return false;
      }

      setOpatHealth({
        status: "error",
        message: json?.message || "No se pudo verificar OPAT",
        lastCheck: checkTime,
      });

      return false;
    } catch (err) {
      console.error(err);

      setOpatHealth({
        status: "error",
        message: "Error verificando OPAT",
        lastCheck: new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });

      return false;
    }
  };

  useEffect(() => {
    checkOpatHealth(true);

    const timer = window.setInterval(() => {
      checkOpatHealth(true);
    }, KEEP_ALIVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  const renovarSesionOpat = async () => {
    try {
      setRenewError("");

      const value = renewCookieValue.trim();

      if (!value) {
        setRenewError("Debes pegar el PHPSESSID.");
        return;
      }

      setRenewing(true);

      const res = await fetch("/api/opat/set-cookie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookie: value,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "No se pudo renovar la sesión OPAT.");
      }

      setRenewCookieValue("");
      setRenewModalOpen(false);

      await checkOpatHealth(false);
      mostrarToast("Sesión OPAT renovada");
    } catch (err: any) {
      console.error(err);
      setRenewError(err?.message || "No se pudo renovar la sesión OPAT.");
    } finally {
      setRenewing(false);
    }
  };
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

        if (typeof window !== "undefined") {
          setAcoples(loadJSON<AcopleGroup[]>(LS_ACOPLES_KEY, []));
          setHistorial(loadJSON<HistoryItem[]>(LS_HISTORIAL_KEY, []));
        }
      } finally {
        setPersistReady(true);
      }
    };

    cargarPersistencia();
  }, []);

  useEffect(() => {
    if (!persistReady || typeof window === "undefined") return;
    saveJSON(LS_ACOPLES_KEY, acoples);
  }, [acoples, persistReady]);

  useEffect(() => {
    if (!persistReady || typeof window === "undefined") return;
    saveJSON(LS_HISTORIAL_KEY, historial);
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

      const json = await res.json();

      if (!res.ok) {
        const msg =
          json?.message ||
          json?.error ||
          json?.opatResponse?.mensaje ||
          "No se pudo obtener la agenda desde OPAT";

        if (String(msg).toLowerCase().includes("expir")) {
          setOpatHealth({
            status: "expired",
            message: "Sesión OPAT expirada",
            lastCheck: new Date().toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }

        throw new Error(msg);
      }

      if (!Array.isArray(json)) {
        throw new Error("La respuesta de OPAT no tiene el formato esperado");
      }

      setData(json);

      const actual = new Date();
      setMonthCursor(new Date(actual.getFullYear(), actual.getMonth(), 1));

      setOpatHealth({
        status: "ok",
        message: `OPAT OK · ${json.length} trabajos`,
        lastCheck: new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });

      mostrarToast("Agenda OPAT cargada");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error al cargar los datos desde OPAT");
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

      const especialidades = Array.from(
        new Set(
          parsed
            .map((item) => String(item.especialidad || "").trim())
            .filter(Boolean)
        )
      );

      const ordered = PMA_ESPECIALIDADES_BASE.filter((esp) =>
        especialidades.includes(esp)
      );

      const extras = especialidades
        .filter((esp) => !PMA_ESPECIALIDADES_BASE.includes(esp))
        .sort();

      setPmaEspecialidadesSeleccionadas([...ordered, ...extras]);

      await replacePmaPersist(parsed);
      mostrarToast(`PMA cargado: ${parsed.length} registros`);
    } catch (err: any) {
      console.error(err);
      setPmaError(err?.message || "No se pudo leer o guardar el archivo PMA.");
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
      .map((item, index) => {
        const pt = String(item.pt || "").trim();

        return {
          id:
            item.id?.toString() ||
            `${item.pt || "sin-pt"}-${item.fInicio || "sin-fecha"}-${index}`,
          original: item,
          fecha: item.fInicio || "",
          pt,
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
          isManual: item.__manual === true || manualPtIds.includes(pt),
        };
      })
      .sort((a, b) => {
        const aKey = `${a.fecha} ${a.horaInicio || "00:00"}`;
        const bKey = `${b.fecha} ${b.horaInicio || "00:00"}`;
        return aKey.localeCompare(bKey);
      });
  }, [data, manualPtIds]);

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

  const ptSetAgenda = useMemo(() => buildPtSet(trabajos), [trabajos]);

  const pmaEspecialidadesDisponibles = useMemo(() => {
    const set = new Set<string>();

    for (const item of pmaData) {
      const esp = String(item.especialidad || "").trim();
      if (esp) set.add(esp);
    }

    const ordered = PMA_ESPECIALIDADES_BASE.filter((esp) => set.has(esp));
    const extras = Array.from(set)
      .filter((esp) => !PMA_ESPECIALIDADES_BASE.includes(esp))
      .sort();

    return [...ordered, ...extras];
  }, [pmaData]);

  const pmaFiltrado = useMemo(() => {
    const q = normalizeText(busqueda);
    const selectedSet = new Set(pmaEspecialidadesSeleccionadas);

    return pmaData.filter((item) => {
      const especialidad = String(item.especialidad || "").trim();

      if (pmaEspecialidadesDisponibles.length > 0 && !selectedSet.has(especialidad)) {
        return false;
      }

      const existsInCalendar = pmaInCalendar(item, ptSetAgenda);

      if (pmaCalendarFilter === "en_calendario" && !existsInCalendar) {
        return false;
      }

      if (pmaCalendarFilter === "fuera_calendario" && existsInCalendar) {
        return false;
      }

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
          item.mesPma,
          item.mesPmaBarra,
        ].join(" ")
      );

      return texto.includes(q);
    });
  }, [
    pmaData,
    busqueda,
    pmaEspecialidadesSeleccionadas,
    pmaEspecialidadesDisponibles,
    pmaCalendarFilter,
    ptSetAgenda,
  ]);

  const pmaSummary = useMemo(() => buildPmaSummary(pmaFiltrado), [pmaFiltrado]);

  const pmaEnCalendarioCount = useMemo(() => {
    return pmaFiltrado.filter((item) => pmaInCalendar(item, ptSetAgenda)).length;
  }, [pmaFiltrado, ptSetAgenda]);
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

    for (const [, items] of map.entries()) {
      items.sort((a, b) => {
        const aKey = `${a.horaInicio || "00:00"} ${a.pt}`;
        const bKey = `${b.horaInicio || "00:00"} ${b.pt}`;
        return aKey.localeCompare(bKey);
      });
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

  const trabajosMesActual = useMemo(() => {
    const ym = `${monthCursor.getFullYear()}-${String(
      monthCursor.getMonth() + 1
    ).padStart(2, "0")}`;

    return trabajosFiltrados.filter((t) => t.fecha.startsWith(ym));
  }, [trabajosFiltrados, monthCursor]);

  const ptsDiariosMes = useMemo(() => {
    return buildPtsDiariosMes(
      trabajosFiltrados,
      monthCursor.getFullYear(),
      monthCursor.getMonth()
    );
  }, [trabajosFiltrados, monthCursor]);

  const maxPtsDiariosMes = useMemo(() => {
    return Math.max(...ptsDiariosMes.map((item) => item.total), 1);
  }, [ptsDiariosMes]);

  const cambiarMes = (delta: number) => {
    setMonthCursor(
      new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1)
    );
  };

  const irHoy = () => {
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  };

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

  const cerrarNuevoPT = () => {
    if (saving) return;
    setNewPTOpen(false);
    setNewPTError("");
  };

  const abrirDayOverflow = (dateIso: string) => {
    setDayOverflow({ open: true, date: dateIso });
  };

  const cerrarDayOverflow = () => {
    setDayOverflow({ open: false, date: "" });
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

  const updateNewPTField = (field: keyof NewPTForm, value: string) => {
    setNewPTForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateEditField = (field: keyof EditPTForm, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const togglePmaEspecialidad = (especialidad: string) => {
    setPmaEspecialidadesSeleccionadas((prev) => {
      if (prev.includes(especialidad)) {
        return prev.filter((item) => item !== especialidad);
      }

      return [...prev, especialidad];
    });
  };

  const seleccionarTodasEspecialidadesPMA = () => {
    setPmaEspecialidadesSeleccionadas(pmaEspecialidadesDisponibles);
  };

  const limpiarEspecialidadesPMA = () => {
    setPmaEspecialidadesSeleccionadas([]);
  };

  const getDayItems = (dateIso: string) => {
    return gruposPorFecha.get(dateIso) || [];
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

      const payload: OpatTrabajo = {
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
        __manual: true,
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
        const msg =
          json?.error ||
          json?.opatResponse?.mensaje ||
          "No se pudo guardar el PT.";

        if (String(msg).toLowerCase().includes("expir")) {
          setOpatHealth({
            status: "expired",
            message: "Sesión OPAT expirada",
            lastCheck: new Date().toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }

        throw new Error(msg);
      }

      marcarPtManual(payload.pt);

      setData((prev) => [payload, ...prev]);

      setNewPTOpen(false);
      setNewPTError("");
      setNewPTForm(emptyNewPTForm());

      mostrarToast("PT manual guardado en OPAT");
      await checkOpatHealth(true);
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

      const opatPayload: OpatTrabajo = {
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
        __manual: true,
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
          opatJson?.error ||
            opatJson?.opatResponse?.mensaje ||
            "Se creó en Centrality, pero falló OPAT."
        );
      }

      marcarPtManual(nuevoPt);

      await cargarOPAT();

      setSodiTercerosOpen(false);
      setSodiTercerosForm(emptySodiTercerosForm());

      mostrarToast(`SODI TERCERO creado: ${nuevoPt}`);
      await checkOpatHealth(true);
    } catch (err: any) {
      console.error(err);
      setSodiTercerosError(err?.message || "No se pudo crear el SODI TERCERO.");
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
    const desacoplarGrupo = async (
    groupId: string,
    leaderPt: string,
    fecha: string
  ) => {
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
        const msg =
          json?.error ||
          json?.opatResponse?.mensaje ||
          "No se pudo reprogramar el PT.";

        if (String(msg).toLowerCase().includes("expir")) {
          setOpatHealth({
            status: "expired",
            message: "Sesión OPAT expirada",
            lastCheck: new Date().toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }

        throw new Error(msg);
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
      await checkOpatHealth(true);
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
        const msg =
          json?.error ||
          json?.opatResponse?.mensaje ||
          "No se pudo actualizar el trabajo.";

        if (String(msg).toLowerCase().includes("expir")) {
          setOpatHealth({
            status: "expired",
            message: "Sesión OPAT expirada",
            lastCheck: new Date().toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }

        throw new Error(msg);
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

      await checkOpatHealth(true);
    } catch (err: any) {
      console.error(err);
      setEditError(err?.message || "No se pudo guardar la edición en OPAT.");
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

      <button
        type="button"
        onClick={() => setRenewModalOpen(true)}
        style={{
          ...styles.opatFloatingButton,
          ...(opatHealth.status === "ok"
            ? styles.opatFloatingOk
            : opatHealth.status === "expired"
            ? styles.opatFloatingExpired
            : opatHealth.status === "checking"
            ? styles.opatFloatingChecking
            : styles.opatFloatingUnknown),
        }}
        title={opatHealth.message}
      >
        <span style={styles.opatDot} />
        {opatHealth.status === "ok"
          ? "OPAT OK"
          : opatHealth.status === "expired"
          ? "Renovar OPAT"
          : opatHealth.status === "checking"
          ? "Verificando..."
          : "OPAT"}
      </button>

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
              Último día operativo:{" "}
              {toLocalDateInputValue(cenAlerts.effectiveToday)}
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
                      {item.componente || item.actividad || "-"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section style={styles.alertBoxEssentialNew}>
            <div style={styles.alertCounterRed}>{cenAlerts.essential.length}</div>

            <h2 style={styles.alertTitleNew}>
              Avisos CEN instalaciones esenciales
            </h2>
            <p style={styles.alertSubtitleNew}>
              Regla de 12 días corridos · corte 07:00
            </p>

            <div style={styles.alertListNew}>
              {cenAlerts.essential.length === 0 ? (
                <div style={styles.alertEmptyNew}>
                  Hoy no hay trabajos esenciales que venzan por la regla de 12
                  días.
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
                      {item.componente || item.actividad || "-"}
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

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {pmaFileName ? (
              <span style={styles.fileBadge}>{pmaFileName}</span>
            ) : null}

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
            {vista === "calendario" && trabajos.length > 0 && (
        <>
          <div style={styles.calendarToolbarNew}>
            <div>
              <h2 style={styles.calendarMainTitle}>Calendario operativo</h2>
              <div style={styles.calendarMonthLabel}>
                {formatMonthLabel(monthCursor)}
              </div>
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

          <div style={styles.calendarLegend}>
            <div style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: "#eff6ff",
                  borderColor: "#bfdbfe",
                }}
              />
              En programación sin asignar
            </div>
            <div style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: "#dbeafe",
                  borderColor: "#93c5fd",
                }}
              />
              En programación asignado
            </div>
            <div style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: "#fef9c3",
                  borderColor: "#fde68a",
                }}
              />
              PT manual
            </div>
            <div style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: "#ecfdf3",
                  borderColor: "#86efac",
                }}
              />
              Autorizado
            </div>
            <div style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: "#fef2f2",
                  borderColor: "#fecaca",
                }}
              />
              Suspendido
            </div>
          </div>

          <div style={styles.calendarWrapNew}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <div key={day} style={styles.weekHeaderBlack}>
                {day}
              </div>
            ))}

            {diasMes.map((day) => {
              const groupedItems = getDayItems(day.iso);
              const totalDia = trabajosPorFecha.get(day.iso)?.length || 0;
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
                          color: isToday
                            ? "#1d4ed8"
                            : day.inMonth
                            ? "#0f172a"
                            : "#94a3b8",
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

                      {totalDia > 0 && (
                        <span style={styles.dayCountNew}>{totalDia}</span>
                      )}
                    </div>
                  </div>

                  {totalDia > 0 ? (
                    <div style={styles.dayBadgesRow}>
                      <span style={styles.tinyBadgeBlue}>{totalDia} PT</span>
                    </div>
                  ) : null}

                  <div style={styles.dayItemsNew}>
                    {groupedItems.slice(0, 4).map((entry) => {
                      const trabajo = entry.leader;
                      const colors = getTrabajoColors(trabajo);
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

                              {trabajo.programador ? (
                                <div style={styles.eventProgramador}>
                                  {trabajo.programador}
                                </div>
                              ) : null}
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

                          {trabajo.programador ? (
                            <div style={styles.eventProgramador}>
                              {trabajo.programador}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {totalDia > 0 ? (
                    <div style={styles.dayFooterNew}>
                      <div style={styles.dayFooterText}>
                        {totalDia} trabajo(s)
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
            {vista === "tabla" && (
        <>
          <div style={styles.programadosWrap}>
            <div style={styles.programadosCard}>
              <div style={styles.programadosHeader}>
                <h2 style={styles.programadosTitle}>Avance Trabajos Programados</h2>
                <div style={styles.programadosSubtitle}>
                  Resumen de PTs actualmente visibles en la tabla.
                </div>
              </div>

              <div style={styles.programadosKpiRow5}>
                <div style={styles.programadosKpiCard}>
                  <span style={styles.programadosKpiLabel}>Total PTs cargados</span>
                  <strong style={styles.programadosKpiValue}>
                    {programadosSummary.total}
                  </strong>
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

                <div style={styles.programadosKpiCardManual}>
                  <span style={styles.programadosKpiLabel}>PTs manuales</span>
                  <strong style={styles.programadosKpiValue}>
                    {programadosSummary.manuales}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.programadosWrap}>
            <div style={styles.programadosCard}>
              <div style={styles.programadosHeader}>
                <h2 style={styles.programadosTitle}>PTs diarios</h2>
                <div style={styles.programadosSubtitle}>
                  Distribución diaria del mes visible: {formatMonthLabel(monthCursor)}.
                </div>
              </div>

              <div style={styles.monthBarsWrap}>
                {ptsDiariosMes.map((item) => {
                  const heightPct = item.total === 0 ? 0 : Math.max(8, (item.total / maxPtsDiariosMes) * 100);

                  return (
                    <div key={item.fecha} style={styles.monthBarItem}>
                      <div style={styles.monthBarValue}>
                        {item.total > 0 ? item.total : ""}
                      </div>

                      <div style={styles.monthBarTrack}>
                        <div
                          title={`Día ${item.dia}: ${item.total} PT`}
                          style={{
                            ...styles.monthBarFill,
                            height: `${heightPct}%`,
                            opacity: item.total === 0 ? 0.18 : 1,
                          }}
                        />
                      </div>

                      <div style={styles.monthBarDay}>{item.dia}</div>
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
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>PT</th>
                  <th style={styles.th}>Hora</th>
                  <th style={styles.th}>Subestación</th>
                  <th style={styles.th}>Componente</th>
                  <th style={styles.th}>Actividad</th>
                  <th style={styles.th}>Programador</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Origen</th>
                </tr>
              </thead>

              <tbody>
                {trabajosFiltrados.map((trabajo) => {
                  const colors = getTrabajoColors(trabajo);

                  return (
                    <tr
                      key={trabajo.id}
                      onClick={() => setSelectedId(trabajo.id)}
                      style={{
                        ...styles.tr,
                        cursor: "pointer",
                        background:
                          trabajo.isManual
                            ? "#fffbeb"
                            : normalizeText(trabajo.estado).includes("program") &&
                              isAssigned(trabajo.programador)
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
                      <td style={styles.td}>{trabajo.actividad || "-"}</td>
                      <td style={styles.td}>{trabajo.programador || "-"}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.estadoChip,
                            background: colors.background,
                            color: colors.color,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {trabajo.estado || "-"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {trabajo.isManual ? (
                          <span style={styles.manualChip}>Manual</span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      {vista === "pma" && (
        <>
          <div style={styles.pmaChartsWrap}>
            <div style={styles.pmaChartCard}>
              <div style={styles.pmaChartHeader}>
                <h2 style={styles.pmaChartTitle}>Avance PMA</h2>
                <div style={styles.pmaChartSubtitle}>
                  Resumen según filtros aplicados.
                </div>
              </div>

              <div style={styles.pmaKpiRow}>
                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Total filtrado</span>
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
                  <span style={styles.pmaKpiLabel}>En calendario</span>
                  <strong style={styles.pmaKpiValue}>{pmaEnCalendarioCount}</strong>
                </div>

                <div style={styles.pmaKpiCard}>
                  <span style={styles.pmaKpiLabel}>Con PT</span>
                  <strong style={styles.pmaKpiValue}>{pmaSummary.conPt}</strong>
                </div>
              </div>

              <div style={styles.pmaBarsWrap}>
                {[
                  { key: "pendientes", label: "Pendientes", value: pmaSummary.pendientes },
                  { key: "ejecutados", label: "Ejecutados", value: pmaSummary.ejecutados },
                  { key: "reprogramados", label: "Reprogramados", value: pmaSummary.reprogramados },
                  { key: "anulados", label: "Anulados", value: pmaSummary.anulados },
                  { key: "conPt", label: "Con PT", value: pmaSummary.conPt },
                  { key: "otros", label: "Otros", value: pmaSummary.otros },
                ].map((item) => {
                  const max = Math.max(
                    pmaSummary.pendientes,
                    pmaSummary.ejecutados,
                    pmaSummary.reprogramados,
                    pmaSummary.anulados,
                    pmaSummary.conPt,
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
                    <div style={styles.pmaFilterCard}>
            <div>
              <h3 style={styles.pmaFilterTitle}>Filtros PMA</h3>
              <p style={styles.pmaFilterSubtitle}>
                Filtra rápido por especialidad y por presencia en calendario.
              </p>
            </div>

            <div style={styles.pmaFilterActions}>
              <button
                type="button"
                onClick={seleccionarTodasEspecialidadesPMA}
                style={styles.secondaryButton}
              >
                Todas las especialidades
              </button>

              <button
                type="button"
                onClick={limpiarEspecialidadesPMA}
                style={styles.secondaryButton}
              >
                Limpiar especialidades
              </button>

              <select
                value={pmaCalendarFilter}
                onChange={(e) =>
                  setPmaCalendarFilter(e.target.value as PmaCalendarFilter)
                }
                style={styles.inputCompact}
              >
                <option value="todos">Todos</option>
                <option value="en_calendario">Solo en calendario</option>
                <option value="fuera_calendario">Fuera de calendario</option>
              </select>
            </div>

            <div style={styles.pmaSpecialtyGrid}>
              {pmaEspecialidadesDisponibles.length === 0 ? (
                <div style={styles.emptyInner}>
                  Carga un PMA para ver especialidades disponibles.
                </div>
              ) : (
                pmaEspecialidadesDisponibles.map((esp) => {
                  const checked = pmaEspecialidadesSeleccionadas.includes(esp);

                  return (
                    <button
                      key={esp}
                      type="button"
                      onClick={() => togglePmaEspecialidad(esp)}
                      style={{
                        ...styles.pmaSpecialtyButton,
                        ...(checked ? styles.pmaSpecialtyButtonActive : {}),
                      }}
                    >
                      {checked ? "✓ " : ""}
                      {esp}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>En calendario</th>
                  <th style={styles.th}>Mes PMA</th>
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
                {pmaFiltrado.map((item) => {
                  const existsInCalendar = pmaInCalendar(item, ptSetAgenda);

                  return (
                    <tr key={item.id} style={styles.tr}>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        {existsInCalendar ? (
                          <span style={styles.checkCalendar}>✓</span>
                        ) : (
                          ""
                        )}
                      </td>
                      <td style={styles.td}>
                        {item.mesPma || item.mesPmaBarra || "-"}
                      </td>
                      <td style={styles.td}>{item.ot || "-"}</td>
                      <td style={styles.td}>{item.pt || "-"}</td>
                      <td style={styles.td}>{item.subestacionOriginal || "-"}</td>
                      <td style={styles.td}>{item.componenteDetectado || "-"}</td>
                      <td style={styles.td}>{item.componenteTipo || "-"}</td>
                      <td style={styles.td}>{item.actividadResumen || "-"}</td>
                      <td style={styles.td}>{item.especialidad || "-"}</td>
                      <td style={styles.td}>{item.fechaBase || "-"}</td>
                      <td style={styles.td}>{item.estadoOriginal || "-"}</td>
                      <td style={styles.td}>{item.reprogramado ? "Sí" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pmaFiltrado.length === 0 && (
              <div style={styles.emptyInner}>
                {pmaData.length === 0
                  ? "Carga un archivo PMA CSV para visualizar la tabla."
                  : "No hay registros PMA que coincidan con los filtros."}
              </div>
            )}
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
                  {trabajoSeleccionado.subestacion || "-"} ·{" "}
                  {trabajoSeleccionado.pt || "-"}
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

            <div style={styles.detailGrid4}>
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
                  Crea en Centrality y luego lo registra en OPAT.
                </div>
              </div>

              <button onClick={cerrarSodiTerceros} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {sodiTercerosError && (
              <div style={styles.errorBox}>{sodiTercerosError}</div>
            )}

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
                  onChange={(e) =>
                    updateSodiTercerosField("fecha", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora inicio">
                <input
                  type="time"
                  value={sodiTercerosForm.horaInicio}
                  onChange={(e) =>
                    updateSodiTercerosField("horaInicio", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora fin">
                <input
                  type="time"
                  value={sodiTercerosForm.horaFin}
                  onChange={(e) =>
                    updateSodiTercerosField("horaFin", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Subestación">
                <input
                  value={sodiTercerosForm.subestacion}
                  onChange={(e) =>
                    updateSodiTercerosField("subestacion", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Componente">
                <input
                  value={sodiTercerosForm.componente}
                  onChange={(e) =>
                    updateSodiTercerosField("componente", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Programador">
                <input
                  value={sodiTercerosForm.programador}
                  onChange={(e) =>
                    updateSodiTercerosField("programador", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Aviso">
                <input
                  value={sodiTercerosForm.aviso}
                  onChange={(e) =>
                    updateSodiTercerosField("aviso", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>
            </div>

            <div style={styles.detailBlock}>
              <FormField label="Actividad">
                <textarea
                  value={sodiTercerosForm.actividad}
                  onChange={(e) =>
                    updateSodiTercerosField("actividad", e.target.value)
                  }
                  style={styles.textareaWide}
                />
              </FormField>
            </div>

            <div style={styles.detailBlock}>
              <FormField label="Observación">
                <textarea
                  value={sodiTercerosForm.observacion}
                  onChange={(e) =>
                    updateSodiTercerosField("observacion", e.target.value)
                  }
                  style={styles.textareaWide}
                />
              </FormField>
            </div>

            <div style={styles.modalActionsRight}>
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
              style={styles.textareaWide}
              placeholder="Escribe el motivo del cambio..."
            />

            <div style={styles.modalActionsRight}>
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

              <button
                onClick={cerrarSuspensionReasonModal}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            {suspensionReasonError && (
              <div style={styles.errorBox}>{suspensionReasonError}</div>
            )}

            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              style={styles.textareaWide}
              placeholder="Escribe el motivo de suspensión..."
            />

            <div style={styles.modalActionsRight}>
              <button
                onClick={cerrarSuspensionReasonModal}
                style={styles.secondaryButton}
              >
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
                const colors = getTrabajoColors(trabajo);

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
                    <div style={styles.overflowItemPt}>
                      {trabajo.pt || "Sin PT"}
                    </div>
                    <div style={styles.overflowItemMeta}>
                      {trabajo.subestacion || "-"} · {trabajo.fecha}
                    </div>
                    <div style={styles.overflowItemDesc}>
                      {trabajo.componente || trabajo.actividad || "-"}
                    </div>
                    <div style={styles.overflowItemProgramador}>
                      Programador: {trabajo.programador || "Sin asignar"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {renewModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Renovar sesión OPAT</h2>
                <div style={styles.modalSubtitle}>
                  Puedes pegar solo el valor o completo: PHPSESSID=xxxx
                </div>
              </div>

              <button onClick={() => setRenewModalOpen(false)} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {renewError && <div style={styles.errorBox}>{renewError}</div>}

            <FormField label="PHPSESSID">
              <input
                value={renewCookieValue}
                onChange={(e) => setRenewCookieValue(e.target.value)}
                placeholder="PHPSESSID=..."
                style={styles.input}
              />
            </FormField>

            <div style={styles.modalActionsRight}>
              <button onClick={() => checkOpatHealth(false)} style={styles.secondaryButton}>
                Verificar
              </button>

              <button
                onClick={renovarSesionOpat}
                disabled={renewing}
                style={{
                  ...styles.primaryBlueButton,
                  opacity: renewing ? 0.7 : 1,
                }}
              >
                {renewing ? "Renovando..." : "Guardar sesión"}
              </button>
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
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
  headerButtons: { display: "flex", gap: 10, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 24, fontWeight: 800 },
  subtitle: { marginTop: 8, color: "#475569" },
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
  inputCompact: {
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
  summaryLabel: { color: "#64748b", fontSize: 12 },
  summaryValue: { display: "block", marginTop: 8, fontWeight: 800, fontSize: 32 },
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
    position: "relative",
  },
  alertBoxEssentialNew: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    border: "1px solid #f3b1b1",
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
  alertTitleNew: { margin: 0, fontSize: 18, fontWeight: 800 },
  alertSubtitleNew: { marginTop: 8, color: "#64748b", fontSize: 13 },
  alertListNew: { marginTop: 14, display: "grid", gap: 8 },
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
  alertItemPt: { fontWeight: 800, fontSize: 16, color: "#0f172a" },
  alertItemMeta: { marginTop: 6, fontSize: 13, color: "#475569" },
  alertItemDesc: { marginTop: 8, fontSize: 13, color: "#0f172a" },
  filtersCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
    marginBottom: 16,
  },
  filtersGridSimple: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  field: { display: "grid", gap: 6 },
  label: { display: "block", marginBottom: 6, fontWeight: 800, color: "#0f172a" },
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
  segmented: { display: "flex", gap: 8, flexWrap: "wrap" },
  segmentButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  segmentButtonActive: { background: "#0f172a", color: "white", borderColor: "#0f172a" },
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
  emptyInner: { padding: 18, color: "#64748b" },
  calendarToolbarNew: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  calendarMainTitle: { margin: 0, fontSize: 32, fontWeight: 800 },
  calendarMonthLabel: {
    marginTop: 8,
    color: "#475569",
    fontWeight: 700,
    textTransform: "capitalize",
  },
  calendarNav: { display: "flex", gap: 10, flexWrap: "wrap" },
  calendarLegend: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    border: "1px solid",
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
  dayHeaderNew: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  dayHeaderActions: { display: "flex", alignItems: "center", gap: 6 },
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
  dayNumberButtonNew: { border: "none", background: "transparent", padding: 0, cursor: "pointer" },
  dayNumberNew: { fontWeight: 800, fontSize: 24, borderRadius: 999 },
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
  dayBadgesRow: { display: "flex", flexWrap: "wrap", gap: 6 },
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
  eventProgramador: { fontSize: 10, fontWeight: 800, color: "#1d4ed8" },
  dayFooterNew: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
    paddingTop: 4,
  },
  dayFooterText: { fontSize: 11, fontWeight: 800, color: "#64748b" },
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
  groupCardNew: { borderRadius: 12, padding: 8, display: "grid", gap: 6 },
  groupHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
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
  groupMembersNew: { display: "grid", gap: 4 },
  groupMemberButtonNew: {
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.65)",
    background: "rgba(255,255,255,0.75)",
    borderRadius: 10,
    padding: "6px 8px",
    cursor: "pointer",
  },
  groupMemberPtNew: { fontWeight: 800, fontSize: 10, color: "#0f172a" },
  groupMemberCompNew: { fontSize: 10, color: "#475569", marginTop: 2 },
  groupActionsNew: { display: "flex", justifyContent: "flex-end" },
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
  programadosWrap: { marginBottom: 16 },
  programadosCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
  },
  programadosHeader: { marginBottom: 14 },
  programadosTitle: { margin: 0, fontSize: 24, fontWeight: 800 },
  programadosSubtitle: { marginTop: 8, color: "#64748b", fontSize: 13 },
  programadosKpiRow5: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 10,
  },
  programadosKpiCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  programadosKpiCardManual: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 14,
    padding: 12,
  },
  programadosKpiLabel: { display: "block", color: "#64748b", fontSize: 12 },
  programadosKpiValue: { display: "block", marginTop: 6, fontSize: 26, fontWeight: 800, color: "#0f172a" },
  monthBarsWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(22px, 1fr))",
    gap: 8,
    alignItems: "end",
    height: 190,
    paddingTop: 16,
  },
  monthBarItem: {
    height: "100%",
    display: "grid",
    gridTemplateRows: "22px 1fr 20px",
    alignItems: "end",
    justifyItems: "center",
    gap: 4,
  },
  monthBarValue: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0f172a",
    minHeight: 16,
  },
  monthBarTrack: {
    width: "100%",
    maxWidth: 24,
    height: "100%",
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
  },
  monthBarFill: {
    width: "100%",
    background: "#2563eb",
    borderRadius: 999,
    minHeight: 2,
  },
  monthBarDay: {
    fontSize: 10,
    fontWeight: 700,
    color: "#64748b",
  },
  tableWrap: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
    overflowX: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeadRow: { background: "#f8fafc" },
  th: {
    textAlign: "left",
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },
  tr: { borderBottom: "1px solid #eef2f7" },
  td: { padding: 12, fontSize: 13, color: "#0f172a", verticalAlign: "top" },
  estadoChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  manualChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
    color: "#713f12",
    background: "#fef9c3",
    border: "1px solid #fde68a",
  },
  pmaChartsWrap: { marginBottom: 16 },
  pmaChartCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
  },
  pmaChartHeader: { marginBottom: 14 },
  pmaChartTitle: { margin: 0, fontSize: 24, fontWeight: 800 },
  pmaChartSubtitle: { marginTop: 8, color: "#64748b", fontSize: 13 },
  pmaKpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginBottom: 18,
  },
  pmaKpiCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  pmaKpiLabel: { display: "block", color: "#64748b", fontSize: 12 },
  pmaKpiValue: { display: "block", marginTop: 6, fontSize: 26, fontWeight: 800, color: "#0f172a" },
  pmaBarsWrap: { display: "grid", gap: 12 },
  pmaBarRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 60px",
    gap: 12,
    alignItems: "center",
  },
  pmaBarLabel: { fontSize: 13, fontWeight: 700, color: "#334155" },
  pmaBarTrack: {
    width: "100%",
    height: 14,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },
  pmaBarFill: { height: "100%", borderRadius: 999, background: "#2563eb" },
  pmaBarValue: { textAlign: "right", fontWeight: 800, color: "#0f172a" },
  pmaFilterCard: {
    background: "white",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    border: "1px solid #dbe5f1",
    marginBottom: 16,
  },
  pmaFilterTitle: { margin: 0, fontSize: 18, fontWeight: 800 },
  pmaFilterSubtitle: { marginTop: 6, color: "#64748b", fontSize: 13 },
  pmaFilterActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },
  pmaSpecialtyGrid: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 },
  pmaSpecialtyButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "8px 12px",
    background: "#fff",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  pmaSpecialtyButtonActive: {
    background: "#dbeafe",
    borderColor: "#93c5fd",
    color: "#1e3a8a",
  },
  checkCalendar: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 900,
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
  modalTitle: { margin: 0, fontSize: 20, fontWeight: 800 },
  modalSubtitle: { marginTop: 6, color: "#64748b", fontSize: 14 },
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
  detailBlock: { marginTop: 10 },
  textareaWide: {
    width: "100%",
    minHeight: 90,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    background: "white",
    boxSizing: "border-box",
    resize: "vertical",
  },
  modalActionsRight: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  overflowActions: { display: "flex", justifyContent: "flex-end", marginBottom: 12 },
  overflowList: { display: "grid", gap: 10 },
  overflowItem: { borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer" },
  overflowItemPt: { fontWeight: 800, fontSize: 16 },
  overflowItemMeta: { marginTop: 6, fontSize: 13 },
  overflowItemDesc: { marginTop: 8, fontSize: 13 },
  overflowItemProgramador: { marginTop: 8, fontSize: 12, fontWeight: 800 },
  opatFloatingButton: {
    position: "fixed",
    left: 18,
    bottom: 18,
    zIndex: 900,
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "9px 13px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(15,23,42,0.14)",
  },
  opatFloatingOk: { background: "#f8fafc", color: "#166534", borderColor: "#bbf7d0" },
  opatFloatingExpired: { background: "#fff1f2", color: "#b91c1c", borderColor: "#fecdd3" },
  opatFloatingChecking: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" },
  opatFloatingUnknown: { background: "#ffffff", color: "#475569" },
  opatDot: { width: 8, height: 8, borderRadius: 999, background: "currentColor" },
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
