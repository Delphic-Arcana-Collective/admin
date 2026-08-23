"use client";

import Image from "next/image";

interface HeaderProps {
  sidebarCollapsed: boolean;
  onMenuClick: () => void;
}

export function Header({ sidebarCollapsed, onMenuClick }: HeaderProps) {
  return (
    <header className="h-10 px-3 sm:px-4 my-1 flex items-center justify-between border-b border-gray-200 bg-white">
      <div className="flex items-center gap-x-1 sm:gap-x-3">
        <button
          onClick={onMenuClick}
          className={`relative w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-all duration-300 cursor-pointer ${
            sidebarCollapsed ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-label="展开侧边栏"
        >
          <div className="relative w-5 h-4">
            <span className="absolute left-0 top-0 h-0.5 w-5 bg-gray-600 rounded" />
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-5 bg-gray-600 rounded" />
            <span className="absolute left-0 bottom-0 h-0.5 w-5 bg-gray-600 rounded" />
          </div>
        </button>
      </div>

      <div className="flex items-center gap-x-2">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
          <Image
            src="/delphic.png"
            alt="头像"
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
