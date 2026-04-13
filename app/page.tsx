"use client";

import { useEffect, useState } from "react";

type Trabajo = {
  fecha: string;
  pt: string;
  ssee: string;
  descripcion: string;
};

export default function Page() {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/excel")
      .then((res) => res.json())
      .then((data) => {
        setTrabajos(data.trabajos);
        setLoading(false);
      });
  }, []);

  const agruparPorDia = () => {
    const mapa: Record<string, Trabajo[]> = {};

    trabajos.forEach((t) => {
      const fecha = new Date(t.fecha).toISOString().split("T")[0];

      if (!mapa[fecha]) mapa[fecha] = [];
      mapa[fecha].push(t);
    });

    return mapa;
  };

  const data = agruparPorDia();

  if (loading) return <div className="p-10">Cargando...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Calendario CCT
      </h1>

      <div className="grid grid-cols-7 gap-3">
        {Object.entries(data).map(([fecha, trabajos]) => (
          <div
            key={fecha}
            className="border rounded-xl p-2"
          >
            <div className="font-bold text-sm">
              {fecha}
            </div>

            {trabajos.map((t, i) => (
              <div
                key={i}
                className="text-xs mt-1 p-1 bg-slate-100 rounded"
              >
                <div className="font-semibold">{t.pt}</div>
                <div>{t.ssee}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}