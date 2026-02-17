/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        gray: {
          750: '#2a3544', // New mid-dark gray for depth
          850: '#1f2937', // Custom dark gray for subtle backgrounds
          900: '#111827', // Default dark
          950: '#030712', // Darker background
        },
        // Enhanced severity colors with better saturation and visibility
        severity: {
          calm: '#10b981', // Emerald - stable/good
          calmLight: '#6ee7b7',
          mild: '#0ea5e9', // Sky blue - mild pressure changes
          mildLight: '#38bdf8',
          moderate: '#f59e0b', // Amber - moderate changes
          moderateLight: '#fbbf24',
          rapid: '#ef4444', // Red - severe changes
          rapidLight: '#f87171',
        },
        // Accent colors for improved visual hierarchy
        accent: {
          primary: '#3b82f6', // Blue
          secondary: '#06b6d4', // Cyan
          tertiary: '#8b5cf6', // Violet
          success: '#10b981', // Emerald
          warning: '#f59e0b', // Amber
          danger: '#ef4444', // Red
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        }
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.15)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.15)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.15)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.15)',
      }
    },
  },
  plugins: [],
};
