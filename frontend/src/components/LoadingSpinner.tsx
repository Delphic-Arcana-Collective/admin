"use client";

import { clsx } from "clsx";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  className?: string;
}

const sizeMap = {
  small: 16,
  medium: 24,
  large: 32,
};

export function LoadingSpinner({ size = "medium", className }: LoadingSpinnerProps) {
  const s = sizeMap[size];
  return (
    <div
      className={clsx("animate-spin", className)}
      style={{
        width: s,
        height: s,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-full h-full"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="32"
          strokeDashoffset="12"
          className="opacity-25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="opacity-75"
        />
      </svg>
    </div>
  );
}

export function LoadingOverlay({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-white/50",
        className
      )}
    >
      <LoadingSpinner size="large" />
      <span className="text-sm text-control">加载中...</span>
    </div>
  );
}