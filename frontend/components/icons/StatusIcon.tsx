"use client";

import { STATUS_CONFIG, RegistrationStatusType } from "@/lib/icons";

interface StatusIconProps {
  status: RegistrationStatusType | string;
  showLabel?: boolean;
  size?: number;
  className?: string;
}

export default function StatusIcon({
  status,
  showLabel = true,
  size = 14,
  className = "",
}: StatusIconProps) {
  const normalizedStatus = (
    status in STATUS_CONFIG ? status : "pending"
  ) as RegistrationStatusType;
  const config = STATUS_CONFIG[normalizedStatus];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${config.badgeClass} ${className}`}
      role="status"
    >
      <Icon size={size} className="shrink-0" aria-hidden="true" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
