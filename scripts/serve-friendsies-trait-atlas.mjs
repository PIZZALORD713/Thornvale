#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const uiRoot = path.join(repositoryRoot, 'tools', 'friendsies-trait-atlas');
const dataRoot = path.join(repositoryRoot, 'assets-src', 'friendsies');
const host = '127.0.0.1';
const port = resolvePort(process.argv.slice(2), process.env.PORT);

const routes = new Map([
  ['/', route(path.join(uiRoot, 'index.html'), 'text/html; charset=utf-8')],
  ['/index.html', route(path.join(uiRoot, 'index.html'), 'text/html; charset=utf-8')],
  ['/app.js', route(path.join(uiRoot, 'app.js'), 'text/javascript; charset=utf-8')],
  ['/styles.css', route(path.join(uiRoot, 'styles.css'), 'text/css; charset=utf-8')],
  ['/trait-index.json', route(path.join(dataRoot, 'trait-index.json'), 'application/json; charset=utf-8')],
  ['/trait-curation.json', route(path.join(dataRoot, 'trait-curation.json'), 'application/json; charset=utf-8', true)],
  ['/trait-probes.json', route(path.join(dataRoot, 'trait-probes.json'), 'application/json; charset=utf-8', true)],
]);

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);

  if (!['GET', 'HEAD'].includes(request.method || '')) {
    sendJson(response, 405, { error: 'Method not allowed' }, request.method === 'HEAD');
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url || '/', `http://${host}:${port}`).pathname;
  } catch {
    sendJson(response, 400, { error: 'Invalid request URL' }, request.method === 'HEAD');
    return;
  }

  if (pathname === '/favicon.ico') {
    response.writeHead(204, { 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  const target = routes.get(pathname);
  if (!target) {
    sendJson(response, 404, { error: 'Not found' }, request.method === 'HEAD');
    return;
  }

  try {
    const body = await readFile(target.filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.byteLength,
      'Content-Type': target.contentType,
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      if (target.optional) {
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }
      sendJson(
        response,
        404,
        {
          error: `Required atlas file is missing: ${path.relative(repositoryRoot, target.filePath)}`,
        },
        request.method === 'HEAD',
      );
      return;
    }

    console.error(`[trait-atlas] Could not read ${target.filePath}:`, error);
    sendJson(response, 500, { error: 'Could not read local atlas data' }, request.method === 'HEAD');
  }
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`[trait-atlas] Port ${port} is already in use on localhost.`);
  } else {
    console.error('[trait-atlas] Server failed:', error);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`[trait-atlas] Local atlas: http://localhost:${port}`);
  console.log(`[trait-atlas] Index: ${path.relative(repositoryRoot, path.join(dataRoot, 'trait-index.json'))}`);
  console.log('[trait-atlas] Press Ctrl+C to stop.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

function route(filePath, contentType, optional = false) {
  return { filePath, contentType, optional };
}

function resolvePort(args, environmentPort) {
  let rawPort = environmentPort || '4174';
  const equalsArgument = args.find((argument) => argument.startsWith('--port='));
  const portIndex = args.indexOf('--port');

  if (equalsArgument) rawPort = equalsArgument.slice('--port='.length);
  if (portIndex >= 0 && args[portIndex + 1]) rawPort = args[portIndex + 1];

  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error(`[trait-atlas] Invalid port: ${rawPort}`);
    process.exit(1);
  }
  return parsed;
}

function setSecurityHeaders(response) {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: http: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

function sendJson(response, status, payload, headOnly = false) {
  const body = Buffer.from(`${JSON.stringify(payload)}\n`);
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': body.byteLength,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(headOnly ? undefined : body);
}
