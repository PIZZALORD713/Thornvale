import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { minifyInlineCss, minifyProductionHtml } from '../vite.config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('production HTML minifies inline CSS without changing surrounding markup', () => {
  const input = [
    '<!doctype html>',
    '<style media="screen">',
    '  .card { color: #ff0000; padding: 0px 0px 0px 0px; }',
    '</style>',
    '<main data-story="day-one">Welcome</main>',
  ].join('\n');
  const output = minifyInlineCss(input);

  assert.ok(Buffer.byteLength(output) < Buffer.byteLength(input));
  assert.match(output, /<style media="screen">[^\n]+<\/style>/);
  assert.ok(output.endsWith('<main data-story="day-one">Welcome</main>'));
});

test('production HTML recovers at least 32 KiB by minifying the authored stylesheet', async () => {
  const input = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  const output = minifyInlineCss(input);

  assert.ok(
    Buffer.byteLength(input) - Buffer.byteLength(output) >= 32 * 1024,
    'inline CSS minification should preserve meaningful production-budget headroom',
  );
  assert.equal((output.match(/<style/g) || []).length, (input.match(/<style/g) || []).length);
  assert.equal((output.match(/<\/style>/g) || []).length, (input.match(/<\/style>/g) || []).length);
});

test('production HTML safely collapses inter-tag layout whitespace', async () => {
  const input = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  const cssOnly = minifyInlineCss(input);
  const output = minifyProductionHtml(input);

  assert.ok(
    Buffer.byteLength(cssOnly) - Buffer.byteLength(output) >= 1024,
    'HTML layout whitespace should provide at least 1 KiB of additional release headroom',
  );
  assert.equal((output.match(/<style/g) || []).length, (input.match(/<style/g) || []).length);
  assert.equal((output.match(/<script/g) || []).length, (input.match(/<script/g) || []).length);

  const protectedMarkup = '<main>Before</main>\n<pre>  keep\n    this  </pre>\n<textarea>  keep me  </textarea>';
  assert.match(minifyProductionHtml(protectedMarkup), /<pre>  keep\n    this  <\/pre>/);
  assert.match(minifyProductionHtml(protectedMarkup), /<textarea>  keep me  <\/textarea>/);
});
