import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const directory = resolve(process.argv[2] || 'release');
const manifests = (await readdir(directory)).filter(name => /^update-.+\.json$/.test(name));
if (manifests.length) {
  const result = { version: '', notes: '', pub_date: new Date().toISOString(), platforms: {} };
  for (const name of manifests) {
    const manifest = JSON.parse(await readFile(join(directory, name), 'utf8'));
    if (result.version && result.version !== manifest.version) throw new Error('Updater versions differ');
    result.version = manifest.version;
    Object.assign(result.platforms, manifest.platforms);
  }
  await writeFile(join(directory, 'latest.json'), JSON.stringify(result, null, 2));
}
