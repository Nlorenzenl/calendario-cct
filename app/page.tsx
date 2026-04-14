"use client";
import { useState } from "react";

export default function Page() {
  const [data, setData] = useState<any[]>([]);

  const cargarOPAT = async () => {
    const res = await fetch("/api/opat");
    const json = await res.json();
    setData(json);
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={cargarOPAT}>
        🔌 Cargar OPAT
      </button>

      <pre style={{ marginTop: 20 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}