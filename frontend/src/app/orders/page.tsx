"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { ActionDropdown } from "@/components/ActionDropdown";
import { ConfirmModal } from "@/components/Modal";
import { listOrders, deleteOrder, type Order } from "@/lib/api";

function formatDateTimeForDisplay(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

const statusMap: Record<string, { label: string; class: string }> = {
  pending: { label: "待处理", class: "bg-yellow-100 text-yellow-800" },
  completed: { label: "已完成", class: "bg-green-100 text-green-800" },
  cancelled: { label: "已取消", class: "bg-gray-100 text-gray-800" },
};

export default function OrdersPage() {
  const { pushNotification } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      const orders = await listOrders();
      setOrders(orders);
    } catch {
      pushNotification({ style: "error", title: "获取订单失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      order.id.toString().includes(searchLower) ||
      order.order_items.some((item) =>
        item.product_name.toLowerCase().includes(searchLower)
      )
    );
  });

  const handleDelete = async (id: number) => {
    try {
      await deleteOrder(id);pushNotification({ style: "success", title: "订单已删除" });
      setShowDeleteConfirm(null);
      fetchOrders();
    } catch {
      pushNotification({ style: "error", title: "删除失败" });
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
      <div className="px-4 pt-4 pb-4 flex items-center justify-between gap-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-control-light" />
           <input
             type="text"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="w-full pl-9 pr-4 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
             placeholder="搜索订单号或商品名称..."
           />
        </div>
      </div>

      {/* 移动端 Card 布局 */}
      <div className="flex-1 overflow-auto p-2 sm:hidden">
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {search ? "未找到订单" : "暂无订单"}
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="relative border border-block-border rounded-xs bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div className="absolute top-2 right-2">
                  <ActionDropdown
                    actions={[
                      {
                        label: "删除",
                        danger: true,
                        onClick: () => setShowDeleteConfirm(order.id),
                      },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-main">订单 #{order.id}</span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      statusMap[order.status]?.class || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {statusMap[order.status]?.label || order.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mb-2">
                  {order.order_items.map((item) => `${item.product_name} x${item.quantity}`).join(", ")}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-accent font-medium">¥{isNaN(Number(order.total)) ? "0.00" : Number(order.total).toFixed(2)}</span>
                  <span className="text-gray-400">{formatDateTimeForDisplay(order.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 桌面端 Table 布局 */}
      <div className="hidden sm:block flex-1 overflow-auto">
        <div className="min-w-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-control-bg sticky top-0">
              <tr className="border-b border-block-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">订单号</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">商品</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">金额</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {search ? "未找到订单" : "暂无订单"}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className={`border-b border-control-border ${idx % 2 === 1 ? "bg-control-bg/50" : ""}`}
                  >
                    <td className="px-4 py-3 text-main whitespace-nowrap">#{order.id}</td>
                    <td className="px-4 py-3 text-control whitespace-nowrap">
                      {order.order_items.map((item) => `${item.product_name} x${item.quantity}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-accent font-medium whitespace-nowrap">
                      ¥{isNaN(Number(order.total)) ? "0.00" : Number(order.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          statusMap[order.status]?.class || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {statusMap[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {formatDateTimeForDisplay(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionDropdown
                        actions={[
                          {
                            label: "删除",
                            danger: true,
                            onClick: () => setShowDeleteConfirm(order.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        title="删除订单"
        description="确定要删除这个订单吗？此操作无法撤销。"
        confirmText="删除"
        onConfirm={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
        onClose={() => setShowDeleteConfirm(null)}
        danger
      />
    </div>
  );
}