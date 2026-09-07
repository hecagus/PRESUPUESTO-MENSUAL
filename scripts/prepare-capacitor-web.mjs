import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'www');
const excluded = new Set([
  '.git',
  '.github',
  'android',
  'node_modules',
  'www',
  'scripts',
  'tests',
  'package.json',
  'package-lock.json',
  'capacitor.config.json',
  'README.md',
  'firestore.rules'
]);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  await cp(join(root, entry.name), join(out, entry.name), { recursive: true });
}

console.log('Web assets preparados en www/ para Capacitor.');
