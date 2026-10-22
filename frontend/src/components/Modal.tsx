"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, width = "32rem" }: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setAnimating(true);
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        opacity: animating ? 1 : 0,
        visibility: animating ? "visible" : "hidden",
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: animating ? "blur(4px)" : "blur(0px)",
        transition: "opacity 0.3s ease, visibility 0.3s ease"
      }}
      onClick={onClose}
    >
      <div
        className="bg-background rounded-sm shadow-lg flex flex-col max-h-[calc(100vh-8rem)]"
        style={{
          width,
          transform: animating ? "scale(1)" : "scale(0.95)",
          opacity: animating ? 1 : 0,
          transition: "transform 0.3s ease, opacity 0.3s ease"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-block-border">
          <h3 className="text-base font-medium text-main">{title}</h3>
          <button
            className="p-1 hover:bg-control-bg rounded-full active:scale-95 transition-transform cursor-pointer"
            onClick={onClose}
          >
            <X className="size-4 text-control" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-x-2 px-4 py-3 border-t border-block-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 border border-control-border bg-control-bg hover:bg-control-bg-hover text-main active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 active:scale-95 ${
              danger
                ? "bg-error hover:bg-error-hover text-white"
                : "bg-accent hover:bg-accent-hover text-accent-text"
            }`}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-control">{description}</p>
    </Modal>
  );
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onClear: () => void;
  onConfirm: () => void;
  hasSelection?: number;
}

export function FilterModal({ isOpen, onClose, title, children, onClear, onConfirm, hasSelection }: FilterModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClear}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 border border-control-border bg-control-bg hover:bg-control-bg-hover text-main active:scale-95"
          >
            清除
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 bg-accent hover:bg-accent-hover text-accent-text active:scale-95"
          >
            确定{hasSelection ? ` (${hasSelection})` : ""}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}