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
for (const file of files) {
  const data = fs.readFileSync(path.join(root, 'modules', file));
  hashes[file] = createHash('sha256').update(data).digest('hex');
  const dest = path.join(destination, file);
  if (args.includes('--check')) {
    if (!fs.readFileSync(dest).equals(data))
      throw Error('Module drift: ' + file);
  } else {
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(dest, data);
  }
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
