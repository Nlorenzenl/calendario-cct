import { NextRequest, NextResponse } from "next/server";
import { getOpatCookieOrThrow } from "@/lib/opat-session";

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
    const body = await req.json();

    if (!body?.pt || !body?.fInicio || !body?.fFin) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos obligatorios para actualizar el PT.",
        },
        { status: 400 }
      );
    }

    const cookieHeader = getOpatCookieOrThrow();

    const formData = new FormData();
    formData.append("data", JSON.stringify(body));

    const url =
      "https://opat.cl/operaciones_sts/api.php?accion=guardarUnPT&t=" +
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
        sent: body,
        opatResponse: parsedJson,
        rawPreview,
        cookiePresent: Boolean(cookieHeader),
      },
      { status: success ? 200 : 500 }
    );
  } catch (error: any) {
    console.error("Error actualizando PT en OPAT:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo actualizar el PT en OPAT.",
      },
      { status: 500 }
    );
  }
}