import { chromium } from 'playwright';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DURATION_MS = 40000;
const WIDTH = 1080;
const HEIGHT = 1920;
const htmlPath = path.join(__dirname, 'index.html');
const outDir = path.join(__dirname, 'output');
const mp4Path = path.join(__dirname, 'tconnect-cards-promo-40s.mp4');

fs.mkdirSync(outDir, { recursive: true });

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegInstaller.path, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

console.log('Launching browser…');
const browser = await chromium.launch({ headless: true });

const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: WIDTH, height: HEIGHT },
  },
});

const page = await context.newPage();
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

console.log('Loading promo page…');
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

console.log(`Recording ${DURATION_MS / 1000}s video…`);
await page.waitForTimeout(DURATION_MS);

const video = page.video();
const webmPath = video ? await video.path() : null;

await page.close();
await context.close();
await browser.close();

if (!webmPath || !fs.existsSync(webmPath)) {
  throw new Error('Video recording failed — no output file.');
}

console.log('Converting to MP4…');
const rawMp4 = path.join(__dirname, '_raw-promo.mp4');
await runFfmpeg([
  '-y',
  '-i', webmPath,
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  rawMp4,
]);

console.log('Trimming to exactly 40s…');
await runFfmpeg([
  '-y',
  '-i', rawMp4,
  '-t', '40',
  '-c:v', 'libx264',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  mp4Path,
]);

try { fs.unlinkSync(rawMp4); } catch { /* ignore */ }

try { fs.unlinkSync(webmPath); } catch { /* ignore */ }

const stats = fs.statSync(mp4Path);
console.log('');
console.log('Done!');
console.log(`File: ${mp4Path}`);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
