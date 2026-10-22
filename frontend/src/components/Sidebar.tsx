"use client";

import {
  ChevronDown,
  ChevronRight,
  Activity,
  Server,
  Wallet,
  LayoutDashboard,
  Link2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { clsx } from "clsx";

interface SidebarItem {
  title?: string;
  name?: string;
  path?: string;
  icon?: React.ComponentType<{ className?: string }>;
  type: "route" | "div" | "divider";
  children?: SidebarItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const sidebarItems: SidebarItem[] = [
  {
    title: "总览",
    icon: LayoutDashboard,
    name: "dashboard",
    path: "/",
    type: "route",
  },
  {
    title: "活动",
    icon: Activity,
    name: "activities",
    path: "/activities",
    type: "route",
  },
  {
    title: "资金流水",
    icon: Wallet,
    name: "transactions",
    path: "/transactions",
    type: "route",
  },
  {
    type: "divider",
    name: "",
  },
  {
    title: "服务状态",
    icon: Server,
    name: "services",
    path: "/services",
    type: "route",
  },
  {
    title: "NFC 链接生成器",
    icon: Link2,
    name: "nfc",
    path: "/nfc",
    type: "route",
  },
];

function getItemClass(item: SidebarItem, currentPath: string): string[] {
  const isActive = item.path === currentPath;
  if (isActive) {
    return ["bg-gray-100", "router-link-active"];
  }
  return [];
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    return sidebarItems.filter((item) => {
      if (item.type === "divider") return true;
      if (item.children && item.children.length > 0) return true;
      return !!item.path;
    });
  }, []);

  const toggleExpand = (key: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderChildren = (children: SidebarItem[], parentIndex: number) => {
    return (
      <div className="flex flex-col gap-y-1 mt-1">
        {children.map((child, j) => {
          const classes = getItemClass(child, pathname);
          if (child.type === "route" && child.path) {
            return (
              <Link
                key={parentIndex + "-" + j}
                href={child.path}
                className={clsx(
                  "group w-full flex items-center pl-9 pr-2 py-1 outline-item mb-0.5 rounded-xs text-sm text-gray-700 hover:bg-gray-50",
                  classes.join(" ")
                )}
              >
                {child.title}
              </Link>
            );
          }
          return null;
        })}
      </div>
    );
  };

  const renderItem = (item: SidebarItem, index: number) => {
    const key = String(index);

    if (item.type === "divider") {
      return (
        <div
          key={index}
          className="border-t border-gray-300 my-2.5 mr-4 ml-2"
        />
      );
    }

    if (item.type === "route" && item.path) {
      const classes = getItemClass(item, pathname);
      const Icon = item.icon;
      return (
        <Link
          key={index}
          href={item.path}
          className={clsx(
            "group flex items-center px-2 py-1.5 leading-normal font-medium rounded-xs text-gray-700 outline-item text-sm hover:bg-gray-100 cursor-pointer",
            classes.join(" ")
          )}
        >
          {Icon && <Icon className="mr-2 w-5 h-5 text-gray-500" />}
          {item.title}
        </Link>
      );
    }

    if (item.type === "div") {
      const classes = getItemClass(item, pathname);
      const Icon = item.icon;
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedSet.has(key);

      return (
        <div key={index}>
          <div
            className={clsx(
              "group flex items-center px-2 py-1.5 leading-normal font-medium rounded-xs text-gray-700 outline-item text-sm hover:bg-gray-100 cursor-pointer",
              classes.join(" ")
            )}
            onClick={() => hasChildren && toggleExpand(key)}
          >
            {Icon && <Icon className="mr-2 w-5 h-5 text-gray-500" />}
            {item.title}
            {hasChildren && (
              <div className="ml-auto text-gray-500">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            )}
          </div>
          {hasChildren && isExpanded && renderChildren(item.children!, index)}
        </div>
      );
    }

    return null;
  };

  return (
    <nav className="relative h-full flex flex-col overflow-y-hidden border-r border-gray-200 bg-gray-50">
      <div className="p-2 shrink-0 m-auto">
        <div className="h-10 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-800">Delphic</span>
          <button
            onClick={onToggle}
            className={`absolute top-2 right-2 p-1 hover:bg-gray-200 rounded transition-all duration-300 cursor-pointer ${
              collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            aria-label="关闭侧边栏"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
      <div className={`flex-1 overflow-y-hidden px-2.5 pb-4 flex flex-col gap-y-1 transition-all duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
        {filteredItems.map((item, i) => renderItem(item, i))}
      </div>
    </nav>
  );
}