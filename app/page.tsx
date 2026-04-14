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

export default function Page() {
  const [data, setData] = useState<OpatTrabajo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

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

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Calendario CCT · Agenda OPAT</h1>
          <p style={styles.subtitle}>
            Vista inicial de trabajos traídos desde OPAT
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

      {trabajos.length > 0 && (
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
                          background:
                            trabajo.estado === "Autorizado"
                              ? "#e8fff1"
                              : trabajo.estado === "Suspendido"
                              ? "#fff0f0"
                              : "#eef2ff",
                          color:
                            trabajo.estado === "Autorizado"
                              ? "#0f8a43"
                              : trabajo.estado === "Suspendido"
                              ? "#b42318"
                              : "#334155",
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
    justifyContent: "flex-end",
    marginTop: 14,
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