import { clearSession, readToken, redirectToAuth } from "@/lib/session";

function authHeaders(headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  const token = readToken();
  if (token) next.set("Authorization", `Bearer ${token}`);
  return next;
}

function rejectUnauthorized(status: number): void {
  if (status !== 401) return;
  clearSession();
  redirectToAuth();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = authHeaders(init?.headers);
  const res = await fetch(path, { ...init, headers });
  rejectUnauthorized(res.status);
  if (!res.ok) {
    const text = await res.text();
    let message = text || `HTTP ${res.status}`;
    try {
      const err = JSON.parse(text) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      // Response body is not JSON.
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// --- Dashboard ---

export interface DashboardData {
  id: number;
  total_balance: number;
  total_income: number;
  total_expense: number;
  last_flow_date: string | null;
}

export async function getDashboard(): Promise<DashboardData> {
  return api<DashboardData>("/api/dashboard");
}

// --- Fund Flow ---

export interface FundFlow {
  id: number;
  transaction_date: string;
  item: string;
  amount: number;
  remark: string;
  created_at: string;
}

export interface MonthlyStat {
  year: number;
  month: number;
  income: number;
  expense: number;
}

export async function listFundFlows(): Promise<FundFlow[]> {
  return api<FundFlow[]>("/api/fund-flows");
}

export async function createFundFlow(data: {
  transaction_date: string;
  item: string;
  amount: number;
  remark?: string;
}): Promise<FundFlow> {
  return api<FundFlow>("/api/fund-flows", jsonInit("POST", data));
}

export async function updateFundFlow(
  id: number,
  data: {
    transaction_date: string;
    item: string;
    amount: number;
    remark?: string;
  }
): Promise<FundFlow> {
  return api<FundFlow>(`/api/fund-flows/${id}`, jsonInit("PUT", data));
}

export async function deleteFundFlow(id: number): Promise<void> {
  await api(`/api/fund-flows/${id}`, { method: "DELETE" });
}

export async function getMonthlyStats(): Promise<MonthlyStat[]> {
  return api<MonthlyStat[]>("/api/fund-flows/monthly");
}

// --- Exhibition ---

export interface ExhibitionFileRef {
  id: number;
  ext: string;
  mime_type: string;
}

export interface ExhibitionAttachment {
  id: number;
  file_id: number;
  file: ExhibitionFileRef;
}

export interface Exhibition {
  id: number;
  region: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  location: string;
  type: string;
  booth_fee: string;
  contact: string;
  remark: string;
  status: string;
  created_at: string;
  cover_image_id: number | null;
  cover_image: ExhibitionFileRef | null;
  description: string;
  link: string;
  attachments: ExhibitionAttachment[];
}

export async function listExhibitions(): Promise<Exhibition[]> {
  return api<Exhibition[]>("/api/exhibitions");
}

export interface ExhibitionInput {
  region: string;
  name: string;
  location: string;
  type?: string;
  booth_fee?: string;
  contact?: string;
  remark?: string;
  status?: string;
  description?: string;
  link?: string;
  start_date?: string;
  end_date?: string;
  cover_image_id?: number | null;
  attachment_ids?: number[];
}

export async function createExhibition(data: ExhibitionInput): Promise<Exhibition> {
  return api<Exhibition>("/api/exhibitions", jsonInit("POST", data));
}

export async function updateExhibition(
  id: number,
  data: ExhibitionInput,
  opts?: { updateCoverImage?: boolean; replaceAttachments?: boolean }
): Promise<Exhibition> {
  return api<Exhibition>(
    `/api/exhibitions/${id}`,
    jsonInit("PUT", {
      ...data,
      update_cover_image: opts?.updateCoverImage ?? false,
      replace_attachments: opts?.replaceAttachments ?? false,
    })
  );
}

export async function deleteExhibition(id: number): Promise<void> {
  await api(`/api/exhibitions/${id}`, { method: "DELETE" });
}

// --- File ---

export async function uploadFile(file: File): Promise<{ id: number }> {
  const body = new FormData();
  body.append("file", file);
  return api<{ id: number }>("/api/files", { method: "POST", body });
}

export async function fetchFileBlob(fileId: number): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/files/${fileId}`, { headers: authHeaders() });
    rejectUnauthorized(res.status);
    if (!res.ok) return null;
    return res.blob();
  } catch {
    return null;
  }
}

export interface ServiceStatus {
  id: number;
  name: string;
  status: "up" | "down" | "maintenance";
  note: string;
  updated_at: string;
}

export async function listServices(): Promise<ServiceStatus[]> {
  const res = await fetch("/api/services");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<ServiceStatus[]>;
}

export async function createService(data: {
  name: string;
  status: ServiceStatus["status"];
  note?: string;
}): Promise<ServiceStatus> {
  return api<ServiceStatus>("/api/services", jsonInit("POST", data));
}

export async function updateService(
  id: number,
  data: { name: string; status: ServiceStatus["status"]; note?: string }
): Promise<ServiceStatus> {
  return api<ServiceStatus>(`/api/services/${id}`, jsonInit("PUT", data));
}

export async function deleteService(id: number): Promise<void> {
  await api(`/api/services/${id}`, { method: "DELETE" });
}

export async function fetchFileAsDataUrl(fileId: number): Promise<string | null> {
  const blob = await fetchFileBlob(fileId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
