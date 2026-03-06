"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IconActionProps = {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
};

export function IconAction({
  label,
  icon,
  href,
  onClick,
  disabled,
  variant = "ghost",
  size = "icon-sm",
  className,
}: IconActionProps) {
  const baseClassName = cn(
    buttonVariants({ variant, size }),
    "relative",
    className,
  );

  return (
    <div className="inline-flex">
      {href ? (
        <Link href={href} aria-label={label} title={label} className={baseClassName}>
          <span className="inline-flex items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5">
            {icon}
          </span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={baseClassName}
        >
          <span className="inline-flex items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5">
            {icon}
          </span>
        </button>
      )}
    </div>
  );
}
