import { parse } from "csv-parse/sync";
import type { TableSchema, ColumnSchema } from "@graver-ai/shared";

function sanitizeColumnName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^[0-9]/, "_$&")
    .toLowerCase();
}

function inferType(values: unknown[]): ColumnSchema["type"] {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return "TEXT";

  const hasArray = nonNull.some((v) => Array.isArray(v));
  const hasObject = nonNull.some((v) => typeof v === "object" && !Array.isArray(v) && v !== null);
  if (hasArray || hasObject) return "TEXT";

  const allBool = nonNull.every((v) => typeof v === "boolean");
  if (allBool) return "INTEGER";

  const allInt = nonNull.every((v) => /^-?\d+$/.test(String(v)));
  if (allInt) return "INTEGER";

  const allReal = nonNull.every((v) => /^-?\d+(\.\d+)?$/.test(String(v)));
  if (allReal) return "REAL";

  const allDate = nonNull.every((v) => {
    const s = String(v);
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s);
  });
  if (allDate) return "DATE";

  return "TEXT";
}

function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number" || typeof val === "string" || typeof val === "bigint") return val;
  if (Buffer.isBuffer(val)) return val;
  // Arrays and objects become JSON strings
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function detectForeignKeys(columnNames: string[]): string[] {
  return columnNames.filter((name) => /_id$|_cvr$|_key$/.test(name));
}

export interface ParsedDataset {
  schema: TableSchema;
  rows: Record<string, unknown>[];
}

export function parseCSV(buffer: Buffer): ParsedDataset {
  const raw = buffer.toString("utf-8");
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (records.length === 0) {
    throw new Error("CSV file is empty or has no data rows");
  }

  const rawColumns = Object.keys(records[0]);
  const columns: ColumnSchema[] = rawColumns.map((name) => {
    const values = records.map((r) => r[name]);
    return {
      name: sanitizeColumnName(name),
      type: inferType(values),
      nullable: values.some((v) => v === "" || v === null || v === undefined),
      sampleValues: values.slice(0, 10),
    };
  });

  const sanitizedToRaw: Record<string, string> = {};
  rawColumns.forEach((raw, i) => {
    sanitizedToRaw[columns[i].name] = raw;
  });

  const rows: Record<string, unknown>[] = records.map((record) => {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const rawValue = record[sanitizedToRaw[col.name]];
      row[col.name] = rawValue === "" ? null : serializeValue(rawValue);
    }
    return row;
  });

  const schema: TableSchema = {
    tableName: "",
    columns,
    foreignKeys: detectForeignKeys(columns.map((c) => c.name)),
    rowCount: rows.length,
    sampleRows: rows.slice(0, 50),
  };

  return { schema, rows };
}

export function parseJSON(buffer: Buffer): ParsedDataset {
  const raw = JSON.parse(buffer.toString("utf-8"));

  let records: Record<string, unknown>[];
  if (Array.isArray(raw)) {
    records = raw;
  } else if (raw && typeof raw === "object") {
    // Try common wrapper formats
    records = raw.data || raw.records || raw.results || raw.rows || [raw];
  } else {
    throw new Error("JSON must contain an array of objects or a known wrapper");
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("JSON file has no records");
  }

  const rawColumns = Object.keys(records[0]);
  const columns: ColumnSchema[] = rawColumns.map((name) => {
    const values = records.map((r) => r[name]);
    return {
      name: sanitizeColumnName(name),
      type: inferType(values),
      nullable: values.some((v) => v === "" || v === null || v === undefined),
      sampleValues: values.slice(0, 10),
    };
  });

  const sanitizedToRaw: Record<string, string> = {};
  rawColumns.forEach((raw, i) => {
    sanitizedToRaw[columns[i].name] = raw;
  });

  const rows: Record<string, unknown>[] = records.map((record) => {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const rawKey = sanitizedToRaw[col.name];
      const val = record[rawKey] ?? null;
      row[col.name] = serializeValue(val);
    }
    return row;
  });

  const schema: TableSchema = {
    tableName: "",
    columns,
    foreignKeys: detectForeignKeys(columns.map((c) => c.name)),
    rowCount: rows.length,
    sampleRows: rows.slice(0, 50),
  };

  return { schema, rows };
}

export function generateTableName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const sanitized = base.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  const timestamp = Date.now().toString(36);
  return `kb_${sanitized}_${timestamp}`;
}
