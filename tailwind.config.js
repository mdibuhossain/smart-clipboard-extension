/**
 * tailwind.config.js
 *
 * Tailwind CSS configuration for Smart Clipboard Manager.
 * Defines theme tokens (custom palette, animations, fonts) and the file
 * paths Tailwind should scan for class usage.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx,html}',
    './src/popup/popup.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette — calm slate background, accent indigo & violet.
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        surface: {
          light: '#ffffff',
          DEFAULT: '#0f172a',
          muted: '#1e293b',
          ring: '#334155'
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace']
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pop: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' }
        }
      },
      animation: {
        fadeIn:  'fadeIn 180ms ease-out',
        slideUp: 'slideUp 220ms ease-out',
        pop:     'pop 150ms ease-out',
        shimmer: 'shimmer 1.4s linear infinite'
      },
      boxShadow: {
        soft:   '0 4px 20px -4px rgba(0,0,0,0.15)',
        glow:   '0 0 0 3px rgba(99,102,241,0.3)',
        cardLg: '0 10px 30px -10px rgba(0,0,0,0.4)'
      }
    }
  },
  plugins: []
};
