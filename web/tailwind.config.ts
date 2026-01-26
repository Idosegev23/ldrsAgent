import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Leaders brand colors
        primary: {
          50: '#f0f4ff',
          100: '#e0e8ff',
          200: '#c7d4fe',
          300: '#a4b8fc',
          400: '#7b91f9',
          500: '#5a6cf2',
          600: '#4149e6',
          700: '#363ad4',
          800: '#2d32ab',
          900: '#2a3087',
          950: '#1c1d51',
        },
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        dark: {
          50: '#f6f6f9',
          100: '#ededf1',
          200: '#d7d8e0',
          300: '#b4b5c6',
          400: '#8b8da6',
          500: '#6c6f8b',
          600: '#565873',
          700: '#47485e',
          800: '#3d3e50',
          900: '#363745',
          950: '#16161d',
        }
      },
      fontFamily: {
        sans: ['var(--font-heebo)', 'Heebo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
