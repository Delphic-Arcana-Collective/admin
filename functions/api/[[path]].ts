import { verifyFirebaseToken } from "../lib/auth";

const CHUNK_BYTES = 1_500_000;

type SqlValue = string | number | null | Uint8Array;

interface Statement {
  bind(...values: SqlValue[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { last_row_id: number; changes: number } }>;
}

interface Database {
  prepare(query: string): Statement;
  batch<T = unknown>(statements: Statement[]): Promise<T[]>;
}

interface Env {
  DB: Database;
  FIREBASE_PROJECT_ID: string;
}

interface RouteContext {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function fail(message: string, status: number): Response {
  return json({ error: message }, status);
}

function segments(path: string | string[] | undefined): string[] {
  if (!path) return [];
  return Array.isArray(path) ? path : [path];
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function num(value: unknown): number {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function idOf(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function shanghaiDay(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function createdToday(iso: string): boolean {
  const created = shanghaiDay(iso);
  const today = shanghaiDay(new Date().toISOString());
  return created !== null && created === today;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("invalid json");
  }
  return body as Record<string, unknown>;
}

function bytesOf(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === "string") {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array();
}

async function ensureDashboard(db: Database): Promise<void> {
  const row = await db.prepare("SELECT id FROM dashboard LIMIT 1").first();
  if (row) return;
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO dashboard (total_balance, total_income, total_expense, last_flow_date, created_at, updated_at)
       VALUES (0, 0, 0, NULL, ?, ?)`,
    )
    .bind(ts, ts)
    .run();
}

async function loadDashboard(db: Database) {
  const row = await db.prepare("SELECT * FROM dashboard ORDER BY id LIMIT 1").first<Record<string, unknown>>();
  if (!row) {
    return { id: 0, total_balance: 0, total_income: 0, total_expense: 0, last_flow_date: null };
  }
  return {
    id: num(row.id),
    total_balance: num(row.total_balance),
    total_income: num(row.total_income),
    total_expense: num(row.total_expense),
    last_flow_date: row.last_flow_date ? text(row.last_flow_date) : null,
  };
}

function mapFlow(row: Record<string, unknown>) {
  return {
    id: num(row.id),
    transaction_date: text(row.transaction_date),
    item: text(row.item),
    amount: num(row.amount),
    remark: text(row.remark),
    created_at: text(row.created_at),
  };
}

async function listFlows(db: Database) {
  const rows = await db
    .prepare("SELECT * FROM fund_flow ORDER BY transaction_date DESC, id DESC")
    .all<Record<string, unknown>>();
  return rows.results.map(mapFlow);
}

async function createFlow(db: Database, body: Record<string, unknown>): Promise<Response> {
  const transactionDate = text(body.transaction_date);
  const item = text(body.item);
  if (!transactionDate || !item) return fail("transaction_date and item are required", 400);
  const amount = num(body.amount);
  const remark = text(body.remark);
  const income = amount > 0 ? amount : 0;
  const expense = amount < 0 ? Math.abs(amount) : 0;
  const created = nowIso();
  await ensureDashboard(db);
  const inserted = await db.batch<{ meta: { last_row_id: number } }>([
    db
      .prepare(
        `UPDATE dashboard SET
           total_balance = total_balance + ?,
           total_income = total_income + ?,
           total_expense = total_expense + ?,
           last_flow_date = ?,
           updated_at = ?`,
      )
      .bind(amount, income, expense, transactionDate, created),
    db
      .prepare(
        `INSERT INTO fund_flow (transaction_date, item, amount, remark, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(transactionDate, item, amount, remark, created),
  ]);
  const id = inserted[1].meta.last_row_id;
  const row = await db.prepare("SELECT * FROM fund_flow WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return json(mapFlow(row ?? { id, transaction_date: transactionDate, item, amount, remark, created_at: created }));
}

async function updateFlow(db: Database, id: number, body: Record<string, unknown>): Promise<Response> {
  const existing = await db.prepare("SELECT * FROM fund_flow WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return fail("not found", 404);
  if (!createdToday(text(existing.created_at))) return fail("only records created today can be changed", 403);
  const transactionDate = text(body.transaction_date) || text(existing.transaction_date);
  const item = text(body.item) || text(existing.item);
  const amount = body.amount == null ? num(existing.amount) : num(body.amount);
  const remark = body.remark == null ? text(existing.remark) : text(body.remark);
  const oldAmount = num(existing.amount);
  const balanceDelta = amount - oldAmount;
  const incomeDelta = (amount > 0 ? amount : 0) - (oldAmount > 0 ? oldAmount : 0);
  const expenseDelta = (amount < 0 ? Math.abs(amount) : 0) - (oldAmount < 0 ? Math.abs(oldAmount) : 0);
  await ensureDashboard(db);
  await db.batch([
    db
      .prepare(
        `UPDATE dashboard SET
           total_balance = total_balance + ?,
           total_income = total_income + ?,
           total_expense = total_expense + ?,
           updated_at = ?`,
      )
      .bind(balanceDelta, incomeDelta, expenseDelta, nowIso()),
    db
      .prepare(
        `UPDATE fund_flow SET transaction_date = ?, item = ?, amount = ?, remark = ? WHERE id = ?`,
      )
      .bind(transactionDate, item, amount, remark, id),
  ]);
  const row = await db.prepare("SELECT * FROM fund_flow WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return json(mapFlow(row!));
}

async function deleteFlow(db: Database, id: number): Promise<Response> {
  const existing = await db.prepare("SELECT * FROM fund_flow WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return fail("not found", 404);
  if (!createdToday(text(existing.created_at))) return fail("only records created today can be changed", 403);
  const amount = num(existing.amount);
  const incomeDelta = amount > 0 ? -amount : 0;
  const expenseDelta = amount < 0 ? amount : 0;
  await ensureDashboard(db);
  await db.batch([
    db
      .prepare(
        `UPDATE dashboard SET
           total_balance = total_balance + ?,
           total_income = total_income + ?,
           total_expense = total_expense + ?,
           updated_at = ?`,
      )
      .bind(-amount, incomeDelta, expenseDelta, nowIso()),
    db.prepare("DELETE FROM fund_flow WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}

function shanghaiMonth(iso: string): { year: number; month: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!year || !month) return null;
  return { year, month };
}

async function monthly(db: Database) {
  const rows = await db.prepare("SELECT transaction_date, amount FROM fund_flow").all<Record<string, unknown>>();
  const cursor = shanghaiMonth(new Date().toISOString());
  if (!cursor) return [];
  const keys: string[] = [];
  let year = cursor.year;
  let month = cursor.month;
  for (let i = 0; i < 12; i++) {
    keys.push(`${year}-${month}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  const allowed = new Set(keys);
  const totals = new Map<string, { year: number; month: number; income: number; expense: number }>();
  for (const key of keys) {
    const [y, m] = key.split("-").map(Number);
    totals.set(key, { year: y, month: m, income: 0, expense: 0 });
  }
  for (const row of rows.results) {
    const part = shanghaiMonth(text(row.transaction_date));
    if (!part) continue;
    const key = `${part.year}-${part.month}`;
    if (!allowed.has(key)) continue;
    const bucket = totals.get(key)!;
    const amount = num(row.amount);
    if (amount > 0) bucket.income += amount;
    if (amount < 0) bucket.expense += amount;
  }
  return keys.map((key) => totals.get(key)!);
}

type FileMeta = { id: number; ext: string; mime_type: string };

function mapFile(row: Record<string, unknown> | undefined): FileMeta | null {
  if (!row) return null;
  return { id: num(row.id), ext: text(row.ext), mime_type: text(row.mime_type) };
}

async function listExhibitions(db: Database) {
  const exhibitions = await db
    .prepare(
      `SELECT * FROM exhibition
       ORDER BY COALESCE(start_date, '1970-01-01') DESC, created_at DESC`,
    )
    .all<Record<string, unknown>>();
  const files = await db.prepare("SELECT id, ext, mime_type FROM files").all<Record<string, unknown>>();
  const attachments = await db
    .prepare("SELECT id, exhibition_id, file_id FROM exhibition_attachments ORDER BY id")
    .all<Record<string, unknown>>();
  const fileMap = new Map<number, Record<string, unknown>>();
  for (const file of files.results) fileMap.set(num(file.id), file);
  const byExhibition = new Map<number, Record<string, unknown>[]>();
  for (const attachment of attachments.results) {
    const exhibitionId = num(attachment.exhibition_id);
    const list = byExhibition.get(exhibitionId) ?? [];
    list.push(attachment);
    byExhibition.set(exhibitionId, list);
  }
  return exhibitions.results.map((row) => {
    const id = num(row.id);
    const coverId = row.cover_image_id == null ? null : num(row.cover_image_id);
    return {
      id,
      region: text(row.region),
      name: text(row.name),
      start_date: row.start_date ? text(row.start_date).slice(0, 10) : null,
      end_date: row.end_date ? text(row.end_date).slice(0, 10) : null,
      location: text(row.location),
      type: text(row.type),
      booth_fee: text(row.booth_fee),
      contact: text(row.contact),
      remark: text(row.remark),
      status: text(row.status),
      created_at: text(row.created_at),
      cover_image_id: coverId,
      cover_image: coverId == null ? null : mapFile(fileMap.get(coverId)),
      description: text(row.description),
      link: text(row.link),
      attachments: (byExhibition.get(id) ?? []).map((attachment) => {
        const fileId = num(attachment.file_id);
        return {
          id: num(attachment.id),
          file_id: fileId,
          file: mapFile(fileMap.get(fileId)) ?? { id: fileId, ext: "", mime_type: "" },
        };
      }),
    };
  });
}

function optionalDate(value: unknown): string | null {
  const raw = text(value).trim();
  if (!raw) return null;
  return raw.slice(0, 10);
}

async function createExhibition(db: Database, body: Record<string, unknown>): Promise<Response> {
  const region = text(body.region);
  const name = text(body.name);
  if (!region || !name) return fail("region and name are required", 400);
  const status = text(body.status) || "待商榷";
  const created = nowIso();
  const cover = body.cover_image_id == null || body.cover_image_id === "" ? null : num(body.cover_image_id);
  const inserted = await db
    .prepare(
      `INSERT INTO exhibition (
         region, name, start_date, end_date, location, type, booth_fee, contact, remark, status,
         created_at, description, link, cover_image_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      region,
      name,
      optionalDate(body.start_date),
      optionalDate(body.end_date),
      text(body.location),
      text(body.type),
      text(body.booth_fee),
      text(body.contact),
      text(body.remark),
      status,
      created,
      text(body.description),
      text(body.link),
      cover,
    )
    .run();
  const id = inserted.meta.last_row_id;
  const attachmentIds = Array.isArray(body.attachment_ids) ? body.attachment_ids.map(num).filter((n) => n > 0) : [];
  if (attachmentIds.length > 0) {
    await db.batch(
      attachmentIds.map((fileId) =>
        db.prepare("INSERT INTO exhibition_attachments (exhibition_id, file_id) VALUES (?, ?)").bind(id, fileId),
      ),
    );
  }
  const rows = await listExhibitions(db);
  return json(rows.find((row) => row.id === id) ?? { id });
}

async function updateExhibition(db: Database, id: number, body: Record<string, unknown>): Promise<Response> {
  const existing = await db
    .prepare("SELECT created_at FROM exhibition WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!existing) return fail("not found", 404);
  if (!createdToday(text(existing.created_at))) return fail("only records created today can be changed", 403);
  const assignments: string[] = [];
  const values: SqlValue[] = [];
  const setText = (column: string, key: string) => {
    const value = text(body[key]);
    if (!value) return;
    assignments.push(`${column} = ?`);
    values.push(column.endsWith("_date") ? value.slice(0, 10) : value);
  };
  setText("region", "region");
  setText("name", "name");
  setText("start_date", "start_date");
  setText("end_date", "end_date");
  setText("location", "location");
  setText("type", "type");
  setText("booth_fee", "booth_fee");
  setText("contact", "contact");
  setText("remark", "remark");
  setText("status", "status");
  setText("description", "description");
  setText("link", "link");
  if (body.update_cover_image === true) {
    assignments.push("cover_image_id = ?");
    values.push(body.cover_image_id == null || body.cover_image_id === "" ? null : num(body.cover_image_id));
  }
  const statements: Statement[] = [];
  if (assignments.length > 0) {
    statements.push(db.prepare(`UPDATE exhibition SET ${assignments.join(", ")} WHERE id = ?`).bind(...values, id));
  }
  if (body.replace_attachments === true) {
    statements.push(db.prepare("DELETE FROM exhibition_attachments WHERE exhibition_id = ?").bind(id));
    const attachmentIds = Array.isArray(body.attachment_ids) ? body.attachment_ids.map(num).filter((n) => n > 0) : [];
    for (const fileId of attachmentIds) {
      statements.push(
        db.prepare("INSERT INTO exhibition_attachments (exhibition_id, file_id) VALUES (?, ?)").bind(id, fileId),
      );
    }
  }
  if (statements.length > 0) await db.batch(statements);
  const rows = await listExhibitions(db);
  const row = rows.find((item) => item.id === id);
  return row ? json(row) : fail("not found", 404);
}

async function deleteExhibition(db: Database, id: number): Promise<Response> {
  const existing = await db
    .prepare("SELECT created_at FROM exhibition WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!existing) return fail("not found", 404);
  if (!createdToday(text(existing.created_at))) return fail("only records created today can be changed", 403);
  await db.batch([
    db.prepare("DELETE FROM exhibition_attachments WHERE exhibition_id = ?").bind(id),
    db.prepare("DELETE FROM exhibition WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}

async function readFile(db: Database, id: number): Promise<Response> {
  const meta = await db.prepare("SELECT mime_type FROM files WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!meta) return fail("not found", 404);
  const chunks = await db
    .prepare("SELECT data FROM file_chunks WHERE file_id = ? ORDER BY seq")
    .bind(id)
    .all<Record<string, unknown>>();
  const parts = chunks.results.map((row) => bytesOf(row.data));
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return new Response(out, {
    headers: { "content-type": text(meta.mime_type) || "application/octet-stream" },
  });
}

async function uploadFile(db: Database, request: Request): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("file is required", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  const inserted = await db
    .prepare("INSERT INTO files (ext, mime_type, created_at) VALUES (?, ?, ?)")
    .bind(ext, file.type || "application/octet-stream", nowIso())
    .run();
  const id = inserted.meta.last_row_id;
  const statements: Statement[] = [];
  for (let seq = 0, offset = 0; offset < bytes.byteLength; seq += 1, offset += CHUNK_BYTES) {
    const slice = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.byteLength));
    const copy = new Uint8Array(slice.byteLength);
    copy.set(slice);
    statements.push(db.prepare("INSERT INTO file_chunks (file_id, seq, data) VALUES (?, ?, ?)").bind(id, seq, copy));
  }
  if (statements.length > 0) await db.batch(statements);
  return json({ id });
}

const serviceProtocols = new Set(["tcp", "udp"]);
const probeStatuses = new Set(["online", "offline", "unknown"]);

type ProbeStatus = "online" | "offline" | "unknown";

async function ensureServices(db: Database): Promise<void> {
  const info = await db.prepare("PRAGMA table_info(service)").all<{ name: string }>();
  const cols = new Set((info.results || []).map((c) => c.name));
  if (cols.size > 0 && !cols.has("address")) {
    await db.prepare("DROP TABLE service").run();
  }
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS service (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        protocol TEXT NOT NULL DEFAULT 'tcp',
        note TEXT NOT NULL DEFAULT '',
        last_status TEXT NOT NULL DEFAULT 'unknown',
        last_checked_at TEXT,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
}

function mapService(row: Record<string, unknown>) {
  return {
    id: num(row.id),
    address: text(row.address),
    protocol: text(row.protocol) || "tcp",
    note: text(row.note),
    last_status: text(row.last_status) || "unknown",
    last_checked_at: text(row.last_checked_at) || null,
    updated_at: text(row.updated_at),
  };
}

function parseHostPort(address: string): { host: string; port: number } | null {
  const trimmed = address.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;

  const bracketed = trimmed.match(/^\[([^\]]+)\]:(\d+)$/);
  if (bracketed) {
    const port = Number(bracketed[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { host: bracketed[1], port };
  }

  const idx = trimmed.lastIndexOf(":");
  if (idx <= 0) return null;
  const host = trimmed.slice(0, idx).trim();
  const port = Number(trimmed.slice(idx + 1));
  if (!host || host.includes("/") || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return { host, port };
}

function serviceBody(
  body: Record<string, unknown>,
): { address: string; protocol: string; note: string } | Response {
  const address = text(body.address).trim();
  const protocol = text(body.protocol).trim().toLowerCase() || "tcp";
  if (!parseHostPort(address)) {
    return fail("address must be host:port (e.g. 1.2.3.4:8080)", 400);
  }
  if (!serviceProtocols.has(protocol)) return fail("protocol must be tcp or udp", 400);
  return { address, protocol, note: text(body.note) };
}

async function probeTcp(host: string, port: number): Promise<ProbeStatus> {
  const { connect } = await import("cloudflare:sockets");
  const timeoutMs = 3000;
  try {
    const socket = connect({ hostname: host, port });
    const status = await Promise.race([
      socket.opened.then(() => "online" as const),
      new Promise<ProbeStatus>((resolve) => {
        setTimeout(() => resolve("offline"), timeoutMs);
      }),
    ]);
    try {
      socket.close();
    } catch {
      /* ignore */
    }
    return status;
  } catch {
    return "offline";
  }
}

async function probeUdp(host: string, port: number): Promise<ProbeStatus> {
  // Workers have no first-class outbound UDP port check; best-effort via node:dgram when available.
  try {
    const dgram = await import("node:dgram");
    return await new Promise<ProbeStatus>((resolve) => {
      let settled = false;
      const done = (status: ProbeStatus) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        resolve(status);
      };
      const socket = dgram.createSocket("udp4");
      const timer = setTimeout(() => done("online"), 1500);
      socket.on("error", () => done("offline"));
      socket.send(Uint8Array.of(0), port, host, (err) => {
        if (err) done("offline");
      });
    });
  } catch {
    return "unknown";
  }
}

async function probeAddress(address: string, protocol: string): Promise<ProbeStatus> {
  const parsed = parseHostPort(address);
  if (!parsed) return "unknown";
  if (protocol === "udp") return probeUdp(parsed.host, parsed.port);
  return probeTcp(parsed.host, parsed.port);
}

async function listServices(db: Database): Promise<Response> {
  await ensureServices(db);
  const rows = await db.prepare("SELECT * FROM service ORDER BY id").all<Record<string, unknown>>();
  return json(rows.results.map(mapService));
}

async function createService(db: Database, body: Record<string, unknown>): Promise<Response> {
  const parsed = serviceBody(body);
  if (parsed instanceof Response) return parsed;
  await ensureServices(db);
  const updated = nowIso();
  const inserted = await db
    .prepare(
      "INSERT INTO service (address, protocol, note, last_status, last_checked_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(parsed.address, parsed.protocol, parsed.note, "unknown", null, updated)
    .run();
  const id = inserted.meta.last_row_id;
  const status = await probeAddress(parsed.address, parsed.protocol);
  const checked = nowIso();
  await db
    .prepare("UPDATE service SET last_status = ?, last_checked_at = ? WHERE id = ?")
    .bind(status, checked, id)
    .run();
  const row = await db.prepare("SELECT * FROM service WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return json(row ? mapService(row) : { id, ...parsed, last_status: status, last_checked_at: checked, updated_at: updated }, 201);
}

async function updateService(db: Database, id: number, body: Record<string, unknown>): Promise<Response> {
  const parsed = serviceBody(body);
  if (parsed instanceof Response) return parsed;
  await ensureServices(db);
  const existing = await db.prepare("SELECT id FROM service WHERE id = ?").bind(id).first();
  if (!existing) return fail("not found", 404);
  const updated = nowIso();
  await db
    .prepare("UPDATE service SET address = ?, protocol = ?, note = ?, updated_at = ? WHERE id = ?")
    .bind(parsed.address, parsed.protocol, parsed.note, updated, id)
    .run();
  const status = await probeAddress(parsed.address, parsed.protocol);
  const checked = nowIso();
  await db
    .prepare("UPDATE service SET last_status = ?, last_checked_at = ? WHERE id = ?")
    .bind(status, checked, id)
    .run();
  const row = await db.prepare("SELECT * FROM service WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return json(row ? mapService(row) : { id, ...parsed, last_status: status, last_checked_at: checked, updated_at: updated });
}

async function deleteService(db: Database, id: number): Promise<Response> {
  await ensureServices(db);
  const existing = await db.prepare("SELECT id FROM service WHERE id = ?").bind(id).first();
  if (!existing) return fail("not found", 404);
  await db.prepare("DELETE FROM service WHERE id = ?").bind(id).run();
  return json({ id });
}

async function probeOneService(db: Database, id: number): Promise<Response> {
  await ensureServices(db);
  const row = await db.prepare("SELECT * FROM service WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!row) return fail("not found", 404);
  const address = text(row.address);
  const protocol = text(row.protocol) || "tcp";
  const status = await probeAddress(address, protocol);
  const checked = nowIso();
  await db
    .prepare("UPDATE service SET last_status = ?, last_checked_at = ? WHERE id = ?")
    .bind(status, checked, id)
    .run();
  const next = await db.prepare("SELECT * FROM service WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return json(next ? mapService(next) : { ...mapService(row), last_status: status, last_checked_at: checked });
}

async function probeAllServices(db: Database): Promise<Response> {
  await ensureServices(db);
  const rows = await db.prepare("SELECT * FROM service ORDER BY id").all<Record<string, unknown>>();
  const out = [];
  for (const row of rows.results) {
    const id = num(row.id);
    const address = text(row.address);
    const protocol = text(row.protocol) || "tcp";
    const status = await probeAddress(address, protocol);
    const checked = nowIso();
    await db
      .prepare("UPDATE service SET last_status = ?, last_checked_at = ? WHERE id = ?")
      .bind(status, checked, id)
      .run();
    out.push({
      ...mapService(row),
      last_status: status,
      last_checked_at: checked,
    });
  }
  return json(out);
}

async function probeAdHoc(body: Record<string, unknown>): Promise<Response> {
  const address = text(body.address).trim();
  const protocol = text(body.protocol).trim().toLowerCase() || "tcp";
  if (!parseHostPort(address)) {
    return fail("address must be host:port (e.g. 1.2.3.4:8080)", 400);
  }
  if (!serviceProtocols.has(protocol)) return fail("protocol must be tcp or udp", 400);
  const status = await probeAddress(address, protocol);
  if (!probeStatuses.has(status)) return json({ status: "unknown", address, protocol });
  return json({ status, address, protocol });
}

async function route(context: RouteContext, method: string, parts: string[]): Promise<Response> {
  const db = context.env.DB;
  if (parts.length === 1 && parts[0] === "dashboard" && method === "GET") {
    return json(await loadDashboard(db));
  }
  if (parts[0] === "fund-flows") {
    if (parts.length === 1 && method === "GET") return json(await listFlows(db));
    if (parts.length === 1 && method === "POST") return createFlow(db, await readJson(context.request));
    if (parts.length === 2 && parts[1] === "monthly" && method === "GET") return json(await monthly(db));
    const id = parts.length === 2 ? idOf(parts[1]) : null;
    if (id == null && parts.length === 2 && parts[1] !== "monthly") return fail("invalid id", 400);
    if (id != null && method === "PUT") return updateFlow(db, id, await readJson(context.request));
    if (id != null && method === "DELETE") return deleteFlow(db, id);
  }
  if (parts[0] === "exhibitions") {
    if (parts.length === 1 && method === "GET") return json(await listExhibitions(db));
    if (parts.length === 1 && method === "POST") return createExhibition(db, await readJson(context.request));
    const id = parts.length === 2 ? idOf(parts[1]) : null;
    if (parts.length === 2 && id == null) return fail("invalid id", 400);
    if (id != null && method === "PUT") return updateExhibition(db, id, await readJson(context.request));
    if (id != null && method === "DELETE") return deleteExhibition(db, id);
  }
  if (parts[0] === "services") {
    if (parts.length === 1 && method === "GET") return listServices(db);
    if (parts.length === 1 && method === "POST") return createService(db, await readJson(context.request));
    if (parts.length === 2 && parts[1] === "probe-all" && method === "POST") {
      return probeAllServices(db);
    }
    if (parts.length === 2 && parts[1] === "probe" && method === "POST") {
      return probeAdHoc(await readJson(context.request));
    }
    const id = parts.length === 2 || parts.length === 3 ? idOf(parts[1]) : null;
    if ((parts.length === 2 || parts.length === 3) && parts[1] !== "probe-all" && parts[1] !== "probe" && id == null) {
      return fail("invalid id", 400);
    }
    if (id != null && parts.length === 2 && method === "PUT") {
      return updateService(db, id, await readJson(context.request));
    }
    if (id != null && parts.length === 2 && method === "DELETE") return deleteService(db, id);
    if (id != null && parts.length === 3 && parts[2] === "probe" && method === "POST") {
      return probeOneService(db, id);
    }
  }
  if (parts[0] === "files") {
    if (parts.length === 1 && method === "POST") return uploadFile(db, context.request);
    const id = parts.length === 2 ? idOf(parts[1]) : null;
    if (parts.length === 2 && id == null) return fail("invalid id", 400);
    if (id != null && method === "GET") return readFile(db, id);
  }
  return fail("not found", 404);
}

export async function onRequest(context: RouteContext): Promise<Response> {
  try {
    const method = context.request.method.toUpperCase();
    const parts = segments(context.params.path);
    const publicServices =
      parts[0] === "services" &&
      ((method === "GET" && parts.length === 1) ||
        (method === "POST" && parts.length === 2 && (parts[1] === "probe-all" || parts[1] === "probe")) ||
        (method === "POST" && parts.length === 3 && parts[2] === "probe"));
    if (!publicServices) {
      const header = context.request.headers.get("Authorization") ?? "";
      const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
      const ok = token !== "" && (await verifyFirebaseToken(token, context.env.FIREBASE_PROJECT_ID));
      if (!ok) return fail("unauthorized", 401);
    }
    return await route(context, method, parts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal error";
    return fail(message === "invalid json" ? message : "internal error", message === "invalid json" ? 400 : 500);
  }
}
