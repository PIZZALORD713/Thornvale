import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist-story-archive',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
    rollupOptions: {
      input: resolve('story-archive/Preview/index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('/three/')) return 'three';
          return undefined;
        },
      },
    },
  },
});
