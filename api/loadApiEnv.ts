/**
 * Vercel serverless and `vercel dev` use `api/*` — they never run `backend/src/loadEnv.ts`.
 * Load repo `.env` files so PAYCHANGU_* and DATABASE_URL match local backend when testing /api.
 */
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

const root = process.cwd();
const rootEnv = path.join(root, '.env');
const backendEnv = path.join(root, 'backend', '.env');
if (fs.existsSync(rootEnv)) config({ path: rootEnv });
if (fs.existsSync(backendEnv)) config({ path: backendEnv, override: true });
