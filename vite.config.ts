/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages の project pages 用に base path を設定する
export default defineConfig({
  base: '/logic-circuit-sim/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
