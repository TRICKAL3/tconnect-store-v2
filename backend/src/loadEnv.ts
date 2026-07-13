import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

const backendDir = path.join(__dirname, '..');
const backendEnv = path.join(backendDir, '.env');
const rootEnv = path.join(backendDir, '..', '.env');

// backend/.env first for DATABASE_URL (live Neon), then root .env for CRA keys.
config({ path: backendEnv });
config({ path: rootEnv, override: true });
// Re-apply backend so DATABASE_URL / PAWAPAY_* from backend/.env always win over root .env
config({ path: backendEnv, override: true });

// If the process cwd is the repo root (or `backend/`), also load those .env files so PAYCHANGU_* etc.
// are picked up even when __dirname-based paths miss (nested folders, different launch cwd).
const cwd = process.cwd();
const cwdEnv = path.join(cwd, '.env');
const cwdBackendEnv = path.join(cwd, 'backend', '.env');
if (fs.existsSync(cwdEnv)) {
  config({ path: cwdEnv });
}
if (fs.existsSync(cwdBackendEnv)) {
  config({ path: cwdBackendEnv, override: true });
}
