import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-roboto-mono)', '"Roboto Mono"', 'monospace'],
        heading: ['var(--font-roboto-mono)', '"Roboto Mono"', 'monospace'],
        mono: ['var(--font-roboto-mono)', '"Roboto Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
