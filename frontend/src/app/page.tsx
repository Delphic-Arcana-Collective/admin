"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { Cpu, MemoryStick, Gauge, Network } from "lucide-react";
import { API_BASE } from "@/config";
import { getDashboard, getMonthlyStats, type DashboardData, type MonthlyStat } from "@/lib/api";

interface SystemInfo {
  hostname: string;
  uptime: number;
  cpu_percent: number;
  memory_total: number;
  memory_used: number;
  memory_pct: number;
  disk_total: number;
  disk_used: number;
  disk_pct: number;
  net_sent: number;
  net_recv: number;
  net_sent_rate: number;
  net_recv_rate: number;
  timestamp: string;
}

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatBytesPerSec(bytesPerSec: number): string {
  if (bytesPerSec === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}天 ${h}小时`;
  if (h > 0) return `${h}小时 ${m}分`;
  return `${m}分钟`;
}

function GaugeBar({ pct, label }: { pct: number; label: string }) {
  const color =
    pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-control-light">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="w-14 text-right text-control font-medium tabular-nums">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// 网络速度实时波动图
function NetGraph({ sysInfo }: { sysInfo: SystemInfo | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ptsRef = useRef<{ recv: number; sent: number }[]>([]);
  const rafRef = useRef<number>(0);

  // 每次 sysInfo 更新时追加数据点
  useEffect(() => {
    if (!sysInfo) return;
    ptsRef.current = [
      ...ptsRef.current.slice(-59),
      { recv: sysInfo.net_recv_rate, sent: sysInfo.net_sent_rate },
    ];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pts = ptsRef.current;
    if (pts.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    let maxVal = 1;
    for (const p of pts) maxVal = Math.max(maxVal, p.recv, p.sent);

    const pad = 2;
    const drawW = w - pad * 2;
    const drawH = h - pad * 2;
    const stepX = drawW / (pts.length - 1);
    const toY = (v: number) => pad + drawH - (v / maxVal) * drawH;

    const color = "#4f46e5";

    // draw a smooth area+line for given key
    function drawSmoothR(ctx2: CanvasRenderingContext2D, arr: typeof pts) { var n = arr.length; if (n < 2) return; if (n === 2) { ctx2.lineTo(pad + stepX, toY(arr[1].recv)); return; } for (var i = 0; i < n - 1; i++) { var x0 = i > 0 ? pad + (i - 1) * stepX : pad; var y0 = i > 0 ? toY(arr[i - 1].recv) : toY(arr[0].recv); var x1 = pad + i * stepX, y1 = toY(arr[i].recv); var x2 = pad + (i + 1) * stepX, y2 = toY(arr[i + 1].recv); var x3 = i < n - 2 ? pad + (i + 2) * stepX : x2; var y3 = i < n - 2 ? toY(arr[i + 2].recv) : y2; var t = 0.3; ctx2.bezierCurveTo(x1+(x2-x0)*t, y1+(y2-y0)*t, x2-(x3-x1)*t, y2-(y3-y1)*t, x2, y2); } } function drawSmoothS(ctx2: CanvasRenderingContext2D, arr: typeof pts) { var n = arr.length; if (n < 2) return; if (n === 2) { ctx2.lineTo(pad + stepX, toY(arr[1].sent)); return; } for (var i = 0; i < n - 1; i++) { var x0 = i > 0 ? pad + (i - 1) * stepX : pad; var y0 = i > 0 ? toY(arr[i - 1].sent) : toY(arr[0].sent); var x1 = pad + i * stepX, y1 = toY(arr[i].sent); var x2 = pad + (i + 1) * stepX, y2 = toY(arr[i + 1].sent); var x3 = i < n - 2 ? pad + (i + 2) * stepX : x2; var y3 = i < n - 2 ? toY(arr[i + 2].sent) : y2; var t = 0.3; ctx2.bezierCurveTo(x1+(x2-x0)*t, y1+(y2-y0)*t, x2-(x3-x1)*t, y2-(y3-y1)*t, x2, y2); } }

    // recv 面积（紫色渐变）
    var grad = ctx.createLinearGradient(0, pad, 0, pad + drawH);
    grad.addColorStop(0, color + "80");
    grad.addColorStop(1, color + "05");
    ctx.beginPath();
    ctx.moveTo(pad, pad + drawH);
    drawSmoothR(ctx, pts);
    ctx.lineTo(pad + (pts.length - 1) * stepX, pad + drawH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // recv 曲线
    ctx.beginPath();
    drawSmoothR(ctx, pts);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // sent 面积（绿色渐变）
    var grad2 = ctx.createLinearGradient(0, pad, 0, pad + drawH);
    grad2.addColorStop(0, "#22c55e70");
    grad2.addColorStop(1, "#22c55e05");
    ctx.beginPath();
    ctx.moveTo(pad, pad + drawH);
    drawSmoothS(ctx, pts);
    ctx.lineTo(pad + (pts.length - 1) * stepX, pad + drawH);
    ctx.closePath();
    ctx.fillStyle = grad2;
    ctx.fill();

    // sent 曲线
    ctx.beginPath();
    drawSmoothS(ctx, pts);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [sysInfo]);

  const last = sysInfo;

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 text-xs text-control-light">
          <Network className="w-3.5 h-3.5" />
          <span>网络速度</span>
        </div>
        {last && (
          <div className="flex items-center gap-3 text-[11px] leading-none">
            <span className="text-[#4f46e5]">↓ {formatBytesPerSec(last.net_recv_rate)}</span>
            <span className="text-[#22c55e]">↑ {formatBytesPerSec(last.net_sent_rate)}</span>
          </div>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-16 rounded-xs"
        style={{ display: "block" }}
      />
    </div>
  );
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
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
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

  // WebSocket 连接 - 系统监控
  useEffect(() => {
    let wsUrl: string;
    if (API_BASE) {
      const protocol = API_BASE.startsWith("https") ? "wss" : "ws";
      const wsBase = API_BASE.replace(/^https?:\/\//, "");
      wsUrl = `${protocol}://${wsBase}/api/ws/monitor`;
    } else {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${location.host}/api/ws/monitor`;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      if (closed) return;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const info = JSON.parse(event.data) as SystemInfo;
          setSysInfo(info);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

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

        {/* 系统监控卡片 */}
        <div className="w-full max-w-md">
          <div className="border border-block-border rounded-xs p-3 sm:p-4">
            <div className="text-sm text-control mb-3">系统状态</div>
            {sysInfo ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-1 text-xs text-control-light mb-1">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>CPU</span>
                  </div>
                  <GaugeBar pct={sysInfo.cpu_percent} label="" />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-control-light mb-1">
                    <MemoryStick className="w-3.5 h-3.5" />
                    <span>内存</span>
                    <span className="text-control ml-auto">
                      {formatBytes(sysInfo.memory_used)} / {formatBytes(sysInfo.memory_total)}
                    </span>
                  </div>
                  <GaugeBar pct={sysInfo.memory_pct} label="" />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-control-light mb-1">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>硬盘</span>
                    <span className="text-control ml-auto">
                      {formatBytes(sysInfo.disk_used)} / {formatBytes(sysInfo.disk_total)}
                    </span>
                  </div>
                  <GaugeBar pct={sysInfo.disk_pct} label="" />
                </div>
                <NetGraph sysInfo={sysInfo} />
                <div className="pt-1 text-xs text-control-light flex gap-3">
                  <span>{sysInfo.hostname}</span>
                  <span>已运行 {formatUptime(sysInfo.uptime)}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-control-light">
                等待连接...
              </div>
            )}
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
