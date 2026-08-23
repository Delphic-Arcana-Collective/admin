"use client";

import { useCallback } from "react";
import { Toaster, toast } from "sonner";
import { X, Check, Plus, Minus } from "lucide-react";

export function useToast() {
  const pushNotification = useCallback(({
    style,
    title,
    description,
  }: {
    style: "success" | "error" | "warning" | "info";
    title: string;
    description?: string;
  }) => {
    const styles = {
      success: "bg-green-600",
      error: "bg-red-500",
      warning: "bg-yellow-500",
      info: "bg-blue-500",
    };

    const icons = {
      success: <Check className="w-3 h-3 text-white" strokeWidth={3} />,
      error: <X className="w-3 h-3 text-white" strokeWidth={3} />,
      warning: <Minus className="w-3 h-3 text-white" strokeWidth={3} />,
      info: <Plus className="w-3 h-3 text-white" strokeWidth={3} />,
    };

    toast.custom((t) => (
      <div
        className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-full"
        style={{ minWidth: '288px' }}
      >
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full ${styles[style]} flex items-center justify-center`}>
            {icons[style]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{title}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5 font-normal">{description}</p>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    ));
  }, []);

  return { pushNotification };
}

export function ToastBridge({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'transparent',
            boxShadow: 'none',
          },
        }}
      />
    </>
  );
}