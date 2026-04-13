import { NextRequest, NextResponse } from "next/server";
import { msalInstance, graphScopes, microsoftRedirectUri } from "@/lib/auth";
import { saveTokenStore } from "@/lib/token-store";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = req.cookies.get("msal_state")?.value;

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "No llegó el code de Microsoft" },
        { status: 400 }
      );
    }

    if (!state || !cookieState || state !== cookieState) {
      return NextResponse.json(
        { ok: false, error: "State inválido" },
        { status: 400 }
      );
    }

    const tokenResponse = await msalInstance.acquireTokenByCode({
      code,
      scopes: graphScopes,
      redirectUri: microsoftRedirectUri,
    });

    if (!tokenResponse?.accessToken) {
      return NextResponse.json(
        { ok: false, error: "No se obtuvo access token" },
        { status: 500 }
      );
    }

    saveTokenStore({
      accessToken: tokenResponse.accessToken,
      username: tokenResponse.account?.username || "",
      savedAt: new Date().toISOString(),
    });

    const response = NextResponse.redirect(new URL("/admin", req.url));

    response.cookies.set("is_logged_in", "true", {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.delete("msal_state");

    return response;
  } catch (error) {
    console.error("Error en callback Microsoft:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Falló el callback de Microsoft",
      },
      { status: 500 }
    );
  }
}