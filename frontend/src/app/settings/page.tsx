"use client";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-4 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6 text-accent" />
        系统设置
      </h1>
      <p className="text-sm text-gray-500">暂无配置项。AI 图片提取相关配置请在服务器端 `backend/config.yaml` 的 `ai` 段设置。</p>
    </div>
  );
}
