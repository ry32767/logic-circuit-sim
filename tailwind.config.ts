import type { Config } from 'tailwindcss';

// ダーク/ライトテーマは html 要素の `dark` クラスで切り替える
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        signal: {
          high: '#00e676',
          low: '#334155',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
