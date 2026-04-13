"use client";

import { useEffect, useState } from "react";

type Trabajo = {
  fecha: string;
  pt: string;
  ssee: string;
  descripcion: string;
};

type ApiResponse = {
  total?: number;
  trabajos?: Trabajo[];
  error?: string;
  details?: string;
};

export default function Page() {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/excel", { cache: "no-store" });
        const data: ApiResponse = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.details || data.error || "Error cargando datos");
        }

        setTrabajos(data.trabajos || []);
      } catch (err: any) {
        setError(err?.message || "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const agrupados = trabajos.reduce<Record<string, Trabajo[]>>((acc, trabajo) => {
    if (!acc[trabajo.fecha]) acc[trabajo.fecha] = [];
    acc[trabajo.fecha].push(trabajo);
    return acc;
  }, {});

  if (loading) {
    return <div className="p-10">Cargando...</div>;
  }

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold mb-4">Calendario CCT</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Calendario CCT</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {Object.entries(agrupados).map(([fecha, items]) => (
          <div key={fecha} className="border rounded-xl p-3 bg-white">
            <div className="font-bold text-sm mb-2">{fecha}</div>

            {items.map((t, i) => (
              <div key={i} className="text-xs mt-2 p-2 bg-slate-100 rounded">
                <div className="font-semibold">{t.pt}</div>
                <div>{t.ssee}</div>
                <div className="text-slate-500">{t.descripcion}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}