import path from 'path';
import { config } from 'dotenv';

const backendEnv = path.join(__dirname, '..', '.env');
const rootEnv = path.join(__dirname, '..', '..', '.env');

// Root first (CRA / monorepo often puts DATABASE_URL only here).
// backend/.env second with override — wins for PORT, API_* and any local overrides.
config({ path: rootEnv });
config({ path: backendEnv, override: true });
