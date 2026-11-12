import ExcelJS from "exceljs";
import type { Response } from "express";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface ExcelColumn {
  header: string;
  width: number;
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: (string | number | null)[][];
}

// Fecha corta para columnas de reporte (independiente de la zona del server)
export function formatDate(date: Date | null): string {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function formatDateTime(date: Date | null): string {
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)} ${hours}:${minutes}`;
}

// Sufijo de nombre de archivo con la fecha de generación
export function fileDateSuffix(): string {
  return formatDate(new Date()).replaceAll("/", "-");
}

/**
 * Genera el workbook (una hoja por ExcelSheet) y lo responde como
 * descarga attachment. `res.send(Buffer)` no debe volver a serializar.
 */
export async function sendExcel(
  res: Response,
  filename: string,
  sheets: ExcelSheet[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Clickear";

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.columns = sheet.columns.map((column) => ({
      header: column.header,
      width: column.width,
    }));
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      ws.addRow(row);
    }
  }

  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(Buffer.from(await workbook.xlsx.writeBuffer()));
}
