/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        creator: { DEFAULT: '#10b981', light: '#d1fae5', dark: '#065f46' },
        skeptic: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#78350f' },
        lateral: { DEFAULT: '#8b5cf6', light: '#ede9fe', dark: '#4c1d95' },
        summary: { DEFAULT: '#3b82f6', light: '#dbeafe', dark: '#1e3a8a' },
        root: { DEFAULT: '#1f2937', light: '#f9fafb', dark: '#111827' },
      },
    },
  },
  plugins: [],
};
