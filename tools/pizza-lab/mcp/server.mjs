#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { createConnection } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DEFAULT_ADAPTER = resolve(ROOT, 'adapters/thornvale.json');

export const TOOL_DEFINITIONS = [
  {
    name: 'pizza_scene_inspect',
    description: 'Inspect the active Blender scene without changing it.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'pizza_scene_validate',
    description: 'Validate stable IDs, transforms, and project-required roots.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'pizza_object_transform',
    description: 'Preview or apply an exact object transform by stable game ID.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['gameId'],
      properties: {
        gameId: { type: 'string', minLength: 1 },
        location: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
        rotationEuler: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
        scale: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
        apply: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'pizza_transaction_undo',
    description: 'Restore the exact transform represented by a Pizza Lab undo token.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['undoToken'],
      properties: { undoToken: { type: 'string', minLength: 1 } },
    },
  },
  {
    name: 'pizza_terrain_contract',
    description: 'Inspect the project terrain-authority contract. Terrain mutation is unavailable in v0.1.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'pizza_stage_load',
    description: 'Load the allowlisted ThornVale staging GLB and current placements into Blender.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { replace: { type: 'boolean', default: false } },
    },
  },
  {
    name: 'pizza_stage_publish',
    description: 'Atomically publish editable Blender placements to the reviewed source candidate.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
];

const COMMANDS = new Map([
  ['pizza_scene_inspect', 'scene.inspect'],
  ['pizza_scene_validate', 'scene.validate'],
  ['pizza_object_transform', 'object.transform'],
  ['pizza_transaction_undo', 'transaction.undo'],
  ['pizza_terrain_contract', 'terrain.contract'],
  ['pizza_stage_load', 'stage.load'],
  ['pizza_stage_publish', 'stage.publish'],
]);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

export function validateToolArguments(name, args = {}) {
  const definition = TOOL_DEFINITIONS.find((tool) => tool.name === name);
  if (!definition) throw new Error(`Unknown Pizza Lab tool: ${name}`);
  assertObject(args, 'arguments');
  const schema = definition.inputSchema;
  const allowed = new Set(Object.keys(schema.properties || {}));
  for (const key of Object.keys(args)) if (!allowed.has(key)) throw new Error(`Unknown argument ${JSON.stringify(key)}`);
  for (const key of schema.required || []) if (!(key in args)) throw new Error(`${key} is required`);
  for (const key of ['location', 'rotationEuler', 'scale']) {
    if (!(key in args)) continue;
    if (!Array.isArray(args[key]) || args[key].length !== 3 || args[key].some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new Error(`${key} must contain exactly three finite numbers`);
    }
  }
  if ('apply' in args && typeof args.apply !== 'boolean') throw new Error('apply must be boolean');
  if ('replace' in args && typeof args.replace !== 'boolean') throw new Error('replace must be boolean');
  return args;
}

function interactiveRequest(request) {
  const host = process.env.PIZZA_LAB_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Pizza Lab only connects to localhost');
  const port = Number(process.env.PIZZA_LAB_PORT || 9877);
  const token = process.env.PIZZA_LAB_TOKEN || '';
  if (!token) throw new Error('PIZZA_LAB_TOKEN is required');
  return new Promise((resolvePromise, reject) => {
    const socket = createConnection({ host, port });
    let response = '';
    socket.setTimeout(Number(process.env.PIZZA_LAB_TIMEOUT_MS || 30000));
    socket.on('connect', () => socket.write(`${JSON.stringify({ ...request, token })}\n`));
    socket.on('data', (chunk) => { response += chunk.toString('utf8'); if (response.includes('\n')) socket.end(); });
    socket.on('timeout', () => socket.destroy(new Error('Pizza Lab bridge timed out')));
    socket.on('error', reject);
    socket.on('close', () => {
      try { resolvePromise(JSON.parse(response.trim())); } catch { reject(new Error('Pizza Lab returned invalid JSON')); }
    });
  });
}

async function headlessRequest(request) {
  const temp = await mkdtemp(join(tmpdir(), 'pizza-lab-'));
  const requestPath = join(temp, 'request.json');
  await writeFile(requestPath, JSON.stringify(request));
  const blender = process.env.PIZZA_LAB_BLENDER || '/Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender';
  const adapter = resolve(process.env.PIZZA_LAB_ADAPTER || DEFAULT_ADAPTER);
  const blendFile = process.env.PIZZA_LAB_BLEND_FILE ? resolve(process.env.PIZZA_LAB_BLEND_FILE) : null;
  const expression = [
    `import sys`,
    `sys.path.insert(0, ${JSON.stringify(resolve(ROOT, 'blender_addon'))})`,
    `from pizza_lab.headless import main`,
    `raise SystemExit(main())`,
  ].join(';');
  const args = ['--background'];
  if (blendFile) args.push(blendFile); else args.push('--factory-startup');
  args.push('--python-expr', expression, '--', '--adapter', adapter, '--request', requestPath);
  try {
    const output = await new Promise((resolvePromise, reject) => {
      execFile(blender, args, { maxBuffer: 4 * 1024 * 1024, timeout: 120000 }, (error, stdout, stderr) => {
        const line = `${stdout}\n${stderr}`.split(/\r?\n/).find((entry) => entry.startsWith('PIZZA_LAB_RESULT='));
        if (!line) return reject(error || new Error('Headless Blender returned no Pizza Lab result'));
        try { resolvePromise(JSON.parse(line.slice('PIZZA_LAB_RESULT='.length))); } catch { reject(new Error('Invalid headless Pizza Lab result')); }
      });
    });
    return output;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function callTool(name, args) {
  const payload = validateToolArguments(name, args);
  if (process.env.PIZZA_LAB_MODE === 'headless' && (
    (name === 'pizza_object_transform' && payload.apply === true)
    || name === 'pizza_transaction_undo'
    || name === 'pizza_stage_load'
    || name === 'pizza_stage_publish'
  )) {
    throw new Error('Pizza Lab v0.2 headless mode is read-only; use interactive mode for mutations');
  }
  const request = { command: COMMANDS.get(name), payload };
  return process.env.PIZZA_LAB_MODE === 'headless' ? headlessRequest(request) : interactiveRequest(request);
}

function respond(id, result, error = null) {
  const message = error
    ? { jsonrpc: '2.0', id, error: { code: -32000, message: error instanceof Error ? error.message : String(error) } }
    : { jsonrpc: '2.0', id, result };
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (message.method === 'initialize') {
    const supported = new Set(['2024-11-05', '2025-03-26']);
    const requested = message.params?.protocolVersion;
    if (!supported.has(requested)) {
      respond(message.id, null, new Error(`Unsupported MCP protocol version: ${requested}`));
      return;
    }
    respond(message.id, { protocolVersion: requested, capabilities: { tools: {} }, serverInfo: { name: 'pizza-lab', version: '0.2.0' } });
  } else if (message.method === 'tools/list') {
    respond(message.id, { tools: TOOL_DEFINITIONS });
  } else if (message.method === 'tools/call') {
    try {
      const value = await callTool(message.params?.name, message.params?.arguments || {});
      respond(message.id, { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError: !value?.ok });
    } catch (error) {
      respond(message.id, { content: [{ type: 'text', text: error.message }], isError: true });
    }
  } else if (message.id !== undefined && !message.method?.startsWith('notifications/')) {
    respond(message.id, null, new Error(`Unsupported method: ${message.method}`));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = createInterface({ input: process.stdin, terminal: false });
  input.on('line', (line) => {
    if (!line.trim()) return;
    try { void handle(JSON.parse(line)); } catch (error) { respond(null, null, error); }
  });
}
