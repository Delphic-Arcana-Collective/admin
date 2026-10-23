"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { ActionDropdown } from "@/components/ActionDropdown";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { Modal, ConfirmModal } from "@/components/Modal";
import { hasValidToken } from "@/lib/session";
import {
  listServices,
  createService,
  updateService,
  deleteService,
  probeAllServices,
  probeService,
  type ServiceProtocol,
  type ServiceProbeStatus,
  type ServiceStatus,
} from "@/lib/api";

function StatusLight({ status }: { status: ServiceProbeStatus | "checking" }) {
  const online = status === "online";
  const checking = status === "checking";
  const label =
    status === "online"
      ? "在线"
      : status === "offline"
        ? "离线"
        : status === "checking"
          ? "检测中"
          : "未知";
  return (
    <span className="inline-flex items-center gap-2" title={label}>
      <span
        className={clsx(
          "relative inline-block size-2.5 rounded-full shrink-0",
          online ? "bg-green-500" : "bg-gray-400",
          checking && "animate-pulse"
        )}
      >
        {online && (
          <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />
        )}
      </span>
      <span className="inline-block w-[3em] text-left text-xs text-control">{label}</span>
    </span>
  );
}

function isValidAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return false;
  const bracketed = trimmed.match(/^\[([^\]]+)\]:(\d+)$/);
  if (bracketed) {
    const port = Number(bracketed[2]);
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }
  const idx = trimmed.lastIndexOf(":");
  if (idx <= 0) return false;
  const host = trimmed.slice(0, idx).trim();
  const port = Number(trimmed.slice(idx + 1));
  return Boolean(host) && Number.isInteger(port) && port >= 1 && port <= 65535;
}

function formatCheckedAt(value: string | null): string {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

export default function ServicesPage() {
  const { pushNotification } = useToast();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [rows, setRows] = useState<ServiceStatus[]>([]);
  const [liveStatus, setLiveStatus] = useState<Record<number, ServiceProbeStatus | "checking">>({});
  const [editing, setEditing] = useState<ServiceStatus | null>(null);
  const [draftAddress, setDraftAddress] = useState("");
  const [draftProtocol, setDraftProtocol] = useState<ServiceProtocol>("tcp");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<ServiceStatus | null>(null);

  const applyRows = useCallback((data: ServiceStatus[]) => {
    setRows(data);
    const next: Record<number, ServiceProbeStatus | "checking"> = {};
    for (const row of data) {
      next[row.id] = row.last_status || "unknown";
    }
    setLiveStatus(next);
  }, []);

  const reload = useCallback(async () => {
    const data = await listServices();
    applyRows(data);
    return data;
  }, [applyRows]);

  const runProbeAll = useCallback(async () => {
    setProbing(true);
    setLiveStatus((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) next[Number(id)] = "checking";
      return next;
    });
    try {
      const data = await probeAllServices();
      applyRows(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "探测失败";
      pushNotification({ style: "error", title: message });
      await reload().catch(() => undefined);
    } finally {
      setProbing(false);
    }
  }, [applyRows, pushNotification, reload]);

  useEffect(() => {
    setCanEdit(hasValidToken());
    let cancelled = false;
    (async () => {
      try {
        await reload();
        if (!cancelled) await runProbeAll();
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "加载失败";
        pushNotification({ style: "error", title: message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pushNotification, reload, runProbeAll]);

  function openCreate() {
    setEditing({
      id: 0,
      address: "",
      protocol: "tcp",
      note: "",
      last_status: "unknown",
      last_checked_at: null,
      updated_at: "",
    });
    setDraftAddress("");
    setDraftProtocol("tcp");
    setDraftNote("");
  }

  function openEdit(row: ServiceStatus) {
    setEditing(row);
    setDraftAddress(row.address);
    setDraftProtocol(row.protocol === "udp" ? "udp" : "tcp");
    setDraftNote(row.note);
  }

  async function save() {
    if (!isValidAddress(draftAddress)) {
      pushNotification({
        style: "error",
        title: "请填写有效地址",
        description: "格式为 IP:端口，例如 1.2.3.4:8080",
      });
      return;
    }
    setSaving(true);
    try {
      const body = {
        address: draftAddress.trim(),
        protocol: draftProtocol,
        note: draftNote,
      };
      if (editing && editing.id) {
        await updateService(editing.id, body);
      } else {
        await createService(body);
      }
      setEditing(null);
      await reload();
      await runProbeAll();
      pushNotification({ style: "success", title: "已保存并完成探测" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "保存失败";
      pushNotification({ style: "error", title: message });
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await deleteService(removing.id);
      setRemoving(null);
      await reload();
      pushNotification({ style: "success", title: "已删除" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "删除失败";
      pushNotification({ style: "error", title: message });
    }
  }

  async function testOne(row: ServiceStatus) {
    setLiveStatus((prev) => ({ ...prev, [row.id]: "checking" }));
    try {
      const next = await probeService(row.id);
      setRows((prev) => prev.map((item) => (item.id === next.id ? next : item)));
      setLiveStatus((prev) => ({ ...prev, [next.id]: next.last_status || "unknown" }));
    } catch (err: unknown) {
      setLiveStatus((prev) => ({ ...prev, [row.id]: "unknown" }));
      const message = err instanceof Error ? err.message : "探测失败";
      pushNotification({ style: "error", title: message });
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-medium text-main">服务状态</h1>
          {!canEdit && <p className="text-sm text-control mt-1">未登录，当前为只读。</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runProbeAll()}
            disabled={probing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium h-9 px-4 border border-control-border bg-control-bg text-main cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={clsx("w-4 h-4", probing && "animate-spin")} />
            {probing ? "探测中…" : "全部探测"}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium h-9 px-4 bg-accent text-accent-text hover:bg-accent-hover cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              添加
            </button>
          )}
        </div>
      </div>

      <div className={clsx("border border-block-border rounded-xs relative", loading && "min-h-40")}>
        {loading && <LoadingOverlay />}
        <table className="w-full text-sm">
          <thead className="bg-control-bg text-control">
            <tr>
              <th className="text-left font-medium px-4 py-2">地址</th>
              <th className="text-left font-medium px-4 py-2">协议</th>
              <th className="text-left font-medium px-4 py-2 w-28">状态</th>
              <th className="text-left font-medium px-4 py-2">备注</th>
              <th className="text-left font-medium px-4 py-2">上次探测</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-control">
                  {canEdit ? "还没有服务，点击右上角添加一条 IP:端口。" : "暂无服务数据。"}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-block-border">
                <td className="px-4 py-3 text-main font-mono text-xs sm:text-sm break-all">
                  {row.address}
                </td>
                <td className="px-4 py-3 text-control uppercase">{row.protocol}</td>
                <td className="px-4 py-3 w-28 whitespace-nowrap">
                  <StatusLight status={liveStatus[row.id] ?? row.last_status ?? "unknown"} />
                </td>
                <td className="px-4 py-3 text-control">{row.note || "-"}</td>
                <td className="px-4 py-3 text-control whitespace-nowrap">
                  {formatCheckedAt(row.last_checked_at)}
                </td>
                <td className="px-4 py-3 text-right w-12">
                  <ActionDropdown
                    actions={[
                      { label: "测试", onClick: () => void testOne(row) },
                      ...(canEdit
                        ? [
                            { label: "编辑", onClick: () => openEdit(row) },
                            { label: "删除", danger: true, onClick: () => setRemoving(row) },
                          ]
                        : []),
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "编辑服务" : "添加服务"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-xs text-sm border border-control-border bg-control-bg text-main cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center justify-center h-9 px-4 rounded-xs text-sm bg-accent text-accent-text hover:bg-accent-hover cursor-pointer disabled:opacity-50"
            >
              保存
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="text-sm text-control">
            地址 <span className="text-red-500">*</span>
            <input
              value={draftAddress}
              onChange={(event) => setDraftAddress(event.target.value)}
              placeholder="例如 1.2.3.4:8080"
              className="mt-1 w-full px-3 py-2 border border-block-border rounded-xs text-main bg-white font-mono"
            />
          </label>
          <label className="text-sm text-control">
            协议
            <select
              value={draftProtocol}
              onChange={(event) => setDraftProtocol(event.target.value as ServiceProtocol)}
              className="mt-1 w-full px-3 py-2 border border-block-border rounded-xs text-main bg-white"
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </label>
          <label className="text-sm text-control">
            备注（可选）
            <input
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-block-border rounded-xs text-main bg-white"
            />
          </label>
          <p className="text-xs text-control-light">
            状态由服务端按所选协议自动探测，无需手动选择。
          </p>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void confirmRemove()}
        title="删除服务"
        description={removing ? `删除「${removing.address}」？` : ""}
        danger
      />
    </div>
  );
}
