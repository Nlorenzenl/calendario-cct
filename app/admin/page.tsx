"use client";

import { useEffect, useState } from "react";

type SessionStatus = {
  ok: boolean;
  connected: boolean;
  username: string;
  savedAt: string;
};

export default function AdminPage() {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    try {
      setLoading(true);
      const res = await fetch("/api/session/status", { cache: "no-store" });
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-slate-800">
          Administración Calendario CCT
        </h1>

        <p className="mt-3 text-slate-600">
          Aquí conectas la cuenta técnica de Outlook que será dueña del Excel.
        </p>

        <div className="mt-8 rounded-xl border p-6">
          {loading ? (
            <p className="text-slate-600">Revisando estado de conexión...</p>
          ) : status?.connected ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-green-700">
                Cuenta técnica conectada
              </p>
              <p className="text-slate-700">
                Usuario: <strong>{status.username || "Sin nombre"}</strong>
              </p>
              <p className="text-slate-700">
                Guardado: <strong>{status.savedAt || "-"}</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-lg font-semibold text-amber-700">
                No hay cuenta técnica conectada
              </p>

              <a
                href="/api/auth/login"
                className="inline-block rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
              >
                Conectar cuenta Microsoft
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}