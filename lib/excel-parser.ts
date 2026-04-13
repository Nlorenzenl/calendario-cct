import * as XLSX from "xlsx";

export type Trabajo = {
  fecha: Date;
  pt: string;
  area: string;
  zonal: string;
  tipo: string;
  ssee: string;
  componente: string;
  descripcion: string;
  horaInicio?: string;
  horaFin?: string;
};

export function parseExcel(buffer: ArrayBuffer): Trabajo[] {
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  return rows
    .map((row) => {
      const fechaRaw = row["Fecha"];

      let fecha: Date | null = null;

      if (fechaRaw instanceof Date) {
        fecha = fechaRaw;
      } else if (typeof fechaRaw === "string") {
        const [day, month, year] = fechaRaw.split("/");
        fecha = new Date(`${year}-${month}-${day}`);
      }

      if (!fecha || isNaN(fecha.getTime())) return null;

      return {
        fecha,
        pt: row["N° PT"] || "Sin PT",
        area: row["Area"] || "",
        zonal: row["Zonal"] || "",
        tipo: row["Tipo de permiso de trabajo"] || "",
        ssee: row["SSEE O LT"] || "",
        componente: row["Componente"] || "",
        descripcion: row["Descripcion"] || "",
      };
    })
    .filter(Boolean) as Trabajo[];
}