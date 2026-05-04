import { NextRequest, NextResponse } from "next/server";
import { getOpatCookieOrThrow } from "@/lib/opat-session";

type CreatePayload = {
  pt: string;
  area: string;
  tipo: string;
  inicio: string;
  fin: string;
  ssee: string;
  comp: string;
  desc: string;
  obs: string;
  re: string;
  prog: string;
  aviso: string;
  sodi: string;
  estado: string;
  fInicio: string;
  fFin: string;
  to1: string;
  to2: string;
  go1: string;
  go2: string;
  gop: string;
  esSodi: string;
  sodiCorrelativo: string;
  sodiPara: string;
  sodiDe: string;
  gm: string;
};

function safeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function looksLikeHtml(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("<html") ||
    t.includes("<body") ||
    t.includes("<form") ||
    t.includes("<!doctype")
  );
}

function looksLikeLoginPage(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("login") ||
    t.includes("usuario") ||
    t.includes("contraseña") ||
    t.includes("password") ||
    t.includes("iniciar sesión") ||
    t.includes("ingresar")
  );
}

function detectOatFailureFromJson(json: any) {
  const raw = JSON.stringify(json).toLowerCase();

  if (
    raw.includes("error") ||
    raw.includes("exception") ||
    raw.includes("deneg") ||
    raw.includes("invalid") ||
    raw.includes("unauthorized") ||
    raw.includes("forbidden") ||
    raw.includes("success\":false")
  ) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreatePayload>;

    const payload: CreatePayload = {
      pt: body.pt ?? "",
      area: body.area ?? "",
      tipo: body.tipo ?? "DESCONEXIÓN",
      inicio: body.inicio ?? "08:00",
      fin: body.fin ?? "18:00",
      ssee: body.ssee ?? "",
      comp: body.comp ?? "",
      desc: body.desc ?? "",
      obs: body.obs ?? "",
      re: body.re ?? "No",
      prog: body.prog ?? "",
      aviso: body.aviso ?? "",
      sodi: body.sodi ?? "",
      estado: body.estado ?? "En programación",
      fInicio: body.fInicio ?? "",
      fFin: body.fFin ?? body.fInicio ?? "",
      to1: body.to1 ?? "0",
      to2: body.to2 ?? "0",
      go1: body.go1 ?? "",
      go2: body.go2 ?? "",
      gop: body.gop ?? "",
      esSodi: body.esSodi ?? "false",
      sodiCorrelativo: body.sodiCorrelativo ?? "",
      sodiPara: body.sodiPara ?? "",
      sodiDe: body.sodiDe ?? "",
      gm: body.gm ?? "[]",
    };

    if (!payload.pt || !payload.fInicio) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios: PT y fecha." },
        { status: 400 }
      );
    }

    const cookieHeader = getOpatCookieOrThrow();

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const url =
      "https://opat.cl/agendaopat/api.php?accion=guardarUnPT&t=" +
      Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
      },
      body: formData,
      redirect: "manual",
    });

    const text = await response.text();
    const rawPreview = safeText(text).slice(0, 1200);

    let parsedJson: unknown = null;
    let parsedAsJson = false;

    try {
      parsedJson = JSON.parse(text);
      parsedAsJson = true;
    } catch {
      parsedJson = null;
    }

    const sessionProblem = looksLikeHtml(text) && looksLikeLoginPage(text);
    const explicitJsonFailure =
      parsedAsJson && detectOatFailureFromJson(parsedJson);
    const notOkHttp = !response.ok;

    const success = !notOkHttp && !sessionProblem && !explicitJsonFailure;

    return NextResponse.json(
      {
        success,
        opatHttpStatus: response.status,
        opatHttpOk: response.ok,
        parsedAsJson,
        sessionProblem,
        sent: payload,
        opatResponse: parsedJson,
        rawPreview,
        cookiePresent: Boolean(cookieHeader),
      },
      { status: success ? 200 : 500 }
    );
  } catch (error: any) {
    console.error("Error creando PT en OPAT:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo guardar el PT en OPAT.",
      },
      { status: 500 }
    );
  }
}