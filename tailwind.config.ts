import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#F4F5F1',
        ink: '#14181F',
        muted: '#5B6270',
        line: '#E7E9E3',
        edge: '#B8BDC6',
        accent: '#C2410C',
        warn: '#9C3A07',
        warnbg: '#FFEDD5',
        ok: '#14532D',
        okbg: '#DCFCE7',
        bad: '#8A1C1C',
        badbg: '#FFE3E3',
        info: '#312E81',
        infobg: '#E0E7FF',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
