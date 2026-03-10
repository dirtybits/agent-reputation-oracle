'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { IoSunnyOutline, IoMoonOutline } from 'react-icons/io5';
import { navButtonInlineClass } from '@/lib/buttonStyles';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`${navButtonInlineClass} font-semibold transition bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-gray-300 dark:border-white/30`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <IoSunnyOutline /> : <IoMoonOutline />}
    </button>
  );
}
