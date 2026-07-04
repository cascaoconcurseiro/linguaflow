/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#080c18',
        bg2:     '#0d1324',
        bg3:     '#111827',
        surface: 'rgba(17,24,39,0.9)',
        border:  'rgba(255,255,255,0.07)',
        accent:  '#38bdf8',
        accent2: '#818cf8',
        green:   '#4ade80',
        yellow:  '#fbbf24',
        red:     '#f87171',
        orange:  '#fb923c',
        text:    '#e2e8f0',
        text2:   '#94a3b8',
        text3:   '#64748b',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: {
        'fade-up': 'fadeUp 0.3s ease-out',
        'modal-in': 'modalIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
        'toast-in': 'toastIn 0.3s ease-out',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        modalIn: { from: { transform: 'scale(0.9) translateY(20px)', opacity: '0' }, to: { transform: 'scale(1) translateY(0)', opacity: '1' } },
        toastIn: { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
