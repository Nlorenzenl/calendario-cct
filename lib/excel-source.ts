import * as XLSX from "xlsx";

export type ExcelInspectResult = {
  fileName: string;
  sheetNames: string[];
  selectedSheetName: string;
  range: string | null;
  rowCount: number;
  previewRows: unknown[][];
  allRows: unknown[][];
};

export function inspectWorkbookFromBuffer(
  fileBuffer: Buffer,
  preferredSheetName?: string
): ExcelInspectResult {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  const sheetNames = workbook.SheetNames || [];

  if (!sheetNames.length) {
    throw new Error("El archivo Excel no contiene hojas.");
  }

  const selectedSheetName =
    preferredSheetName && sheetNames.includes(preferredSheetName)
      ? preferredSheetName
      : sheetNames[0];

  const worksheet = workbook.Sheets[selectedSheetName];

  if (!worksheet) {
    throw new Error(`No se encontró la hoja "${selectedSheetName}".`);
  }

  const range = worksheet["!ref"] || null;

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  }) as unknown[][];

  return {
    fileName: "",
    sheetNames,
    selectedSheetName,
    range,
    rowCount: rows.length,
    previewRows: rows.slice(0, 40),
    allRows: rows,
  };
}