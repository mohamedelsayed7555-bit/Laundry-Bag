import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef0f6',
          100: '#d5d8e8',
          200: '#abb2d1',
          300: '#818bba',
          400: '#5765a3',
          500: '#3d4b89',
          600: '#2d3867',
          700: '#252e54',
          800: '#1e2544',
          900: '#161b33',
          950: '#0f1225',
        },
        primary: {
          50: '#e6f7f0',
          100: '#ccefdf',
          200: '#99dfbf',
          300: '#66cf9f',
          400: '#33bf7f',
          500: '#00af5f',
          600: '#008c4c',
          700: '#006939',
          800: '#004626',
          900: '#002313',
        },
        accent: {
          purple: '#7c5cfc',
          blue: '#3b82f6',
          orange: '#f59e0b',
          red: '#ef4444',
          cyan: '#06b6d4',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
