import { defineConfig } from 'vite';

export default defineConfig({
  // Root-relative build assets keep generator-style /fren/:token deep links
  // from looking for JavaScript under /fren/assets/.
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@dimforge/rapier3d-compat')) return 'rapier';
          if (id.includes('/three/')) return 'three';
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  server: {
    port: 3000,
    open: true,
  },
});
