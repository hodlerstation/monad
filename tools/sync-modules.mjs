import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [kind, target, ...args] = process.argv.slice(2);
const files = {
  frontend: ['wallet-provider.ts', 'dynamic-wallet-provider.tsx'],
  backend: [
    'mission-event-source.ts',
    'envio-mission-event-source.ts',
    'native-transfer.ts',
    'hypersync-reward-evidence.ts',
  ],
}[kind];
if (!files || !target)
  throw Error(
    'Usage: node tools/sync-modules.mjs frontend|backend /consumer [--check]',
  );
const destination = path.resolve(target, 'src/vendor/monad');
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(target, 'package.json'), 'utf8'),
);
if (
  !['hodlerstation-app', 'hodlerstation-backend', 'backend'].includes(pkg.name)
)
  throw Error('Unexpected consumer');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const hashes = {};
const readSource = (file) =>
  Buffer.from(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'));
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'modules'], {
  cwd: root, encoding: 'utf8',
}).trim();
if (dirty) throw Error('Commit module changes before pinning consumers');
for (const file of files) {
  const data = readSource(path.join(root, 'modules', file));
  hashes[file] = createHash('sha256').update(data).digest('hex');
  const dest = path.join(destination, file);
  if (args.includes('--check')) {
    if (!readSource(dest).equals(data))
      throw Error('Module drift: ' + file);
  } else {
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(dest, data);
  }
}
if (args.includes('--check')) {
  const source = JSON.parse(fs.readFileSync(path.join(destination, 'source.json'), 'utf8'));
  if (source.revision !== revision || JSON.stringify(source.files) !== JSON.stringify(hashes))
    throw Error('Consumer provenance mismatch');
}
if (!args.includes('--check'))
  fs.writeFileSync(
    path.join(destination, 'source.json'),
    JSON.stringify(
      { repository: 'hodlerstation/monad', revision, files: hashes },
      null,
      2,
    ) + '\n',
  );
console.log(
  kind + ' modules ' + (args.includes('--check') ? 'verified' : 'synchronized'),
);
