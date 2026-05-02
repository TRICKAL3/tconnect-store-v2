import fs from 'fs';
import path from 'path';

/** Load .env-style files without adding a dependency (no npm install needed for dev-server). */
function applyEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    if (process.env[key] !== undefined && process.env[key] !== '') continue;
    process.env[key] = val;
  }
}

const root = process.cwd();
applyEnvFile(path.join(root, '.env'));
applyEnvFile(path.join(root, 'backend', '.env'));
