"use client";

import { useEffect, useMemo, useState } from "react";

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
  to1?: string;
  to2?: string;
  go1?: string;
  go2?: string;
  gop?: string;
  esSodi?: string;
  sodiCorrelativo?: string;
  sodiPara?: string;
  sodiDe?: string;
  gm?: string;
};

type TrabajoUI = {
  id: string;
  original: OpatTrabajo;
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
  aviso: string;
  sodi: string;
};

type CalendarDay = {
  date: Date;
  iso: string;
  inMonth: boolean;
};

type NewPTForm = {
  pt: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  subestacion: string;
  componente: string;
  actividad: string;
  observacion: string;
  estado: string;
  tipo: string;
  programador: string;
  area: string;
};

type EditPTForm = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  subestacion: string;
  componente: string;
  actividad: string;
  observacion: string;
  estado: string;
  tipo: string;
  programador: string;
  aviso: string;
  sodi: string;
};

type HistoryItem = {
  id: string;
  tipo: "reprogramacion" | "suspension";
  pt: string;
  fechaOrigen: string;
  fechaDestino: string;
  motivo: string;
  timestamp: string;
};

type ToastState = {
  visible: boolean;
  message: string;
};

function truncate(text: string, max = 90) {
  if (!text) return "-";
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}

function truncateSoft(text: string, max = 28) {
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

function formatTimestamp(date: Date) {
  return date.toLocaleString("es-CL");
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
      background: "#edfdf3",
      color: "#0f8a43",
      border: "#b7ebc6",
    };
  }

  if (estado === "Suspendido") {
    return {
      background: "#fff1f1",
      color: "#b42318",
      border: "#f3c4c4",
    };
  }

  return {
    background: "#f3f6ff",
    color: "#334155",
    border: "#cdd7ff",
  };
}

function emptyNewPTForm(fecha = ""): NewPTForm {
  return {
    pt: "",
    fecha,
    horaInicio: "08:00",
    horaFin: "18:00",
    subestacion: "",
    componente: "",
    actividad: "",
    observacion: "",
    estado: "En programación",
    tipo: "DESCONEXIÓN",
    programador: "",
    area: "",
  };
}

function buildEditForm(trabajo: TrabajoUI): EditPTForm {
  return {
    fecha: trabajo.fecha,
    horaInicio: trabajo.horaInicio || "08:00",
    horaFin: trabajo.horaFin || "18:00",
    subestacion: trabajo.subestacion || "",
    componente: trabajo.componente || "",
    actividad: trabajo.actividad || "",
    observacion: trabajo.observacion || "",
    estado: trabajo.estado || "En programación",
    tipo: trabajo.tipo || "DESCONEXIÓN",
    programador: trabajo.programador || "",
    aviso: trabajo.aviso || "",
    sodi: trabajo.sodi || "",
  };
}

export default function Page() {
  const [data, setData] = useState<OpatTrabajo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [updatingDetail, setUpdatingDetail] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"calendario" | "tabla" | "historial">(
    "calendario"
  );

  const [newPTOpen, setNewPTOpen] = useState(false);
  const [newPTForm, setNewPTForm] = useState<NewPTForm>(emptyNewPTForm());
  const [newPTError, setNewPTError] = useState("");

  const [editForm, setEditForm] = useState<EditPTForm | null>(null);
  const [editError, setEditError] = useState("");

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
  });

  const [historial, setHistorial] = useState<HistoryItem[]>([]);

  const [draggingId, setDraggingId] = useState<string>("");
  const [dropTargetDate, setDropTargetDate] = useState<string>("");
  const [moveReasonOpen, setMoveReasonOpen] = useState(false);
  const [moveReason, setMoveReason] = useState("");
  const [moveReasonError, setMoveReasonError] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    trabajoId: string;
    fromDate: string;
    toDate: string;
  } | null>(null);

  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast({ visible: false, message: "" });
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const mostrarToast = (message: string) => {
    setToast({ visible: true, message });
  };

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

      const actual = new Date();
      setMonthCursor(new Date(actual.getFullYear(), actual.getMonth(), 1));
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
        original: item,
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
        aviso: item.aviso || "",
        sodi: item.sodi || "",
      }))
      .sort(compareDateTime);
  }, [data]);

  const trabajosFiltrados = useMemo(() => {
    const q = normalizeText(busqueda);

    return trabajos.filter((t) => {
      if (!q) return true;

      const textoCompleto = normalizeText(
        [
          t.pt,
          t.subestacion,
          t.componente,
          t.actividad,
          t.estado,
          t.tipo,
          t.programador,
          t.aviso,
          t.sodi,
        ].join(" ")
      );

      return textoCompleto.includes(q);
    });
  }, [trabajos, busqueda]);

  const trabajoSeleccionado =
    trabajosFiltrados.find((t) => t.id === selectedId) ||
    trabajos.find((t) => t.id === selectedId) ||
    null;

  useEffect(() => {
    if (trabajoSeleccionado) {
      setEditForm(buildEditForm(trabajoSeleccionado));
      setEditError("");
    } else {
      setEditForm(null);
      setEditError("");
    }
  }, [selectedId, trabajoSeleccionado?.id]);

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

  const limpiarBusqueda = () => {
    setBusqueda("");
  };

  const cerrarModal = () => {
    setSelectedId("");
  };

  const abrirNuevoPT = (fecha: string) => {
    setNewPTError("");
    setNewPTForm(emptyNewPTForm(fecha));
    setNewPTOpen(true);
  };

  const cerrarNuevoPT = () => {
    if (saving) return;
    setNewPTOpen(false);
    setNewPTError("");
  };

  const updateNewPTField = (field: keyof NewPTForm, value: string) => {
    setNewPTForm((prev) => ({ ...prev, [field]: value }));
  };

  const guardarNuevoPT = async () => {
    try {
      setNewPTError("");

      if (!newPTForm.pt.trim()) {
        setNewPTError("Debes ingresar el PT.");
        return;
      }

      if (!newPTForm.fecha) {
        setNewPTError("Debes ingresar la fecha.");
        return;
      }

      setSaving(true);

      const payload = {
        pt: newPTForm.pt.trim(),
        area: newPTForm.area.trim(),
        tipo: newPTForm.tipo,
        inicio: newPTForm.horaInicio,
        fin: newPTForm.horaFin,
        ssee: newPTForm.subestacion.trim(),
        comp: newPTForm.componente.trim(),
        desc: newPTForm.actividad.trim(),
        obs: newPTForm.observacion.trim(),
        re: "No",
        prog: newPTForm.programador.trim(),
        aviso: "",
        sodi: "",
        estado: newPTForm.estado,
        fInicio: newPTForm.fecha,
        fFin: newPTForm.fecha,
        to1: "0",
        to2: "0",
        go1: "",
        go2: "",
        gop: "",
        esSodi: "false",
        sodiCorrelativo: "",
        sodiPara: "",
        sodiDe: "",
        gm: "[]",
      };

      const res = await fetch("/api/opat/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "No se pudo guardar el PT.");
      }

      setData((prev) => [
        {
          pt: payload.pt,
          area: payload.area,
          tipo: payload.tipo,
          inicio: payload.inicio,
          fin: payload.fin,
          ssee: payload.ssee,
          comp: payload.comp,
          desc: payload.desc,
          obs: payload.obs,
          re: payload.re,
          prog: payload.prog,
          aviso: payload.aviso,
          sodi: payload.sodi,
          estado: payload.estado,
          fInicio: payload.fInicio,
          fFin: payload.fFin,
          to1: payload.to1,
          to2: payload.to2,
          go1: payload.go1,
          go2: payload.go2,
          gop: payload.gop,
          esSodi: payload.esSodi,
          sodiCorrelativo: payload.sodiCorrelativo,
          sodiPara: payload.sodiPara,
          sodiDe: payload.sodiDe,
          gm: payload.gm,
        },
        ...prev,
      ]);

      setNewPTOpen(false);
      setNewPTError("");
      setNewPTForm(emptyNewPTForm());
      mostrarToast("PT guardado en OPAT");
    } catch (err) {
      console.error(err);
      setNewPTError("No se pudo guardar el PT en OPAT.");
    } finally {
      setSaving(false);
    }
  };

  const onDragStartTrabajo = (trabajoId: string) => {
    setDraggingId(trabajoId);
  };

  const onDragEndTrabajo = () => {
    setDraggingId("");
    setDropTargetDate("");
  };

  const onDragOverDay = (
    dateIso: string,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    if (!draggingId) return;
    setDropTargetDate(dateIso);
  };

  const onDropDay = (dateIso: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!draggingId) return;

    const trabajo = trabajos.find((t) => t.id === draggingId);
    if (!trabajo) {
      setDraggingId("");
      setDropTargetDate("");
      return;
    }

    if (trabajo.fecha === dateIso) {
      setDraggingId("");
      setDropTargetDate("");
      return;
    }

    setPendingMove({
      trabajoId: trabajo.id,
      fromDate: trabajo.fecha,
      toDate: dateIso,
    });
    setMoveReason("");
    setMoveReasonError("");
    setMoveReasonOpen(true);
    setDraggingId("");
    setDropTargetDate("");
  };

  const cerrarMoveReasonModal = () => {
    if (moving) return;
    setMoveReasonOpen(false);
    setMoveReason("");
    setMoveReasonError("");
    setPendingMove(null);
  };

  const confirmarMovimiento = async () => {
    try {
      if (!pendingMove) return;

      const motivo = moveReason.trim();
      if (!motivo) {
        setMoveReasonError("Debes ingresar el motivo del cambio.");
        return;
      }

      const trabajo = trabajos.find((t) => t.id === pendingMove.trabajoId);
      if (!trabajo) {
        setMoveReasonError("No se encontró el trabajo a mover.");
        return;
      }

      setMoving(true);
      setMoveReasonError("");

      const original = trabajo.original;

      const updatedPayload: OpatTrabajo = {
        ...original,
        fInicio: pendingMove.toDate,
        fFin: pendingMove.toDate,
      };

      const res = await fetch("/api/opat/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedPayload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "No se pudo reprogramar el PT.");
      }

      setData((prev) =>
        prev.map((item) => {
          const samePT = item.pt === original.pt;
          const sameFecha = item.fInicio === original.fInicio;
          const sameInicio = item.inicio === original.inicio;
          const sameFin = item.fin === original.fin;

          if (samePT && sameFecha && sameInicio && sameFin) {
            return {
              ...item,
              fInicio: pendingMove.toDate,
              fFin: pendingMove.toDate,
            };
          }

          return item;
        })
      );

      setHistorial((prev) => [
        {
          id: `${trabajo.pt}-${Date.now()}`,
          tipo: "reprogramacion",
          pt: trabajo.pt,
          fechaOrigen: pendingMove.fromDate,
          fechaDestino: pendingMove.toDate,
          motivo,
          timestamp: formatTimestamp(new Date()),
        },
        ...prev,
      ]);

      setMoveReasonOpen(false);
      setPendingMove(null);
      setMoveReason("");
      setMoveReasonError("");
      mostrarToast("PT reprogramado en OPAT");
    } catch (err) {
      console.error(err);
      setMoveReasonError("No se pudo reprogramar el PT en OPAT.");
    } finally {
      setMoving(false);
    }
  };

  const updateEditField = (field: keyof EditPTForm, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const guardarEdicionTrabajo = async () => {
    try {
      if (!trabajoSeleccionado || !editForm) return;

      setUpdatingDetail(true);
      setEditError("");

      const original = trabajoSeleccionado.original;
      const oldEstado = trabajoSeleccionado.estado;

      const updatedPayload: OpatTrabajo = {
        ...original,
        tipo: editForm.tipo,
        inicio: editForm.horaInicio,
        fin: editForm.horaFin,
        ssee: editForm.subestacion.trim(),
        comp: editForm.componente.trim(),
        desc: editForm.actividad.trim(),
        obs: editForm.observacion.trim(),
        prog: editForm.programador.trim(),
        aviso: editForm.aviso.trim(),
        sodi: editForm.sodi.trim(),
        estado: editForm.estado,
        fInicio: editForm.fecha,
        fFin: editForm.fecha,
      };

      const res = await fetch("/api/opat/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedPayload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "No se pudo actualizar el trabajo.");
      }

      setData((prev) =>
        prev.map((item) => {
          const samePT = item.pt === original.pt;
          const sameFecha = item.fInicio === original.fInicio;
          const sameInicio = item.inicio === original.inicio;
          const sameFin = item.fin === original.fin;

          if (samePT && sameFecha && sameInicio && sameFin) {
            return {
              ...item,
              tipo: updatedPayload.tipo,
              inicio: updatedPayload.inicio,
              fin: updatedPayload.fin,
              ssee: updatedPayload.ssee,
              comp: updatedPayload.comp,
              desc: updatedPayload.desc,
              obs: updatedPayload.obs,
              prog: updatedPayload.prog,
              aviso: updatedPayload.aviso,
              sodi: updatedPayload.sodi,
              estado: updatedPayload.estado,
              fInicio: updatedPayload.fInicio,
              fFin: updatedPayload.fFin,
            };
          }

          return item;
        })
      );

      if (oldEstado !== "Suspendido" && editForm.estado === "Suspendido") {
        setHistorial((prev) => [
          {
            id: `${trabajoSeleccionado.pt}-suspendido-${Date.now()}`,
            tipo: "suspension",
            pt: trabajoSeleccionado.pt,
            fechaOrigen: trabajoSeleccionado.fecha,
            fechaDestino: editForm.fecha,
            motivo:
              editForm.observacion.trim() ||
              "Cambio de estado a Suspendido desde el calendario",
            timestamp: formatTimestamp(new Date()),
          },
          ...prev,
        ]);
      }

      mostrarToast("Cambios guardados en OPAT");
      setSelectedId("");
    } catch (err) {
      console.error(err);
      setEditError("No se pudo guardar la edición en OPAT.");
    } finally {
      setUpdatingDetail(false);
    }
  };

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
        <div style={styles.filtersGridSimple}>
          <div style={styles.field}>
            <label style={styles.label}>Buscar</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="PT, subestación, componente..."
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
            <button
              onClick={() => setVista("historial")}
              style={{
                ...styles.segmentButton,
                ...(vista === "historial" ? styles.segmentButtonActive : {}),
              }}
            >
              Historial
            </button>
          </div>

          <button onClick={limpiarBusqueda} style={styles.secondaryButton}>
            Limpiar búsqueda
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
              <button
                onClick={() => cambiarMes(-1)}
                style={styles.secondaryButton}
              >
                ← Mes anterior
              </button>
              <button onClick={irHoy} style={styles.secondaryButton}>
                Mes actual
              </button>
              <button
                onClick={() => cambiarMes(1)}
                style={styles.secondaryButton}
              >
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
              const isDropTarget = dropTargetDate === day.iso && draggingId;

              return (
                <div
                  key={day.iso}
                  onDragOver={(e) => onDragOverDay(day.iso, e)}
                  onDrop={(e) => onDropDay(day.iso, e)}
                  style={{
                    ...styles.dayCell,
                    background: day.inMonth ? "#fff" : "#f8fafc",
                    opacity: day.inMonth ? 1 : 0.65,
                    borderColor: isDropTarget
                      ? "#16a34a"
                      : isToday
                      ? "#3b82f6"
                      : "#e2e8f0",
                    boxShadow: isDropTarget
                      ? "inset 0 0 0 2px rgba(22,163,74,0.18)"
                      : "none",
                  }}
                >
                  <div style={styles.dayHeader}>
                    <button
                      type="button"
                      onClick={() => abrirNuevoPT(day.iso)}
                      style={styles.dayNumberButton}
                      title="Crear nuevo PT en este día"
                    >
                      <span
                        style={{
                          ...styles.dayNumber,
                          background: isToday ? "#dbeafe" : "transparent",
                          color: isToday ? "#1d4ed8" : "#0f172a",
                        }}
                      >
                        {day.date.getDate()}
                      </span>
                    </button>

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
                          draggable
                          onDragStart={() => onDragStartTrabajo(trabajo.id)}
                          onDragEnd={onDragEndTrabajo}
                          onClick={() => setSelectedId(trabajo.id)}
                          style={{
                            ...styles.eventCardCompact,
                            background: colors.background,
                            color: colors.color,
                            border: `1px solid ${colors.border}`,
                            opacity: draggingId === trabajo.id ? 0.55 : 1,
                          }}
                          title={`${trabajo.subestacion} · ${trabajo.pt} · ${trabajo.componente}`}
                        >
                          <div style={styles.eventCompactSub}>
                            {truncateSoft(trabajo.subestacion || "-", 24)}
                          </div>

                          <div style={styles.eventCompactPt}>
                            {trabajo.pt || "Sin PT"}
                          </div>

                          <div style={styles.eventCompactComp}>
                            {truncateSoft(trabajo.componente || "-", 28)}
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
              No hay trabajos que coincidan con la búsqueda.
            </div>
          )}
        </div>
      )}

      {vista === "historial" && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>PT</th>
                <th style={styles.th}>Fecha origen</th>
                <th style={styles.th}>Fecha destino</th>
                <th style={styles.th}>Motivo</th>
                <th style={styles.th}>Fecha registro</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((item) => (
                <tr key={item.id} style={styles.tr}>
                  <td style={styles.td}>
                    {item.tipo === "reprogramacion"
                      ? "Reprogramación"
                      : "Suspensión"}
                  </td>
                  <td style={styles.td}>{item.pt}</td>
                  <td style={styles.td}>{item.fechaOrigen}</td>
                  <td style={styles.td}>{item.fechaDestino}</td>
                  <td style={styles.td}>{item.motivo}</td>
                  <td style={styles.td}>{item.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {historial.length === 0 && (
            <div style={styles.emptyInner}>
              Aún no hay cambios históricos registrados.
            </div>
          )}
        </div>
      )}

      {trabajoSeleccionado && editForm && (
        <div style={styles.modalOverlay} onClick={cerrarModal}>
          <div style={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Detalle del trabajo</h2>
                <div style={styles.modalSubtitle}>
                  {trabajoSeleccionado.subestacion || "-"} ·{" "}
                  {trabajoSeleccionado.pt || "-"}
                </div>
              </div>

              <button onClick={cerrarModal} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {editError && <div style={styles.errorBox}>{editError}</div>}

            <div style={styles.formGrid}>
              <ReadOnlyField label="PT" value={trabajoSeleccionado.pt} />

              <FormField label="Fecha">
                <input
                  type="date"
                  value={editForm.fecha}
                  onChange={(e) => updateEditField("fecha", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora inicio">
                <input
                  type="time"
                  value={editForm.horaInicio}
                  onChange={(e) => updateEditField("horaInicio", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora fin">
                <input
                  type="time"
                  value={editForm.horaFin}
                  onChange={(e) => updateEditField("horaFin", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Subestación">
                <input
                  value={editForm.subestacion}
                  onChange={(e) =>
                    updateEditField("subestacion", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Componente">
                <input
                  value={editForm.componente}
                  onChange={(e) =>
                    updateEditField("componente", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Estado">
                <select
                  value={editForm.estado}
                  onChange={(e) => updateEditField("estado", e.target.value)}
                  style={styles.input}
                >
                  <option value="En programación">En programación</option>
                  <option value="Autorizado">Autorizado</option>
                  <option value="Suspendido">Suspendido</option>
                </select>
              </FormField>

              <FormField label="Tipo">
                <select
                  value={editForm.tipo}
                  onChange={(e) => updateEditField("tipo", e.target.value)}
                  style={styles.input}
                >
                  <option value="DESCONEXIÓN">DESCONEXIÓN</option>
                  <option value="INTERVENCIÓN">INTERVENCIÓN</option>
                  <option value="INFORMATIVA">INFORMATIVA</option>
                  <option value="SODI DESCONEXIÓN">SODI DESCONEXIÓN</option>
                  <option value="SODI INFORMATIVA">SODI INFORMATIVA</option>
                  <option value="SODI DE TERCEROS">SODI DE TERCEROS</option>
                </select>
              </FormField>

              <FormField label="Programador">
                <input
                  value={editForm.programador}
                  onChange={(e) =>
                    updateEditField("programador", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Aviso al CEN">
                <input
                  value={editForm.aviso}
                  onChange={(e) => updateEditField("aviso", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="SODI">
                <input
                  value={editForm.sodi}
                  onChange={(e) => updateEditField("sodi", e.target.value)}
                  style={styles.input}
                />
              </FormField>
            </div>

            <div style={{ marginTop: 14 }}>
              <FormField label="Actividad">
                <textarea
                  value={editForm.actividad}
                  onChange={(e) => updateEditField("actividad", e.target.value)}
                  style={styles.textarea}
                />
              </FormField>

              <FormField label="Observación">
                <textarea
                  value={editForm.observacion}
                  onChange={(e) =>
                    updateEditField("observacion", e.target.value)
                  }
                  style={styles.textarea}
                />
              </FormField>
            </div>

            <div style={styles.modalActions}>
              <button onClick={cerrarModal} style={styles.secondaryButton}>
                Cerrar
              </button>

              <button
                onClick={guardarEdicionTrabajo}
                disabled={updatingDetail}
                style={{
                  ...styles.primaryButton,
                  opacity: updatingDetail ? 0.7 : 1,
                  cursor: updatingDetail ? "not-allowed" : "pointer",
                }}
              >
                {updatingDetail ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newPTOpen && (
        <div style={styles.modalOverlay} onClick={cerrarNuevoPT}>
          <div style={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Nuevo PT</h2>
                <div style={styles.modalSubtitle}>
                  Crear trabajo manual para {newPTForm.fecha || "-"}
                </div>
              </div>

              <button onClick={cerrarNuevoPT} style={styles.closeButton}>
                ✕
              </button>
            </div>

            {newPTError && <div style={styles.errorBox}>{newPTError}</div>}

            <div style={styles.formGrid}>
              <FormField label="PT">
                <input
                  value={newPTForm.pt}
                  onChange={(e) => updateNewPTField("pt", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Fecha">
                <input
                  type="date"
                  value={newPTForm.fecha}
                  onChange={(e) => updateNewPTField("fecha", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora inicio">
                <input
                  type="time"
                  value={newPTForm.horaInicio}
                  onChange={(e) => updateNewPTField("horaInicio", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Hora fin">
                <input
                  type="time"
                  value={newPTForm.horaFin}
                  onChange={(e) => updateNewPTField("horaFin", e.target.value)}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Subestación">
                <input
                  value={newPTForm.subestacion}
                  onChange={(e) =>
                    updateNewPTField("subestacion", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Componente">
                <input
                  value={newPTForm.componente}
                  onChange={(e) =>
                    updateNewPTField("componente", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Estado">
                <select
                  value={newPTForm.estado}
                  onChange={(e) => updateNewPTField("estado", e.target.value)}
                  style={styles.input}
                >
                  <option value="En programación">En programación</option>
                  <option value="Autorizado">Autorizado</option>
                  <option value="Suspendido">Suspendido</option>
                </select>
              </FormField>

              <FormField label="Tipo">
                <select
                  value={newPTForm.tipo}
                  onChange={(e) => updateNewPTField("tipo", e.target.value)}
                  style={styles.input}
                >
                  <option value="DESCONEXIÓN">DESCONEXIÓN</option>
                  <option value="INTERVENCIÓN">INTERVENCIÓN</option>
                  <option value="INFORMATIVA">INFORMATIVA</option>
                  <option value="SODI DESCONEXIÓN">SODI DESCONEXIÓN</option>
                  <option value="SODI INFORMATIVA">SODI INFORMATIVA</option>
                  <option value="SODI DE TERCEROS">SODI DE TERCEROS</option>
                </select>
              </FormField>

              <FormField label="Programador">
                <input
                  value={newPTForm.programador}
                  onChange={(e) =>
                    updateNewPTField("programador", e.target.value)
                  }
                  style={styles.input}
                />
              </FormField>

              <FormField label="Área">
                <input
                  value={newPTForm.area}
                  onChange={(e) => updateNewPTField("area", e.target.value)}
                  style={styles.input}
                />
              </FormField>
            </div>

            <div style={{ marginTop: 14 }}>
              <FormField label="Actividad">
                <textarea
                  value={newPTForm.actividad}
                  onChange={(e) => updateNewPTField("actividad", e.target.value)}
                  style={styles.textarea}
                />
              </FormField>

              <FormField label="Observación">
                <textarea
                  value={newPTForm.observacion}
                  onChange={(e) =>
                    updateNewPTField("observacion", e.target.value)
                  }
                  style={styles.textarea}
                />
              </FormField>
            </div>

            <div style={styles.modalActions}>
              <button onClick={cerrarNuevoPT} style={styles.secondaryButton}>
                Cancelar
              </button>

              <button
                onClick={guardarNuevoPT}
                disabled={saving}
                style={{
                  ...styles.primaryButton,
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Guardando..." : "Guardar en OPAT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {moveReasonOpen && pendingMove && (
        <div style={styles.modalOverlay} onClick={cerrarMoveReasonModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Reprogramar PT</h2>
                <div style={styles.modalSubtitle}>
                  {pendingMove.fromDate} → {pendingMove.toDate}
                </div>
              </div>

              <button
                onClick={cerrarMoveReasonModal}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            {moveReasonError && <div style={styles.errorBox}>{moveReasonError}</div>}

            <FormField label="Motivo del cambio">
              <textarea
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                style={styles.textarea}
                placeholder="Ej: reprogramación por coordinación, disponibilidad, clima, etc."
              />
            </FormField>

            <div style={styles.modalActions}>
              <button
                onClick={cerrarMoveReasonModal}
                style={styles.secondaryButton}
              >
                Cancelar
              </button>

              <button
                onClick={confirmarMovimiento}
                disabled={moving}
                style={{
                  ...styles.primaryButton,
                  opacity: moving ? 0.7 : 1,
                  cursor: moving ? "not-allowed" : "pointer",
                }}
              >
                {moving ? "Guardando..." : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.visible && <div style={styles.toast}>{toast.message}</div>}
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

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={styles.readOnlyBox}>{value || "-"}</div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
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
  filtersGridSimple: {
    display: "grid",
    gridTemplateColumns: "1fr",
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
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    minHeight: 96,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: 12,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "Arial, sans-serif",
  },
  readOnlyBox: {
    minHeight: 42,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 14,
    background: "#f8fafc",
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
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
    minHeight: 175,
    borderRight: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    transition: "box-shadow 0.12s ease, border-color 0.12s ease",
  },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNumberButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
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
  eventCardCompact: {
    width: "100%",
    textAlign: "left",
    borderRadius: 10,
    padding: "7px 8px",
    cursor: "grab",
    fontSize: 12,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  eventCompactSub: {
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.25,
    wordBreak: "break-word",
  },
  eventCompactPt: {
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.25,
    wordBreak: "break-word",
  },
  eventCompactComp: {
    fontSize: 11,
    lineHeight: 1.25,
    wordBreak: "break-word",
    opacity: 0.95,
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
    minWidth: 900,
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
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 1000,
  },
  modal: {
    width: "min(980px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)",
    padding: 20,
  },
  modalLarge: {
    width: "min(1100px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)",
    padding: 20,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
  },
  modalSubtitle: {
    marginTop: 6,
    color: "#475569",
    fontSize: 14,
  },
  closeButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 10,
    width: 40,
    height: 40,
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  modalActions: {
    marginTop: 18,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
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
  toast: {
    position: "fixed",
    right: 20,
    bottom: 20,
    background: "#16a34a",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    boxShadow: "0 10px 30px rgba(22, 163, 74, 0.35)",
    zIndex: 1200,
  },
};