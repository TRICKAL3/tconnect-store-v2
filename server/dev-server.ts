import './loadEnv';
import express from 'express';
import { app } from '../api/[...path]';

const PORT = Number(process.env.API_PORT || 4000);

const server = express();
// Match CRA proxy + browsers: frontend calls /api/*. Without this, localhost:4000/api/promotions would miss routes mounted at /promotions only.
server.use('/api', app);

server.listen(PORT, () => {
  console.log(`🚀 TConnect API listening on http://localhost:${PORT}/api`);
});

