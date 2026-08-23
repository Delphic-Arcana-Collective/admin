"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Maximize2, X, Clock } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { ActionDropdown } from "@/components/ActionDropdown";
import { ConfirmModal } from "@/components/Modal";
import {
  listFundFlows,
  createFundFlow,
  updateFundFlow,
  deleteFundFlow,
  type FundFlow,
} from "@/lib/api";

function formatDateTimeForDisplay(dateStr: string): string {
  if (!dateStr) return "-";
  const cleaned = dateStr.replace(/[+-]\d{2}:\d{2}$/, "").replace(/\.\d{3}/, "");
  const date = new Date(cleaned);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getLocalDateTimeString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function parseDateTimeToISO(dateTimeStr: string): string {
  return new Date(dateTimeStr).toISOString();
}

function RemarkCell({ remark }: { remark: string }) {
  const [showModal, setShowModal] = useState(false);
  const maxLength = 30;
  const isTruncated = remark && remark.length > maxLength;

  if (!remark) return <span className="text-gray-400">-</span>;

  return (
    <>
      <div className="group relative flex items-center gap-2 w-full">
        <span className="truncate flex-1">
          {isTruncated ? remark.slice(0, maxLength) + "..." : remark}
        </span>
        {isTruncated && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover:block">
            <button
              className="p-0.5 border border-control-border rounded-xs hover:bg-control-bg"
              onClick={() => setShowModal(true)}
            >
              <Maximize2 className="size-3" />
            </button>
          </div>
        )}
      </div>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-background rounded-sm shadow-lg flex flex-col"
            style={{
              width: "calc(100vw - 12rem)",
              height: "calc(100vh - 12rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-block-border">
              <h3 className="text-base font-medium text-main">备注详情</h3>
              <button
                className="p-1 hover:bg-control-bg rounded-full"
                onClick={() => setShowModal(false)}
              >
                <X className="size-4 text-control" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-sm whitespace-pre-wrap text-control">{remark}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface FundFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "create" | "edit";
  initialData?: FundFlow;
}

function FundFlowModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialData,
}: FundFlowModalProps) {
  const { pushNotification } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    transaction_date: getLocalDateTimeString(),
    item: "",
    amount: "",
    remark: "",
  });

  useEffect(() => {
    if (mode === "edit" && initialData) {
      const date = new Date(initialData.transaction_date);
      setFormData({
        transaction_date: getLocalDateTimeString(date),
        item: initialData.item,
        amount: String(initialData.amount),
        remark: initialData.remark || "",
      });
    } else {
      setFormData({
        transaction_date: getLocalDateTimeString(),
        item: "",
        amount: "",
        remark: "",
      });
    }
  }, [mode, initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item || !formData.amount) {
      pushNotification({ style: "error", title: "请填写必填字段" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        transaction_date: parseDateTimeToISO(formData.transaction_date),
        item: formData.item,
        amount: parseFloat(formData.amount),
        remark: formData.remark,
      };
      if (mode === "create") {
        await createFundFlow(payload);
      } else {
        await updateFundFlow(initialData!.id, payload);
      }
      pushNotification({
        style: "success",
        title: mode === "create" ? "创建成功" : "更新成功",
      });
      onSuccess();
      onClose();
    } catch {
      pushNotification({
        style: "error",
        title: mode === "create" ? "创建失败" : "更新失败",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-sm shadow-lg flex flex-col max-h-[calc(100vh-8rem)]"
        style={{ width: "32rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-block-border">
          <h3 className="text-base font-medium text-main">
            {mode === "create" ? "新建资金流水" : "编辑资金流水"}
          </h3>
          <button
            className="p-1 hover:bg-control-bg rounded-full"
            onClick={onClose}
          >
            <X className="size-4 text-control" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-y-4">
            <div>
              <label className="textlabel block">
                交易日期 <span className="text-error">*</span>
              </label>
              <div className="mt-2 flex gap-2">
                   <input
                     type="datetime-local"
                     value={formData.transaction_date}
                     onChange={(e) =>
                       setFormData({ ...formData, transaction_date: e.target.value })
                     }
                     className="flex-1 px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
                   />
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, transaction_date: getLocalDateTimeString() })
                  }
                  className="px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg hover:bg-control-bg-hover flex items-center gap-1"
                >
                  <Clock className="size-4" />
                  现在
                </button>
              </div>
            </div>
            <div>
              <label className="textlabel block">
                项目名称 <span className="text-error">*</span>
              </label>
                 <input
                   value={formData.item}
                   onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                   placeholder="例如：展会报名费"
                   className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
                 />
            </div>
            <div>
              <label className="textlabel block">
                金额 <span className="text-error">*</span>
              </label>
                 <input
                   type="number"
                   step="0.01"
                   value={formData.amount}
                   onChange={(e) =>
                     setFormData({ ...formData, amount: e.target.value })
                   }
                   placeholder="正数为收入，负数为支出"
                   className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
                 />
            </div>
            <div>
              <label className="textlabel block">备注</label>
               <textarea
                 value={formData.remark}
                 onChange={(e) =>
                   setFormData({ ...formData, remark: e.target.value })
                 }
                 placeholder="可选填写备注信息"
                 rows={3}
                 className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg resize-none"
               />
            </div>
          </div>
        </form>
        <div className="flex items-center justify-end gap-x-2 px-4 py-3 border-t border-block-border">
          <button
            type="button"
            onClick={onClose}
             className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 border border-control-border bg-control-bg hover:bg-control-bg-hover text-main"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors focus:outline-hidden h-9 px-4 bg-accent text-accent-text hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? "提交中..." : mode === "create" ? "创建" : "更新"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<FundFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FundFlow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FundFlow | null>(null);
  const { pushNotification } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function fetchFundFlows() {
      try {
        const flows = await listFundFlows();
        setData(flows);
        pushNotification({
          style: "success",
          title: "数据同步成功",
        });
      } catch {
        if (cancelled) return;
        pushNotification({
          style: "error",
          title: "数据同步失败",
          description: "请检查后端服务是否运行",
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchFundFlows();
    return () => {
      cancelled = true;
    };
  }, [pushNotification]);

  const filteredData = data.filter(
    (t) =>
      t.item.includes(searchQuery) ||
      t.remark?.includes(searchQuery) ||
      String(t.id).includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full relative">
        <LoadingOverlay />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
      <div className="px-4 pt-4 pb-4 flex items-center justify-between gap-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-control-light" />
           <input
             type="text"
             placeholder="搜索..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="w-full pl-9 pr-4 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
           />
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors focus:outline-hidden h-9 px-4 bg-accent text-accent-text hover:bg-accent-hover"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4" />
          新建交易
        </button>
      </div>

      {/* 移动端 Card 布局 */}
      <div className="flex-1 overflow-auto p-2 sm:hidden">
        <div className="grid grid-cols-1 gap-4">
          {filteredData.map((t) => (
            <div
              key={t.id}
              className="relative border border-block-border rounded-xs bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="absolute top-2 right-2 z-10">
                <ActionDropdown
                  actions={[
                    {
                      label: "编辑",
                      onClick: () => setEditTarget(t),
                    },
                    {
                      label: "删除",
                      danger: true,
                      onClick: () => setDeleteTarget(t),
                    },
                  ]}
                />
              </div>
              
              <div className="text-control-light text-xs mb-1">{formatDateTimeForDisplay(t.transaction_date)}</div>
              
              <h3 className="text-base font-medium text-main mb-2 pr-16">{t.item}</h3>
              
              <div className="flex justify-end">
                <span className={clsx("text-xl font-medium", t.amount >= 0 ? "text-red-600" : "text-green-600")}>
                  {t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString()}
                </span>
              </div>
              
              {t.remark && (
                <div className="pt-2 border-t border-block-border mt-2">
                  <p className="text-control-light text-sm">{t.remark}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 桌面端 Table 布局 */}
      <div className="hidden sm:block flex-1 overflow-auto">
        <div className="min-w-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-control-bg sticky top-0">
            <tr className="border-b border-block-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">交易日期</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">项目名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">金额</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">备注</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((t, idx) => (
              <tr
                key={t.id}
                className={clsx(
                  "border-b border-block-border",
                  idx % 2 === 1 && "bg-control-bg/50"
                )}
              >
                <td className="px-4 py-3 text-control whitespace-nowrap">{t.id}</td>
                <td className="px-4 py-3 text-control whitespace-nowrap">
                  {formatDateTimeForDisplay(t.transaction_date)}
                </td>
                <td className="px-4 py-3 text-control whitespace-nowrap">{t.item}</td>
                <td
                  className={clsx(
                    "px-4 py-3 font-medium whitespace-nowrap text-base",
                    t.amount >= 0 ? "text-red-600" : "text-green-600"
                  )}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-control relative">
                  <RemarkCell remark={t.remark} />
                </td>
                <td className="px-4 py-3">
                  <ActionDropdown
                    actions={[
                      {
                        label: "编辑",
                        onClick: () => setEditTarget(t),
                      },
                      {
                        label: "删除",
                        danger: true,
                        onClick: () => setDeleteTarget(t),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
      <FundFlowModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          const refreshData = async () => {
            try {
              const flows = await listFundFlows();
              setData(flows);
            } catch (err) {
              console.error("Failed to refresh:", err);
            }
          };
          refreshData();
        }}
        mode="create"
      />
      <FundFlowModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          const refreshData = async () => {
            try {
              const flows = await listFundFlows();
              setData(flows);
            } catch (err) {
              console.error("Failed to refresh:", err);
            }
          };
          refreshData();
        }}
        mode="edit"
        initialData={editTarget!}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="确认删除"
        description={`确定要删除 "${deleteTarget?.item}" 吗？此操作不可撤销。`}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteFundFlow(deleteTarget.id);
            pushNotification({ style: "success", title: "删除成功" });
            const flows = await listFundFlows();
            setData(flows);
          } catch {
            pushNotification({ style: "error", title: "删除失败" });
          }
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}