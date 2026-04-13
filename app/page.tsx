"use client";

import { useEffect, useMemo, useState } from "react";

type Trabajo = {
  fecha: string;
  pt: string;
  area: string;
  zonal: string;
  tipoPermiso: string;
  ssee: string;
  componente: string;
  descripcion: string;
  prog: string;
  hinicio: string;
  hfinalizacion: string;
};

type ApiResponse = {
  total?: number;
  trabajos?: Trabajo[];
  error?: string;
  details?: string;
};

type TrabajoConFecha = Trabajo & {
  fechaDate: Date;
};

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function parseDdMmYyyy(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);

  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthYear(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthMatrix(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];

  for (let i = startOffset; i > 0; i--) {
    cells.push({
      date: new Date(year, month, 1 - i),
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(year, month, day),
      inCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (startOffset + daysInMonth) + 1;
    cells.push({
      date: new Date(year, month + 1, nextDay),
      inCurrentMonth: false,
    });
  }

  return cells;
}

function shorten(text: string, max: number) {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

export default function Page() {
  const [trabajos, setTrabajos] = useState<TrabajoConFecha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewDate, setViewDate] = useState(new Date());

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

        const parsed = (data.trabajos || [])
          .map((t) => {
            const fechaDate = parseDdMmYyyy(t.fecha);
            if (!fechaDate) return null;
            return { ...t, fechaDate };
          })
          .filter((t): t is TrabajoConFecha => t !== null);

        setTrabajos(parsed);

        if (parsed.length > 0) {
          const first = parsed[0].fechaDate;
          setViewDate(new Date(first.getFullYear(), first.getMonth(), 1));
        }
      } catch (err: any) {
        setError(err?.message || "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const monthCells = useMemo(() => getMonthMatrix(viewDate), [viewDate]);

  const cellsWithJobs = useMemo(() => {
    return monthCells.map((cell) => ({
      ...cell,
      trabajos: trabajos.filter((t) => sameDay(t.fechaDate, cell.date)),
    }));
  }, [monthCells, trabajos]);

  const totalMonthJobs = useMemo(() => {
    return trabajos.filter(
      (t) =>
        t.fechaDate.getFullYear() === viewDate.getFullYear() &&
        t.fechaDate.getMonth() === viewDate.getMonth()
    ).length;
  }, [trabajos, viewDate]);

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
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Calendario CCT</h1>
            <p className="mt-1 text-sm text-slate-600">
              Lectura de columnas A hasta K desde la hoja API
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                setViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Mes anterior
            </button>

            <button
              onClick={() => {
                const now = new Date();
                setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Hoy
            </button>

            <button
              onClick={() =>
                setViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Mes siguiente →
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <div className="text-2xl font-semibold text-slate-800">
              {formatMonthYear(viewDate)}
            </div>
            <div className="text-sm text-slate-600">
              Total de trabajos del mes:{" "}
              <span className="font-semibold text-slate-800">{totalMonthJobs}</span>
            </div>
          </div>

          <div className="text-sm text-slate-600">
            Trabajos cargados:{" "}
            <span className="font-semibold text-slate-800">{trabajos.length}</span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="grid min-w-[1200px] grid-cols-7 gap-3">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="rounded-2xl bg-slate-800 px-3 py-3 text-center text-sm font-semibold text-white"
              >
                {day}
              </div>
            ))}

            {cellsWithJobs.map((cell, index) => (
              <div
                key={`${cell.date.toISOString()}-${index}`}
                className={`min-h-[220px] rounded-2xl border p-3 ${
                  cell.inCurrentMonth
                    ? "border-slate-200 bg-white"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-800">
                    {cell.date.getDate()}
                  </div>
                  <div className="text-xs text-slate-500">
                    {cell.trabajos.length > 0 ? `${cell.trabajos.length} trab.` : ""}
                  </div>
                </div>

                <div className="space-y-2">
                  {cell.trabajos.map((t, i) => (
                    <div
                      key={`${t.pt}-${i}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm"
                    >
                      <div className="text-xs font-bold text-slate-800">
                        {t.pt || "Sin PT"}
                      </div>

                      <div className="mt-1 text-xs font-semibold text-blue-700">
                        {t.ssee || "-"}
                      </div>

                      <div className="mt-1 text-xs text-slate-700">
                        {shorten(t.componente || "-", 32)}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500">
                        {shorten(t.descripcion || "-", 40)}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500">
                        {t.hinicio || "--"} a {t.hfinalizacion || "--"}
                      </div>
                    </div>
                  ))}

                  {cell.trabajos.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                      Sin trabajos
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}