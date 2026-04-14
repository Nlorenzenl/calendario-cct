import { NextRequest, NextResponse } from "next/server";

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

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    const url =
      "https://opat.cl/operaciones_sts/api.php?accion=guardarUnPT&t=" +
      Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
      body: formData,
    });

    const text = await response.text();

    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return NextResponse.json({
      success: true,
      opatResponse: json,
      sent: payload,
    });
  } catch (error) {
    console.error("Error creando PT en OPAT:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo guardar el PT en OPAT." },
      { status: 500 }
    );
  }
}