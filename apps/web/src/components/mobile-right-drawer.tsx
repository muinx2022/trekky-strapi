"use client";

import { useEffect, useRef, useState } from "react";

export function MobileRightDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen for open event dispatched by the header logo button
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("open-right-drawer", handler);
    return () => document.removeEventListener("open-right-drawer", handler);
  }, []);

  // Close when any link inside is clicked
  const handlePanelClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) {
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 md:hidden" aria-modal="true" role="dialog">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
        aria-label="Đóng menu"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-[min(84%,22rem)] overflow-y-auto bg-white dark:bg-gray-900 p-4 shadow-2xl"
        onClick={handlePanelClick}
      >
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Đóng"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
