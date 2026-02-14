'use client';

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const { setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
    const storedTheme = localStorage.getItem('theme')
    if (storedTheme === 'light') {
      setIsDark(false)
      return
    }
    if (storedTheme === 'dark') {
      setIsDark(true)
      return
    }
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  if (!mounted) return null

  const toggleTheme = () => {
    const nextIsDark = !isDark
    const nextTheme = nextIsDark ? 'dark' : 'light'
    setIsDark(nextIsDark)
    document.documentElement.classList.toggle('dark', nextIsDark)
    localStorage.setItem('theme', nextTheme)
    setTheme(nextTheme)
  }

  return (
    <button
      onClick={toggleTheme}
      className="px-4 py-2 rounded-lg font-semibold transition bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-gray-300 dark:border-white/30"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
