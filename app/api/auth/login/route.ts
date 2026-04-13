import { NextResponse } from "next/server";
import crypto from "crypto";
import { msalInstance, graphScopes, microsoftRedirectUri } from "@/lib/auth";

export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString("hex");

    const authCodeUrlParameters = {
      scopes: graphScopes,
      redirectUri: microsoftRedirectUri,
      state,
    };

    const authUrl = await msalInstance.getAuthCodeUrl(authCodeUrlParameters);

    const response = NextResponse.redirect(authUrl);

    response.cookies.set("msal_state", state, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error("Error en login Microsoft:", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo iniciar el login con Microsoft" },
      { status: 500 }
    );
  }
}