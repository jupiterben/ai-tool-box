import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'release');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await mkdir(output, { recursive: true });
const files = [];
function currentArtifact(name) {
  const binary = name.replace(/\.sig$/, '');
  if (process.platform === 'win32') return binary.includes(`_${pkg.version}_`) && /\.(exe|msi)$/.test(binary);
  if (process.platform === 'darwin') return binary.endsWith('.app.tar.gz') || (binary.includes(`_${pkg.version}_`) && binary.endsWith('.dmg'));
  return binary.includes(pkg.version) && /\.(AppImage|deb|rpm)$/.test(binary);
}
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.endsWith('.app')) await collect(path);
    } else if (currentArtifact(entry.name)) {
      await cp(path, join(output, entry.name));
      files.push(entry.name);
    }
  }
}
await collect(resolve(root, 'src-tauri/target/release/bundle'));
if (!files.some(name => /\.(exe|dmg|AppImage|deb)$/.test(name))) throw new Error('No Tauri installers were produced');
const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
const signature = files.find(name =>
  process.platform === 'win32' ? name.endsWith('.exe.sig') :
  process.platform === 'darwin' ? name.endsWith('.app.tar.gz.sig') : name.endsWith('.AppImage.sig'));
if (process.env.TAURI_SIGNING_PRIVATE_KEY && !signature) throw new Error('Missing signed updater artifact');
if (signature) {
  const binary = signature.slice(0, -4);
  const base = process.env.TAURI_RELEASE_DOWNLOAD_BASE ||
    `https://github.com/jupiterben/ai-tool-box/releases/download/v${pkg.version}`;
  await writeFile(join(output, `update-${os}-${arch}.json`), JSON.stringify({
    version: pkg.version,
    platforms: { [`${os}-${arch}`]: {
      signature: (await readFile(join(output, signature), 'utf8')).trim(),
      url: `${base}/${encodeURIComponent(binary)}`,
    } },
  }, null, 2));
}
console.log(files.join('\n'));
