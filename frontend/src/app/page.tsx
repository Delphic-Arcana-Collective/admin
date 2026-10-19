"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { getDashboard, getMonthlyStats, type DashboardData, type MonthlyStat } from "@/lib/api";

function useCountUp(target: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }

    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = target * easeOut;

      setCount(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [target, duration]);

  return count;
}

// SVG 折线图组件
function LineChart({
  data,
  width = 400,
  height = 200,
}: {
  data: { label: string; income: number; expense: number }[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 16, bottom: 32, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // 找最大值
  let maxVal = 0;
  for (const d of data) {
    maxVal = Math.max(maxVal, d.income, Math.abs(d.expense ?? 0));
  }
  if (maxVal === 0) maxVal = 1;
  // 留 20% 空间,并向上取整到好看的刻度
  maxVal = Math.ceil((maxVal * 1.2) / 1000) * 1000;
  if (maxVal === 0) maxVal = 1000;

  const yScale = (v: number) =>
    padding.top + chartH - (v / maxVal) * chartH;

  const xStep = chartW / (data.length - 1);
  const xPos = (i: number) => padding.left + i * xStep;

  const incomePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xPos(i)},${yScale(d.income)}`)
    .join(" ");

  const expensePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xPos(i)},${yScale(Math.abs(d.expense ?? 0))}`)
    .join(" ");

  // Y 轴刻度线
  const ticks = 4;
  const yTicks = [];
  for (let i = 0; i <= ticks; i++) {
    const val = (maxVal / ticks) * i;
    const y = yScale(val);
    yTicks.push(val);
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      style={{ maxHeight: height }}
    >
      {/* 网格线 */}
      {yTicks.map((val, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={yScale(val)}
            x2={padding.left + chartW}
            y2={yScale(val)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={padding.left - 6}
            y={yScale(val) + 3}
            textAnchor="end"
            className="text-[10px] fill-gray-500"
          >
            ¥{(val / 1000).toFixed(0)}k
          </text>
        </g>
      ))}

      {/* X 轴标签 */}
      {data.map((d, i) => (
        <text
          key={i}
          x={xPos(i)}
          y={padding.top + chartH + 18}
          textAnchor="middle"
          className="text-[10px] fill-gray-500"
        >
          {d.label}
        </text>
      ))}

      {/* 收入折线（红） */}
      <path d={incomePath} fill="none" stroke="#ef4444" strokeWidth={2} />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xPos(i)}
          cy={yScale(d.income)}
          r={2.5}
          fill="#ef4444"
        />
      ))}

      {/* 支出折线（绿） */}
      <path d={expensePath} fill="none" stroke="#22c55e" strokeWidth={2} />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xPos(i)}
          cy={yScale(Math.abs(d.expense ?? 0))}
          r={2.5}
          fill="#22c55e"
        />
      ))}
    </svg>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const { pushNotification } = useToast();
  const animatedBalance = useCountUp(data?.total_balance || 0, 1000);

  // 获取资金总览数据
  useEffect(() => {
    let cancelled = false;
    async function fetchDashboard() {
      try {
        const dashboard = await getDashboard();
        if (cancelled) return;
        setData(dashboard);
      } catch {
        if (cancelled) return;
        pushNotification({
          style: "error",
          title: "获取数据失败",
          description: "请检查后端服务是否运行",
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchDashboard();
  }, [pushNotification]);

  // 获取月度统计
  useEffect(() => {
    let cancelled = false;
    async function fetchMonthlyStats() {
      try {
        const stats = await getMonthlyStats();
        if (cancelled) return;
        setMonthlyStats(stats);
      } catch {
        if (cancelled) return;
        pushNotification({
          style: "error",
          title: "获取月度统计失败",
          description: "请检查后端服务是否运行",
        });
      }
    }
    fetchMonthlyStats();
    return () => {
      cancelled = true;
    };
  }, [pushNotification]);

  // 构建图表数据：填充最近 12 个月
  const chartData = (() => {
    const now = new Date();
    const list: { label: string; income: number; expense: number }[] = [];
    const statsMap = new Map<string, MonthlyStat>();
    for (const s of monthlyStats) {
      statsMap.set(`${s.year}-${s.month}`, s);
    }
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const stat = statsMap.get(key);
      // 费用存的是负数，取绝对值显示
      list.push({
        label: `${d.getMonth() + 1}月`,
        income: stat?.income ?? 0,
        expense: stat ? Math.abs(stat.expense ?? 0) : 0,
      });
    }
    return list;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full relative">
        <LoadingOverlay />
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-2 sm:p-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-main mb-4">总览</h1>
      <div className="flex flex-wrap gap-4">
        {/* 资金盈余卡片 */}
        <div className="w-full max-w-md">
          <div className="border border-block-border rounded-xs p-3 sm:p-4">
            <div className="text-sm text-control mb-2">资金盈余</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-main">¥</span>
              <span className="text-[2rem] sm:text-[2.8rem] font-bold text-main">
                {animatedBalance >= 0 ? "+" : "-"}
                {Math.abs(animatedBalance).toLocaleString("zh-CN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-control-light">总收入</span>
                <span className="text-control font-medium">
                  ¥ {(data?.total_income ?? 0).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-control-light">总支出</span>
                <span className="text-control font-medium">
                  ¥ {(data?.total_expense ?? 0).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <div className="mt-3 text-xs text-control-light">
              最新流水产生时间：{formatDate(data?.last_flow_date || null)}
            </div>
          </div>
        </div>

        {/* 月度收支折线图卡片 */}
        <div className="w-full">
          <div className="border border-block-border rounded-xs p-3 sm:p-4">
            <div className="flex items-center gap-4 text-sm text-control mb-2">
              <span>月度收支</span>
              <span className="flex items-center gap-1 text-xs">
                <span className="w-3 h-0.5 inline-block bg-red-500" />
                收入
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="w-3 h-0.5 inline-block bg-green-500" />
                支出
              </span>
            </div>
            <LineChart data={chartData} />
          </div>
        </div>
      </div>
    </div>
  );
}
