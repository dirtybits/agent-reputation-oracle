"use client";

import { SiSolana } from "react-icons/si";

export function SolAmount({
  amount,
  className = "",
  iconClassName = "w-3.5 h-3.5",
}: {
  amount: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`.trim()}>
      <SiSolana className={iconClassName} />
      <span>{amount} SOL</span>
    </span>
  );
}
