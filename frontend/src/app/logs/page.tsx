"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { listAuditLogs, type AuditLog } from "@/lib/api";

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "-";
  // Strip microseconds (>3 fractional digits) but keep timezone for correct parsing
  const cleaned = dateStr.replace(/\.\d{4,}/, "");
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const methodColors: Record<string, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-orange-100 text-orange-700",
  DELETE: "bg-red-100 text-red-700",
};

function MethodBadge({ method }: { method: string }) {
  const colors = methodColors[method] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: number }) {
  let color = "bg-gray-100 text-gray-700";
  if (status >= 200 && status < 300) color = "bg-green-100 text-green-700";
  else if (status >= 300 && status < 400) color = "bg-yellow-100 text-yellow-700";
  else if (status >= 400) color = "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

export default function LogsPage() {
  const { pushNotification } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;

  useEffect(() => {
    let cancelled = false;
    async function fetchLogs() {
      setLoading(true);
      try {
        const result = await listAuditLogs(page, pageSize);
        setLogs(result.items);
        setTotal(result.total);
      } catch {
        if (cancelled) return;
        pushNotification({ style: "error", title: "获取日志失败" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLogs();
    return () => { cancelled = true; };
  }, [pushNotification, page]);

  const filteredLogs = logs.filter((log) =>
    log.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(log.status).includes(searchQuery) ||
    (log.ip || "").includes(searchQuery) ||
    (log.origin || "").includes(searchQuery)
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
      <div className="px-4 pt-4 pb-4 flex items-center justify-between gap-x-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-control-light" />
          <input
            type="text"
            placeholder="搜索路径、方法、IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
          />
        </div>
        <span className="text-sm text-control-light">
          {loading ? "加载中..." : `${total} 条记录`}
        </span>
      </div>

      {loading ? <LoadingOverlay /> : (
        <>
          {/* 移动端 Card 布局 */}
          <div className="flex-1 overflow-auto p-2 sm:hidden">
            <div className="grid grid-cols-1 gap-4">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {searchQuery ? "未找到日志" : "暂无日志"}
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-block-border rounded-xs bg-white p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MethodBadge method={log.method} />
                      <StatusBadge status={log.status} />
                      <span className="text-xs text-control-light ml-auto">{formatDateTime(log.created_at)}</span>
                    </div>
                    <p className="text-sm text-main font-mono break-all">{log.path}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-control-light">
                      <span>延时: <span className="font-medium">{log.latency_ms}ms</span></span>
                      {log.ip && <span>IP: {log.ip}</span>}
                      {log.origin && <span className="truncate max-w-[150px]">{log.origin}</span>}
                    </div>
                    {log.error && (
                      <p className="text-xs text-error mt-1 truncate">{log.error}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 桌面端 Table 布局 */}
          <div className="hidden sm:block flex-1 overflow-auto">
            <div className="min-w-[1000px]">
              <table className="w-full text-sm">
                <thead className="bg-control-bg sticky top-0">
                  <tr className="border-b border-block-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">路径</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">方法</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">状态码</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">延时</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">IP</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">来源</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">错误信息</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        {searchQuery ? "未找到日志" : "暂无日志"}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <tr
                        key={log.id}
                        className={idx % 2 === 1 ? "border-b border-block-border bg-control-bg/50" : "border-b border-block-border"}
                      >
                        <td className="px-4 py-3 text-control font-mono text-xs max-w-[200px] truncate" title={log.path}>{log.path}</td>
                        <td className="px-4 py-3">
                          <MethodBadge method={log.method} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-4 py-3 text-control whitespace-nowrap">{log.latency_ms}ms</td>
                        <td className="px-4 py-3 text-control text-xs">{log.ip || "-"}</td>
                        <td className="px-4 py-3 text-control-light text-xs max-w-[150px] truncate" title={log.origin}>{log.origin || "-"}</td>
                        <td className="px-4 py-3 text-error max-w-[150px] truncate" title={log.error}>{log.error || "-"}</td>
                        <td className="px-4 py-3 text-control-light whitespace-nowrap text-xs">{formatDateTime(log.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 分页 */}
          {!searchQuery && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-block-border">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-control-border rounded-xs text-sm bg-control-bg hover:bg-control-bg-hover disabled:opacity-50 active:scale-95"
              >
                上一页
              </button>
              <span className="text-sm text-control">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-control-border rounded-xs text-sm bg-control-bg hover:bg-control-bg-hover disabled:opacity-50 active:scale-95"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
