"use client";

import { useEffect, useMemo, useState } from "react";

type ExcelJob = {
  fecha: string;
  pt: string;
  area: string;
  zonal: string;
  tipoPermiso: string;
  sseeOLT: string;
  componente: string;
  descripcion: string;
  prog: string;
  inicio: string;
  finalizacion: string;
};

type JobsResponse = {
  ok: boolean;
  totalJobs: number;
  jobs: ExcelJob[];
  error?: string;
};

type CalendarJob = ExcelJob & {
  id: string;
  dateObj: Date;
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

function parseDdMmYyyyToDate(value: string): Date | null {
  const clean = String(value || "").trim();
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

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

function formatMonthYear(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthMatrix(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // lunes=0
  const daysInMonth = lastDayOfMonth.getDate();

  const cells: Array<{
    date: Date;
    inCurrentMonth: boolean;
  }> = [];

  for (let i = startOffset; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    cells.push({ date: d, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(year, month, day),
      inCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const nextIndex = cells.length - (startOffset + daysInMonth) + 1;
    const d = new Date(year, month + 1, nextIndex);
    cells.push({ date: d, inCurrentMonth: false });
  }

  return cells;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function shortenText(text: string, max = 42) {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

export default function Home() {
  const [jobs, setJobs] = useState<CalendarJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewDate, setViewDate] = useState(() => new Date());

  useEffect(() => {
    async function loadJobs() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/excel/jobs", {
          cache: "no-store",
        });

        const data: JobsResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "No se pudieron cargar los trabajos");
        }

        const parsedJobs: CalendarJob[] = (data.jobs || [])
          .map((job, index) => {
            const dateObj = parseDdMmYyyyToDate(job.fecha);

            if (!dateObj) return null;

            return {
              ...job,
              id: `${job.fecha}-${job.pt || "sin-pt"}-${job.sseeOLT}-${index}`,
              dateObj,
            };
          })
          .filter(Boolean) as CalendarJob[];

        setJobs(parsedJobs);

        if (parsedJobs.length > 0) {
          const firstDate = parsedJobs[0].dateObj;
          setViewDate(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Error cargando trabajos");
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, []);

  const monthCells = useMemo(() => getMonthMatrix(viewDate), [viewDate]);

  const jobsByDay = useMemo(() => {
    return monthCells.map((cell) => ({
      ...cell,
      jobs: jobs.filter((job) => sameDay(job.dateObj, cell.date)),
    }));
  }, [monthCells, jobs]);

  const totalMonthJobs = useMemo(() => {
    return jobs.filter(
      (job) =>
        job.dateObj.getFullYear() === viewDate.getFullYear() &&
        job.dateObj.getMonth() === viewDate.getMonth()
    ).length;
  }, [jobs, viewDate]);

  function goPrevMonth() {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }

  function goNextMonth() {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }

  function goToday() {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Calendario CCT
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Trabajos programados del Excel compartido
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={goPrevMonth}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Mes anterior
              </button>

              <button
                onClick={goToday}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Hoy
              </button>

              <button
                onClick={goNextMonth}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Mes siguiente →
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-2xl font-semibold text-slate-800">
                {formatMonthYear(viewDate)}
              </div>
              <div className="text-sm text-slate-600">
                Total de trabajos del mes:{" "}
                <span className="font-semibold text-slate-800">
                  {totalMonthJobs}
                </span>
              </div>
            </div>

            <div className="text-sm text-slate-600">
              Trabajos cargados:{" "}
              <span className="font-semibold text-slate-800">
                {jobs.length}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              Cargando trabajos desde Excel...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              {error}
            </div>
          ) : (
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

                {jobsByDay.map((cell, index) => {
                  const isToday = sameDay(cell.date, new Date());

                  return (
                    <div
                      key={`${cell.date.toISOString()}-${index}`}
                      className={`min-h-[210px] rounded-2xl border p-3 ${
                        cell.inCurrentMonth
                          ? "border-slate-200 bg-white"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            isToday
                              ? "bg-blue-600 text-white"
                              : cell.inCurrentMonth
                              ? "bg-slate-100 text-slate-800"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {cell.date.getDate()}
                        </div>

                        <div className="text-xs text-slate-500">
                          {cell.jobs.length > 0 ? `${cell.jobs.length} trab.` : ""}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {cell.jobs.map((job) => (
                          <div
                            key={job.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm"
                            title={`${job.sseeOLT} | ${job.componente} | ${job.descripcion}`}
                          >
                            <div className="text-xs font-bold text-slate-800">
                              {job.pt || "Sin PT"}
                            </div>

                            <div className="mt-1 text-xs font-semibold text-blue-700">
                              {job.sseeOLT || "-"}
                            </div>

                            <div className="mt-1 text-xs text-slate-700">
                              {shortenText(job.componente || "-", 34)}
                            </div>

                            <div className="mt-1 text-[11px] text-slate-500">
                              {shortenText(job.descripcion || "-", 42)}
                            </div>

                            <div className="mt-2 text-[11px] text-slate-500">
                              {job.inicio || "--"} a {job.finalizacion || "--"}
                            </div>
                          </div>
                        ))}

                        {cell.jobs.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                            Sin trabajos
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}