"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { clsx } from "clsx";

interface ActionItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ActionDropdownProps {
  actions: ActionItem[];
}

export function ActionDropdown({ actions }: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1 hover:bg-control-bg rounded-xs text-control hover:text-control cursor-pointer"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[8rem] bg-background border border-control-border rounded-xs shadow-sm">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
                setOpen(false);
              }}
              className={clsx(
                "w-full px-3 py-2 text-left text-sm hover:bg-control-bg first:rounded-t-xs last:rounded-b-xs cursor-pointer",
                action.danger ? "text-error" : "text-control"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}