import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@theme/vite';

// https://vite.dev/config/
export default defineConfig({
  base: "/academy-pwa/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  }
});
