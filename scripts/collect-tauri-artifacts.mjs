import { cp, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'src-tauri/target/release/bundle');
const destination = resolve(root, 'release');
await mkdir(destination, { recursive: true });
let count = 0;
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.endsWith('.app')) await collect(path);
    } else if (/\.(exe|msi|dmg|AppImage|deb|rpm)$/.test(entry.name)) {
      await cp(path, join(destination, entry.name));
      console.log(entry.name);
      count++;
    }
  }
}
await collect(source);
if (!count) throw new Error('No Tauri installers were produced');
