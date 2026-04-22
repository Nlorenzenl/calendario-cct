const SCRIPT_URL = process.env.NEXT_PUBLIC_GSHEET_SCRIPT_URL || "";

function ensureUrl() {
  if (!SCRIPT_URL) {
    throw new Error("Falta NEXT_PUBLIC_GSHEET_SCRIPT_URL en .env.local");
  }
  return SCRIPT_URL;
}

export async function gsRead(sheet: string) {
  const url = `${ensureUrl()}?sheet=${encodeURIComponent(sheet)}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`No se pudo leer la hoja ${sheet}`);
  }

  const json = await res.json();

  if (!json?.ok) {
    throw new Error(json?.error || `Error leyendo hoja ${sheet}`);
  }

  return json.data as any[][];
}

export async function gsAppend(sheet: string, row: any[]) {
  const res = await fetch(ensureUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "append",
      sheet,
      row,
    }),
  });

  if (!res.ok) {
    throw new Error(`No se pudo escribir en la hoja ${sheet}`);
  }

  const json = await res.json();

  if (!json?.ok) {
    throw new Error(json?.error || `Error escribiendo hoja ${sheet}`);
  }

  return json;
}

export async function gsReplaceAll(
  sheet: string,
  headers: any[],
  rows: any[][]
) {
  const res = await fetch(ensureUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "replaceAll",
      sheet,
      headers,
      rows,
    }),
  });

  if (!res.ok) {
    throw new Error(`No se pudo reemplazar la hoja ${sheet}`);
  }

  const json = await res.json();

  if (!json?.ok) {
    throw new Error(json?.error || `Error reemplazando hoja ${sheet}`);
  }

  return json;
}

export function makeId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}