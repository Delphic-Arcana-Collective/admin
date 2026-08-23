package server

import (
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// HandleSystemMonitor streams system metrics over WebSocket at GET /api/ws/monitor.
func HandleSystemMonitor(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = conn.Close() }()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		info := collectSystemInfo()
		if err := conn.WriteJSON(info); err != nil {
			return
		}
	}
}

type SystemInfo struct {
	Hostname    string    `json:"hostname"`
	Uptime      uint64    `json:"uptime"`
	CPUPercent  float64   `json:"cpu_percent"`
	MemoryTotal uint64    `json:"memory_total"`
	MemoryUsed  uint64    `json:"memory_used"`
	MemoryPct   float64   `json:"memory_pct"`
	DiskTotal   uint64    `json:"disk_total"`
	DiskUsed    uint64    `json:"disk_used"`
	DiskPct     float64   `json:"disk_pct"`
	NetSent     uint64    `json:"net_sent"`
	NetRecv     uint64    `json:"net_recv"`
	NetSentRate float64   `json:"net_sent_rate"`
	NetRecvRate float64   `json:"net_recv_rate"`
	Timestamp   time.Time `json:"timestamp"`
}

var prevNetSent, prevNetRecv uint64
var prevNetTime time.Time

func collectSystemInfo() SystemInfo {
	info := SystemInfo{
		Timestamp: time.Now(),
	}

	hi, _ := host.Info()
	if hi != nil {
		info.Hostname = hi.Hostname
		info.Uptime = hi.Uptime
	}

	percents, _ := cpu.Percent(0, false)
	if len(percents) > 0 {
		info.CPUPercent = percents[0]
	}

	memInfo, _ := mem.VirtualMemory()
	if memInfo != nil {
		info.MemoryTotal = memInfo.Total
		info.MemoryUsed = memInfo.Used
		info.MemoryPct = memInfo.UsedPercent
	}

	dInfo, _ := disk.Usage("/")
	if dInfo != nil {
		info.DiskTotal = dInfo.Total
		info.DiskUsed = dInfo.Used
		info.DiskPct = dInfo.UsedPercent
	}

	netIOs, _ := net.IOCounters(false)
	if len(netIOs) > 0 {
		now := time.Now()
		info.NetSent = netIOs[0].BytesSent
		info.NetRecv = netIOs[0].BytesRecv

		if !prevNetTime.IsZero() {
			elapsed := now.Sub(prevNetTime).Seconds()
			if elapsed > 0 {
				info.NetSentRate = float64(netIOs[0].BytesSent-prevNetSent) / elapsed
				info.NetRecvRate = float64(netIOs[0].BytesRecv-prevNetRecv) / elapsed
			}
		}

		prevNetSent = netIOs[0].BytesSent
		prevNetRecv = netIOs[0].BytesRecv
		prevNetTime = now
	}

	return info
}
