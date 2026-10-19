import { getBaseUrl } from "@/config";

// Connect JSON protocol client — manual fetch wrapper (no code gen).

async function connectCall<T>(
  procedure: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const err = JSON.parse(text) as { message?: string; code?: string };
      throw new Error(err.message || err.code || text);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  return res.json() as Promise<T>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
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
  const res = await connectCall<{
    dashboard: {
      id: number;
      totalBalance: number;
      totalIncome: number;
      totalExpense: number;
      lastFlowDate: string;
    };
  }>("dashboard.v1.DashboardService/GetDashboard");
  const d = res.dashboard;
  return {
    id: d.id,
    total_balance: d.totalBalance ?? 0,
    total_income: d.totalIncome ?? 0,
    total_expense: d.totalExpense ?? 0,
    last_flow_date: d.lastFlowDate || null,
  };
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

function mapFundFlow(f: Record<string, unknown>): FundFlow {
  return {
    id: f.id as number,
    transaction_date: f.transactionDate as string,
    item: f.item as string,
    amount: f.amount as number,
    remark: (f.remark as string) || "",
    created_at: f.createdAt as string,
  };
}

export async function listFundFlows(): Promise<FundFlow[]> {
  const res = await connectCall<{ fundFlows: Record<string, unknown>[] }>(
    "fund_flow.v1.FundFlowService/ListFundFlows"
  );
  return (res.fundFlows || []).map(mapFundFlow);
}

export async function createFundFlow(data: {
  transaction_date: string;
  item: string;
  amount: number;
  remark?: string;
}): Promise<FundFlow> {
  const res = await connectCall<{ fundFlow: Record<string, unknown> }>(
    "fund_flow.v1.FundFlowService/CreateFundFlow",
    {
      fundFlow: {
        transactionDate: data.transaction_date,
        item: data.item,
        amount: data.amount,
        remark: data.remark ?? "",
      },
    }
  );
  return mapFundFlow(res.fundFlow);
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
  const res = await connectCall<{ fundFlow: Record<string, unknown> }>(
    "fund_flow.v1.FundFlowService/UpdateFundFlow",
    {
      id,
      fundFlow: {
        transactionDate: data.transaction_date,
        item: data.item,
        amount: data.amount,
        remark: data.remark ?? "",
      },
    }
  );
  return mapFundFlow(res.fundFlow);
}

export async function deleteFundFlow(id: number): Promise<void> {
  await connectCall("fund_flow.v1.FundFlowService/DeleteFundFlow", { id });
}

export async function getMonthlyStats(): Promise<MonthlyStat[]> {
  const res = await connectCall<{
    stats: { year: number; month: number; income?: number; expense?: number }[];
  }>("fund_flow.v1.FundFlowService/GetMonthlyStats");
  return (res.stats || []).map((s) => ({
    year: s.year,
    month: s.month,
    income: s.income ?? 0,
    expense: s.expense ?? 0,
  }));
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

function mapFileRef(f: Record<string, unknown>): ExhibitionFileRef {
  return {
    id: f.id as number,
    ext: (f.ext as string) || "",
    mime_type: (f.mimeType as string) || "",
  };
}

function mapExhibition(e: Record<string, unknown>): Exhibition {
  const coverImage = e.coverImage as Record<string, unknown> | undefined;
  const attachments = (e.attachments as Record<string, unknown>[]) || [];
  return {
    id: e.id as number,
    region: (e.region as string) || "",
    name: (e.name as string) || "",
    start_date: (e.startDate as string) || null,
    end_date: (e.endDate as string) || null,
    location: (e.location as string) || "",
    type: (e.type as string) || "",
    booth_fee: (e.boothFee as string) || "",
    contact: (e.contact as string) || "",
    remark: (e.remark as string) || "",
    status: (e.status as string) || "",
    created_at: e.createdAt as string,
    cover_image_id: (e.coverImageId as number) ?? null,
    cover_image: coverImage ? mapFileRef(coverImage) : null,
    description: (e.description as string) || "",
    link: (e.link as string) || "",
    attachments: attachments.map((a) => ({
      id: a.id as number,
      file_id: a.fileId as number,
      file: mapFileRef((a.file as Record<string, unknown>) || {}),
    })),
  };
}

export async function listExhibitions(): Promise<Exhibition[]> {
  const res = await connectCall<{ exhibitions: Record<string, unknown>[] }>(
    "exhibition.v1.ExhibitionService/ListExhibitions"
  );
  return (res.exhibitions || []).map(mapExhibition);
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
  const body: Record<string, unknown> = {
    region: data.region,
    name: data.name,
    location: data.location,
    type: data.type ?? "",
    boothFee: data.booth_fee ?? "",
    contact: data.contact ?? "",
    remark: data.remark ?? "",
    status: data.status ?? "",
    description: data.description ?? "",
    link: data.link ?? "",
    startDate: data.start_date ?? "",
    endDate: data.end_date ?? "",
    attachmentIds: data.attachment_ids ?? [],
  };
  if (data.cover_image_id != null) {
    body.coverImageId = data.cover_image_id;
  }
  const res = await connectCall<{ exhibition: Record<string, unknown> }>(
    "exhibition.v1.ExhibitionService/CreateExhibition",
    body
  );
  return mapExhibition(res.exhibition);
}

export async function updateExhibition(
  id: number,
  data: ExhibitionInput,
  opts?: { updateCoverImage?: boolean; replaceAttachments?: boolean }
): Promise<Exhibition> {
  const body: Record<string, unknown> = {
    id,
    region: data.region,
    name: data.name,
    location: data.location,
    type: data.type ?? "",
    boothFee: data.booth_fee ?? "",
    contact: data.contact ?? "",
    remark: data.remark ?? "",
    status: data.status ?? "",
    description: data.description ?? "",
    link: data.link ?? "",
    startDate: data.start_date ?? "",
    endDate: data.end_date ?? "",
  };
  if (opts?.updateCoverImage) {
    body.updateCoverImage = true;
    body.coverImageId = data.cover_image_id ?? undefined;
  }
  if (opts?.replaceAttachments) {
    body.replaceAttachments = true;
    body.attachmentIds = data.attachment_ids ?? [];
  }
  const res = await connectCall<{ exhibition: Record<string, unknown> }>(
    "exhibition.v1.ExhibitionService/UpdateExhibition",
    body
  );
  return mapExhibition(res.exhibition);
}

export async function deleteExhibition(id: number): Promise<void> {
  await connectCall("exhibition.v1.ExhibitionService/DeleteExhibition", { id });
}

// --- File ---

export async function uploadFile(file: File): Promise<{ id: number }> {
  const bytes = await file.arrayBuffer();
  const ext = file.name.includes(".")
    ? "." + file.name.split(".").pop()
    : "";
  const res = await connectCall<{ file: { id: number } }>(
    "file.v1.FileService/UploadFile",
    {
      data: arrayBufferToBase64(bytes),
      filename: file.name,
      ext,
      mimeType: file.type || "application/octet-stream",
    }
  );
  return { id: res.file.id };
}

export async function fetchFileBlob(fileId: number): Promise<Blob | null> {
  try {
    const res = await connectCall<{
      file: { data: string; mimeType: string };
    }>("file.v1.FileService/GetFile", { id: fileId });
    return base64ToBlob(res.file.data, res.file.mimeType);
  } catch {
    return null;
  }
}

export async function fetchFileAsDataUrl(fileId: number): Promise<string | null> {
  const blob = await fetchFileBlob(fileId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
