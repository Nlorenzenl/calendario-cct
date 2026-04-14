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

export default function Page() {
  const [data, setData] = useState<OpatTrabajo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al cargar los datos desde OPAT");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const trabajos = useMemo(() => {
    return data.map((item, index) => ({
      id: `${item.pt || "sin-pt"}-${item.fInicio || "sin-fecha"}-${index}`,
      fecha: item.fInicio || "",
      pt: item.pt || "",
      subestacion: item.ssee || "",
      componente: item.comp || "",
      actividad: item.desc || "",
      estado: item.estado || "",
      horaInicio: item.inicio || "",
      horaFin: item.fin || "",
    }));
  }, [data]);

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={cargarOPAT}
          disabled={loading}
          style={{
            background: "#0f62fe",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {loading ? "Cargando..." : "Cargar OPAT"}
        </button>

        <div style={{ fontSize: 14, color: "#444" }}>
          Trabajos cargados: <strong>{trabajos.length}</strong>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: "#ffe5e5",
            color: "#a40000",
            border: "1px solid #ffb3b3",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && trabajos.length === 0 && (
        <div
          style={{
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          Presiona <strong>Cargar OPAT</strong> para traer los trabajos.
        </div>
      )}

      {trabajos.length > 0 && (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 900,
            }}
          >
            <thead>
              <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>PT</th>
                <th style={thStyle}>Hora Inicio</th>
                <th style={thStyle}>Hora Fin</th>
                <th style={thStyle}>Subestación</th>
                <th style={thStyle}>Componente</th>
                <th style={thStyle}>Actividad</th>
                <th style={thStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {trabajos.map((trabajo) => (
                <tr key={trabajo.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={tdStyle}>{trabajo.fecha || "-"}</td>
                  <td style={tdStyle}>{trabajo.pt || "-"}</td>
                  <td style={tdStyle}>{trabajo.horaInicio || "-"}</td>
                  <td style={tdStyle}>{trabajo.horaFin || "-"}</td>
                  <td style={tdStyle}>{trabajo.subestacion || "-"}</td>
                  <td style={tdStyle}>{trabajo.componente || "-"}</td>
                  <td style={tdStyle}>{trabajo.actividad || "-"}</td>
                  <td style={tdStyle}>{trabajo.estado || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 700,
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  verticalAlign: "top",
};