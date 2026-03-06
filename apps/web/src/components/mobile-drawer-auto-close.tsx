"use client";

import { ReactNode } from "react";

export function MobileDrawerAutoClose({ children }: { children: ReactNode }) {
  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) {
          setTimeout(() => {
            history.replaceState(null, "", window.location.pathname + window.location.search);
          }, 50);
        }
      }}
    >
      {children}
    </div>
  );
}
