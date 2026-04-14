"use client";

import { useMemo, useState } from "react";

type OpatTrabajo = {
  pt: string;
  area?: string;
  tipo?: string;
  inicio?: string;
  fin?: string;
  ssee?: string;
  comp?: string;
  desc?: string;
  obs?: string;
  re?: string;
  prog?: string;
  aviso?: string;
  sodi?: string;
  estado?: string;
  fInicio?: string;
  fFin?: string;
};

type TrabajoUI = {
  id: string;
  fecha: string;
  pt: string;
  horaInicio: string;
  horaFin: string;
  subestacion: string;
  componente: string;
  actividad: string;
  estado: string;
  tipo: string;
  observacion: string;
  programador: string;
  area: string;
};

type CalendarDay = {
  date: Date;
  iso: string;
  inMonth: boolean;
};

function truncate(text: string, max = 90) {
  if (!text) return "-";
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}

function normalizeText(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compareDateTime(a: TrabajoUI, b: TrabajoUI) {
  const aKey = `${a.fecha} ${a.horaInicio || "00:00"}`;
  const bKey = `${b.fecha} ${b.horaInicio || "00:00"}`;
  return aKey.localeCompare(bKey);
}

function toLocalDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODateLocal(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}

function buildMonthGrid(monthDate: Date): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startWeekDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const days: CalendarDay[] = [];

  for (let i = startWeekDay; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    days.push({
      date: d,
      iso: toLocalDateInputValue(d),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    days.push({
      date: d,
      iso: toLocalDateInputValue(d),
      inMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    const nextIndex = days.length - (startWeekDay + daysInMonth) + 1;
    const d = new Date(year, month + 1, nextIndex);
    days.push({
      date: d,
      iso: toLocalDateInputValue(d),
      inMonth: false,
    });
  }

  return days;
}

function estadoColor(estado: string) {
  if (estado === "Autorizado") {
    return {
      background: "#e8fff1",
      color: "#0f8a43",
      border: "#b7ebc6",
    };
  }

  if (estado === "Suspendido") {
    return {
      background: "#fff0f0",
      color: "#b42318",
      border: "#f5c2c7",
    };
  }

  return {
    background: "#eef2ff",
    color: "#334155",
    border: "#c7d2fe",
  };
}

export default function Page() {
  const [data, setData] = useState<OpatTrabajo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"tabla" | "calendario">("calendario");

  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const cargarOPAT = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/opat", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("No se pudo obtener la agenda desde OPAT");
      }

      const json = await res.json();

      if (!Array.isArray(json)) {
        throw new Error("La respuesta de OPAT no tiene el formato esperado");
      }

      setData(json);
      setSelectedId("");

      const fechasValidas = json
        .map((item: OpatTrabajo) => item.fInicio)
        .filter(Boolean)
        .sort();

      if (fechasValidas.length > 0) {
        const first = parseISODateLocal(fechasValidas[0] as string);
        setMonthCursor(new Date(first.getFullYear(), first.getMonth(), 1));
      }
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al cargar los datos desde OPAT");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const trabajos = useMemo<TrabajoUI[]>(() => {
    return data
      .map((item, index) => ({
        id: `${item.pt || "sin-pt"}-${item.fInicio || "sin-fecha"}-${index}`,
        fecha: item.fInicio || "",
        pt: item.pt || "",
        horaInicio: item.inicio || "",
        horaFin: item.fin || "",
        subestacion: item.ssee || "",
        componente: item.comp || "",
        actividad: item.desc || "",
        estado: item.estado || "",
        tipo: item.tipo || "",
        observacion: item.obs || "",
        programador: item.prog || "",
        area: item.area || "",
      }))
      .sort(compareDateTime);
  }, [data]);

  const estadosDisponibles = useMemo(() => {
    const únicos = Array.from(
      new Set(trabajos.map((t) => t.estado).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return únicos;
  }, [trabajos]);

  const trabajosFiltrados = useMemo(() => {
    const q = normalizeText(busqueda);

    return trabajos.filter((t) => {
      if (filtroFechaInicio && t.fecha && t.fecha < filtroFechaInicio) {
        return false;
      }

      if (filtroFechaFin && t.fecha && t.fecha > filtroFechaFin) {
        return false;
      }

      if (filtroEstado !== "todos" && t.estado !== filtroEstado) {
        return false;
      }

      if (q) {
        const textoCompleto = normalizeText(
          [
            t.pt,
            t.subestacion,
            t.componente,
            t.actividad,
            t.estado,
            t.tipo,
            t.programador,
          ].join(" ")
        );

        if (!textoCompleto.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [trabajos, filtroFechaInicio, filtroFechaFin, filtroEstado, busqueda]);

  const trabajoSeleccionado =
    trabajosFiltrados.find((t) => t.id === selectedId) || null;

  const limpiarFiltros = () => {
    setFiltroFechaInicio("");
    setFiltroFechaFin("");
    setFiltroEstado("todos");
    setBusqueda("");
  };

  const trabajosPorFecha = useMemo(() => {
    const map = new Map<string, TrabajoUI[]>();
    for (const t of trabajosFiltrados) {
      if (!t.fecha) continue;
      if (!map.has(t.fecha)) {
        map.set(t.fecha, []);
      }
      map.get(t.fecha)!.push(t);
    }
    return map;
  }, [trabajosFiltrados]);

  const diasMes = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  const cambiarMes = (delta: number) => {
    setMonthCursor(
      new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1)
    );
  };

  const irHoy = () => {
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const trabajosMesActual = useMemo(() => {
    const ym = `${monthCursor.getFullYear()}-${String(
      monthCursor.getMonth() + 1
    ).padStart(2, "0")}`;
    return trabajosFiltrados.filter((t) => t.fecha.startsWith(ym));
  }, [trabajosFiltrados, monthCursor]);

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Calendario CCT · Agenda OPAT</h1>
          <p style={styles.subtitle}>
            Vista mensual operativa basada en trabajos traídos desde OPAT
          </p>
        </div>

        <button
          onClick={cargarOPAT}
          disabled={loading}
          style={{
            ...styles.primaryButton,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Cargando..." : "Cargar OPAT"}
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total cargados</span>
          <strong style={styles.summaryValue}>{trabajos.length}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Mostrados</span>
          <strong style={styles.summaryValue}>{trabajosFiltrados.length}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>En mes visible</span>
          <strong style={styles.summaryValue}>{trabajosMesActual.length}</strong>
        </div>
      </div>

      <div style={styles.filtersBox}>
        <div style={styles.filtersGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Fecha inicio</label>
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Fecha fin</label>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={styles.input}
            >
              <option value="todos">Todos</option>
              {estadosDisponibles.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Buscar</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="PT, subestación, componente, actividad..."
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.actionsRow}>
          <div style={styles.segmented}>
            <button
              onClick={() => setVista("calendario")}
              style={{
                ...styles.segmentButton,
                ...(vista === "calendario" ? styles.segmentButtonActive : {}),
              }}
            >
              Calendario
            </button>
            <button
              onClick={() => setVista("tabla")}
              style={{
                ...styles.segmentButton,
                ...(vista === "tabla" ? styles.segmentButtonActive : {}),
              }}
            >
              Tabla
            </button>
          </div>

          <button onClick={limpiarFiltros} style={styles.secondaryButton}>
            Limpiar filtros
          </button>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {!loading && !error && trabajos.length === 0 && (
        <div style={styles.emptyBox}>
          Presiona <strong>Cargar OPAT</strong> para traer la agenda.
        </div>
      )}

      {trabajos.length > 0 && vista === "calendario" && (
        <>
          <div style={styles.calendarToolbar}>
            <div style={styles.calendarNav}>
              <button onClick={() => cambiarMes(-1)} style={styles.secondaryButton}>
                ← Mes anterior
              </button>
              <button onClick={irHoy} style={styles.secondaryButton}>
                Mes actual
              </button>
              <button onClick={() => cambiarMes(1)} style={styles.secondaryButton}>
                Mes siguiente →
              </button>
            </div>

            <div style={styles.calendarTitle}>
              {formatMonthLabel(monthCursor)}
            </div>
          </div>

          <div style={styles.calendarWrap}>
            <div style={styles.weekHeader}>Lun</div>
            <div style={styles.weekHeader}>Mar</div>
            <div style={styles.weekHeader}>Mié</div>
            <div style={styles.weekHeader}>Jue</div>
            <div style={styles.weekHeader}>Vie</div>
            <div style={styles.weekHeader}>Sáb</div>
            <div style={styles.weekHeader}>Dom</div>

            {diasMes.map((day) => {
              const items = trabajosPorFecha.get(day.iso) || [];
              const isToday = day.iso === toLocalDateInputValue(today);

              return (
                <div
                  key={day.iso}
                  style={{
                    ...styles.dayCell,
                    background: day.inMonth ? "#fff" : "#f8fafc",
                    opacity: day.inMonth ? 1 : 0.65,
                    borderColor: isToday ? "#3b82f6" : "#e2e8f0",
                  }}
                >
                  <div style={styles.dayHeader}>
                    <span
                      style={{
                        ...styles.dayNumber,
                        background: isToday ? "#dbeafe" : "transparent",
                        color: isToday ? "#1d4ed8" : "#0f172a",
                      }}
                    >
                      {day.date.getDate()}
                    </span>
                    {items.length > 0 && (
                      <span style={styles.dayCount}>{items.length}</span>
                    )}
                  </div>

                  <div style={styles.dayItems}>
                    {items.slice(0, 4).map((trabajo) => {
                      const colors = estadoColor(trabajo.estado);

                      return (
                        <button
                          key={trabajo.id}
                          onClick={() => setSelectedId(trabajo.id)}
                          style={{
                            ...styles.eventCard,
                            background: colors.background,
                            color: colors.color,
                            border: `1px solid ${colors.border}`,
                          }}
                          title={`${trabajo.pt} · ${trabajo.subestacion} · ${trabajo.componente}`}
                        >
                          <div style={styles.eventTime}>
                            {trabajo.horaInicio || "--:--"}
                          </div>
                          <div style={styles.eventPt}>{trabajo.pt || "Sin PT"}</div>
                          <div style={styles.eventSub}>
                            {trabajo.subestacion || trabajo.componente || "-"}
                          </div>
                        </button>
                      );
                    })}

                    {items.length > 4 && (
                      <div style={styles.moreItems}>
                        +{items.length - 4} trabajo(s) más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {trabajos.length > 0 && vista === "tabla" && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>PT</th>
                <th style={styles.th}>Hora</th>
                <th style={styles.th}>Subestación</th>
                <th style={styles.th}>Componente</th>
                <th style={styles.th}>Actividad</th>
                <th style={styles.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {trabajosFiltrados.map((trabajo) => {
                const selected = trabajo.id === selectedId;

                return (
                  <tr
                    key={trabajo.id}
                    onClick={() => setSelectedId(trabajo.id)}
                    style={{
                      ...styles.tr,
                      background: selected ? "#eef4ff" : "#fff",
                      cursor: "pointer",
                    }}
                    title="Haz clic para ver detalle"
                  >
                    <td style={styles.td}>{trabajo.fecha || "-"}</td>
                    <td style={styles.td}>{trabajo.pt || "-"}</td>
                    <td style={styles.td}>
                      {trabajo.horaInicio || "-"}{" "}
                      {trabajo.horaFin ? `- ${trabajo.horaFin}` : ""}
                    </td>
                    <td style={styles.td}>{trabajo.subestacion || "-"}</td>
                    <td style={styles.td}>{trabajo.componente || "-"}</td>
                    <td style={styles.td} title={trabajo.actividad || "-"}>
                      {truncate(trabajo.actividad, 85)}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.estadoChip,
                          background: estadoColor(trabajo.estado).background,
                          color: estadoColor(trabajo.estado).color,
                        }}
                      >
                        {trabajo.estado || "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {trabajosFiltrados.length === 0 && (
            <div style={styles.emptyInner}>
              No hay trabajos que coincidan con los filtros.
            </div>
          )}
        </div>
      )}

      {trabajoSeleccionado && (
        <div style={styles.detailBox}>
          <h2 style={styles.detailTitle}>Detalle del trabajo</h2>

          <div style={styles.detailGrid}>
            <DetailItem label="Fecha" value={trabajoSeleccionado.fecha} />
            <DetailItem label="PT" value={trabajoSeleccionado.pt} />
            <DetailItem
              label="Hora inicio"
              value={trabajoSeleccionado.horaInicio}
            />
            <DetailItem label="Hora fin" value={trabajoSeleccionado.horaFin} />
            <DetailItem
              label="Subestación"
              value={trabajoSeleccionado.subestacion}
            />
            <DetailItem
              label="Componente"
              value={trabajoSeleccionado.componente}
            />
            <DetailItem label="Estado" value={trabajoSeleccionado.estado} />
            <DetailItem label="Tipo" value={trabajoSeleccionado.tipo} />
            <DetailItem
              label="Programador"
              value={trabajoSeleccionado.programador}
            />
            <DetailItem label="Área" value={trabajoSeleccionado.area} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={styles.detailBlock}>
              <div style={styles.detailBlockLabel}>Actividad</div>
              <div style={styles.detailBlockValue}>
                {trabajoSeleccionado.actividad || "-"}
              </div>
            </div>

            <div style={styles.detailBlock}>
              <div style={styles.detailBlockLabel}>Observación</div>
              <div style={styles.detailBlockValue}>
                {trabajoSeleccionado.observacion || "-"}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.detailItem}>
      <div style={styles.detailItemLabel}>{label}</div>
      <div style={styles.detailItemValue}>{value || "-"}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    fontFamily: "Arial, sans-serif",
    background: "#f8fafc",
    minHeight: "100vh",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
  },
  subtitle: {
    margin: "6px 0 0 0",
    color: "#475569",
    fontSize: 14,
  },
  primaryButton: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 18px",
    fontSize: 14,
    fontWeight: 700,
  },
  secondaryButton: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  summaryRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  summaryCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "12px 16px",
    minWidth: 140,
  },
  summaryLabel: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
  },
  filtersBox: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  },
  input: {
    height: 42,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  actionsRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    flexWrap: "wrap",
    alignItems: "center",
  },
  segmented: {
    display: "inline-flex",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
  },
  segmentButton: {
    padding: "10px 14px",
    border: "none",
    background: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  segmentButtonActive: {
    background: "#2563eb",
    color: "#fff",
  },
  errorBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    background: "#fff1f2",
    color: "#b42318",
    border: "1px solid #fecdd3",
  },
  emptyBox: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
  },
  calendarToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  calendarNav: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  calendarTitle: {
    fontSize: 24,
    fontWeight: 800,
    textTransform: "capitalize",
  },
  calendarWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    overflow: "hidden",
    background: "#fff",
  },
  weekHeader: {
    padding: "12px 10px",
    background: "#f1f5f9",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
    fontWeight: 800,
    textAlign: "center",
  },
  dayCell: {
    minHeight: 170,
    borderRight: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 800,
    borderRadius: 999,
    padding: "4px 8px",
  },
  dayCount: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    background: "#e2e8f0",
    borderRadius: 999,
    padding: "2px 8px",
  },
  dayItems: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  eventCard: {
    width: "100%",
    textAlign: "left",
    borderRadius: 10,
    padding: 8,
    cursor: "pointer",
    fontSize: 12,
  },
  eventTime: {
    fontWeight: 800,
    marginBottom: 4,
  },
  eventPt: {
    fontWeight: 700,
    marginBottom: 2,
    wordBreak: "break-word",
  },
  eventSub: {
    fontSize: 11,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  moreItems: {
    fontSize: 12,
    color: "#64748b",
    padding: "2px 4px",
    fontWeight: 700,
  },
  tableWrap: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    overflow: "hidden",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1100,
  },
  tableHeadRow: {
    background: "#f8fafc",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: 13,
    fontWeight: 700,
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  tr: {
    borderTop: "1px solid #eef2f7",
  },
  td: {
    padding: "13px 16px",
    fontSize: 13,
    verticalAlign: "top",
    lineHeight: 1.4,
  },
  estadoChip: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  emptyInner: {
    padding: 18,
    fontSize: 14,
    color: "#64748b",
  },
  detailBox: {
    marginTop: 18,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 18,
  },
  detailTitle: {
    margin: "0 0 14px 0",
    fontSize: 20,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  detailItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    background: "#f8fafc",
  },
  detailItemLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
    fontWeight: 700,
  },
  detailItemValue: {
    fontSize: 14,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  detailBlock: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    background: "#f8fafc",
    marginTop: 12,
  },
  detailBlockLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    marginBottom: 8,
  },
  detailBlockValue: {
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
};