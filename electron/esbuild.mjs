import * as esbuild from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist-electron');
const sourcemap = process.env.ELECTRON_SOURCEMAP === '1';

await mkdir(outDir, { recursive: true });

const base = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap,
  external: ['electron'],
  logLevel: 'warning',
};

await esbuild.build({
  ...base,
  format: 'esm',
  entryPoints: [path.join(__dirname, 'main.ts')],
  outfile: path.join(outDir, 'main.mjs'),
});

await esbuild.build({
  ...base,
  format: 'cjs',
  entryPoints: [path.join(__dirname, 'preload.ts')],
  outfile: path.join(outDir, 'preload.cjs'),
});
