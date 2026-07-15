import { defineConfig } from 'vite';
import { transform } from 'lightningcss';
import { readdir, rm } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { CURATED_FRIENDSIES_CAST } from './src/content/friendsies-cast.js';

export function minifyInlineCss(html) {
  return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attributes, css) => {
    const { code } = transform({
      filename: 'thornvale-inline.css',
      code: Buffer.from(css),
      minify: true,
      sourceMap: false,
    });
    return `<style${attributes}>${code.toString()}</style>`;
  });
}

export function minifyProductionHtml(html) {
  const preserved = [];
  const withPlaceholders = minifyInlineCss(html).replace(
    /<(pre|textarea)\b[\s\S]*?<\/\1>/gi,
    (block) => {
      const index = preserved.push(block) - 1;
      return `<thornvale-preserved-block data-index="${index}"></thornvale-preserved-block>`;
    },
  );
  const collapsed = withPlaceholders.replace(/>\s+</g, '> <').trim();
  return collapsed.replace(
    /<thornvale-preserved-block data-index="(\d+)"><\/thornvale-preserved-block>/g,
    (_match, index) => preserved[Number(index)],
  );
}

function inlineCssMinifier() {
  return {
    name: 'thornvale-inline-css-minifier',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: minifyProductionHtml,
  };
}

export const RUNTIME_PUBLIC_DOC_PATHS = new Set(
  Object.values(CURATED_FRIENDSIES_CAST)
    .map((entry) => entry.source?.provenancePath?.replace(/^\/+/, ''))
    .filter(Boolean),
);

export async function removeNonRuntimePublicDocs(
  directory,
  { root = directory, preserve = RUNTIME_PUBLIC_DOC_PATHS } = {},
) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await removeNonRuntimePublicDocs(entryPath, { root, preserve });
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const publicPath = relative(root, entryPath).replaceAll('\\', '/');
      if (!preserve.has(publicPath)) await rm(entryPath, { force: true });
    }
  }
}

function omitPublicDocsFromDeployment() {
  let outDir = null;
  return {
    name: 'thornvale-omit-public-docs',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      if (outDir) await removeNonRuntimePublicDocs(outDir);
    },
  };
}

export default defineConfig({
  // Root-relative build assets keep generator-style /fren/:token deep links
  // from looking for JavaScript under /fren/assets/.
  base: '/',
  plugins: [inlineCssMinifier(), omitPublicDocsFromDeployment()],
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
