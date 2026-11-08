/* =========================================================
   BULLE — synchronise le numéro de version
   Source unique : version.json
   Utilisé par GitHub Actions avant le déploiement.
   ========================================================= */
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('version.json', 'utf8'));
const version = String(pkg.version || '').trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('version.json : version invalide (attendu x.y.z) →', version);
  process.exit(1);
}

function stamp(file, pattern, replacement) {
  const before = readFileSync(file, 'utf8');
  if (!pattern.test(before)) {
    console.error('Motif de version introuvable dans', file);
    process.exit(1);
  }
  const after = before.replace(pattern, replacement);
  writeFileSync(file, after, 'utf8');
}

stamp('js/core.js', /APP_VERSION\s*=\s*'[^']*'/, `APP_VERSION = '${version}'`);
stamp('sw.js', /const VERSION\s*=\s*'[^']*'/, `const VERSION = '${version}'`);

console.log('Bulle v' + version + ' prête à être déployée.');
