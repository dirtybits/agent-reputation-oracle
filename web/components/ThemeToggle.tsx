"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { IoSunnyOutline, IoMoonOutline } from "react-icons/io5";
import { navButtonInlineClass } from "@/lib/buttonStyles";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`${navButtonInlineClass} font-semibold transition bg-[var(--sea-accent-soft)] hover:bg-[var(--sea-accent-soft-hover)] text-[var(--sea-accent-strong)] border border-[var(--sea-accent-border)]`}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <IoSunnyOutline /> : <IoMoonOutline />}
    </button>
  );
}
