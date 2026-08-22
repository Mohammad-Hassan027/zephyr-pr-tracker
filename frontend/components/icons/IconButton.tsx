"use client";

import { ComponentType } from "react";
import { LucideProps } from "lucide-react";

interface IconButtonProps {
  icon: ComponentType<LucideProps>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  size?: number;
  variant?: "default" | "brand" | "danger" | "ghost";
  className?: string;
}

export default function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  type = "button",
  size = 16,
  variant = "default",
  className = "",
}: IconButtonProps) {
  const variantClasses = {
    default:
      "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300",
    brand:
      "border border-brand-600 bg-brand-600 text-white hover:bg-brand-700",
    danger:
      "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300",
    ghost:
      "border-transparent bg-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${className}`}
    >
      <Icon size={size} aria-hidden="true" />
    </button>
  );
}
