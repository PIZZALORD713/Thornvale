import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  minifyInlineCss,
  minifyProductionHtml,
  removeNonRuntimePublicDocs,
} from '../vite.config.js';

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

test('production packaging preserves runtime-declared provenance while omitting repository-only Markdown', async () => {
  const output = await mkdtemp(join(tmpdir(), 'thornvale-dist-'));
  try {
    const nested = join(output, 'friendsies', '8914');
    const unreferenced = join(output, 'village');
    await mkdir(nested, { recursive: true });
    await mkdir(unreferenced, { recursive: true });
    await writeFile(join(output, 'README.md'), 'repository guidance');
    await writeFile(join(nested, 'PROVENANCE.md'), 'source evidence');
    await writeFile(join(nested, 'body.glb'), 'runtime bytes');
    await writeFile(join(unreferenced, 'PROVENANCE.md'), 'repository-only evidence');

    await removeNonRuntimePublicDocs(output);

    await assert.rejects(access(join(output, 'README.md')), { code: 'ENOENT' });
    await assert.rejects(access(join(unreferenced, 'PROVENANCE.md')), { code: 'ENOENT' });
    assert.equal(await readFile(join(nested, 'PROVENANCE.md'), 'utf8'), 'source evidence');
    assert.equal(await readFile(join(nested, 'body.glb'), 'utf8'), 'runtime bytes');
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
