import { build } from 'esbuild';
import { copyFile, mkdir, chmod, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'src-tauri/sidecar');
await mkdir(out, { recursive: true });
await build({
  entryPoints: [resolve(root, 'desktop-backend/bootstrap.ts')],
  outfile: resolve(out, 'backend.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node24',
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
const binary = resolve(out, process.platform === 'win32' ? 'node.exe' : 'node');
await copyFile(process.execPath, binary);
await chmod(binary, 0o755);
let license;
for (const path of [
  resolve(dirname(process.execPath), 'LICENSE'),
  resolve(dirname(process.execPath), '../LICENSE'),
  resolve(dirname(process.execPath), '../share/doc/node/LICENSE'),
]) {
  try { license = await readFile(path); break; } catch { /* Try the next standard distribution path. */ }
}
if (!license) {
  const response = await fetch(`https://raw.githubusercontent.com/nodejs/node/v${process.versions.node}/LICENSE`);
  if (!response.ok) throw new Error('Cannot obtain the bundled Node.js license');
  license = Buffer.from(await response.arrayBuffer());
}
await writeFile(resolve(out, 'NODE-LICENSE.txt'), license);
execFileSync(process.execPath, [resolve(root, 'node_modules/@tauri-apps/cli/tauri.js'),
  'icon', resolve(root, 'resources/icon_1024.png')], { cwd: root, stdio: 'inherit' });
