"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { Modal, ConfirmModal } from "@/components/Modal";
import { hasValidToken } from "@/lib/session";
import {
  listServices,
  createService,
  updateService,
  deleteService,
  type ServiceStatus,
} from "@/lib/api";

const statusOptions: { value: ServiceStatus["status"]; label: string; color: string }[] = [
  { value: "up", label: "正常", color: "bg-green-100 text-green-700" },
  { value: "down", label: "异常", color: "bg-red-100 text-red-700" },
  { value: "maintenance", label: "维护", color: "bg-yellow-100 text-yellow-700" },
];

function statusLabel(status: string): { label: string; color: string } {
  return statusOptions.find((item) => item.value === status) ?? {
    label: status,
    color: "bg-gray-100 text-gray-700",
  };
}

export default function ServicesPage() {
  const { pushNotification } = useToast();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServiceStatus[]>([]);
  const [editing, setEditing] = useState<ServiceStatus | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftStatus, setDraftStatus] = useState<ServiceStatus["status"]>("up");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<ServiceStatus | null>(null);

  async function reload() {
    const data = await listServices();
    setRows(data);
  }

  useEffect(() => {
    setCanEdit(hasValidToken());
    reload()
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "加载失败";
        pushNotification({ style: "error", title: message });
      })
      .finally(() => setLoading(false));
  }, [pushNotification]);

  function openCreate() {
    setEditing({ id: 0, name: "", status: "up", note: "", updated_at: "" });
    setDraftName("");
    setDraftStatus("up");
    setDraftNote("");
  }

  function openEdit(row: ServiceStatus) {
    setEditing(row);
    setDraftName(row.name);
    setDraftStatus(row.status);
    setDraftNote(row.note);
  }

  async function save() {
    if (!draftName.trim()) {
      pushNotification({ style: "error", title: "请填写服务名称" });
      return;
    }
    setSaving(true);
    try {
      const body = { name: draftName.trim(), status: draftStatus, note: draftNote };
      if (editing && editing.id) {
        await updateService(editing.id, body);
      } else {
        await createService(body);
      }
      setEditing(null);
      await reload();
      pushNotification({ style: "success", title: "已保存" });
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-medium text-main">服务状态</h1>
          <p className="text-sm text-control mt-1">
            {canEdit ? "已登录，可以修改服务状态" : "未登录，当前为只读"}
          </p>
        </div>
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

      <div className="border border-block-border rounded-xs overflow-hidden relative min-h-40">
        {loading && <LoadingOverlay />}
        <table className="w-full text-sm">
          <thead className="bg-control-bg text-control">
            <tr>
              <th className="text-left font-medium px-4 py-2">服务</th>
              <th className="text-left font-medium px-4 py-2">状态</th>
              <th className="text-left font-medium px-4 py-2">备注</th>
              <th className="text-left font-medium px-4 py-2">更新时间</th>
              {canEdit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-control">
                  还没有服务
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const badge = statusLabel(row.status);
              return (
                <tr key={row.id} className="border-t border-block-border">
                  <td className="px-4 py-3 text-main">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-control">{row.note || "-"}</td>
                  <td className="px-4 py-3 text-control">{row.updated_at ? row.updated_at.replace("T", " ").slice(0, 16) : "-"}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" className="text-accent cursor-pointer mr-3" onClick={() => openEdit(row)}>
                        编辑
                      </button>
                      <button type="button" className="text-error cursor-pointer" onClick={() => setRemoving(row)}>
                        删除
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
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
              onClick={save}
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
            名称
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-block-border rounded-xs text-main bg-white"
            />
          </label>
          <label className="text-sm text-control">
            状态
            <select
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as ServiceStatus["status"])}
              className="mt-1 w-full px-3 py-2 border border-block-border rounded-xs text-main bg-white"
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-control">
            备注
            <input
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-block-border rounded-xs text-main bg-white"
            />
          </label>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title="删除服务"
        description={removing ? `删除「${removing.name}」？` : ""}
        danger
      />
    </div>
  );
}
