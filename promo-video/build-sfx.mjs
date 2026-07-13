import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = ffmpegInstaller.path;
const sfxDir = path.join(__dirname, 'sfx-cache');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `ffmpeg exit ${code}`));
    });
  });
}

const CLIPS = {
  chime: 'aevalsrc=0.22*sin(2*PI*784*t)*exp(-t*12)+0.18*sin(2*PI*988*t)*exp(-(t-0.06)*10):d=0.28',
  tap: 'aevalsrc=0.35*sin(2*PI*900*t)*exp(-t*40):d=0.05',
  copy: 'aevalsrc=0.28*sin(2*PI*1200*t)*exp(-t*25)+0.15*sin(2*PI*600*t)*exp(-(t-0.03)*18):d=0.1',
  type: 'aevalsrc=0.12*sin(2*PI*1400*t)*exp(-t*35):d=0.04',
  pay: 'aevalsrc=0.4*sin(2*PI*520*t)*exp(-t*18):d=0.12',
  success: 'aevalsrc=0.2*sin(2*PI*523*t)*exp(-t*5)+0.2*sin(2*PI*659*t)*exp(-(t-0.1)*5)+0.18*sin(2*PI*784*t)*exp(-(t-0.2)*4):d=0.55',
  swoosh: 'aevalsrc=0.1*sin(2*PI*(200+400*t)*t)*exp(-t*4):d=0.3',
  cta: 'aevalsrc=0.16*sin(2*PI*440*t)*exp(-t*3)+0.14*sin(2*PI*554*t)*exp(-(t-0.12)*4)+0.12*sin(2*PI*659*t)*exp(-(t-0.24)*5):d=0.65',
};

/** @param {number} durationSec */
export async function buildSoundtrack(durationSec, outPath) {
  fs.mkdirSync(sfxDir, { recursive: true });

  for (const [name, expr] of Object.entries(CLIPS)) {
    const wav = path.join(sfxDir, `${name}.wav`);
    if (!fs.existsSync(wav)) {
      await run(ffmpeg, [
        '-y', '-f', 'lavfi', '-i', expr,
        '-ar', '44100', '-ac', '1', wav,
      ]);
    }
  }

  const cues = [
    { file: 'swoosh.wav', ms: 300, vol: 0.6 },
    { file: 'tap.wav', ms: 1200, vol: 0.75 },
    { file: 'pay.wav', ms: 2800, vol: 0.8 },
    { file: 'success.wav', ms: 3600, vol: 0.95 },
    { file: 'tap.wav', ms: 5800, vol: 0.75 },
    { file: 'pay.wav', ms: 7200, vol: 0.8 },
    { file: 'success.wav', ms: 8200, vol: 0.95 },
    { file: 'tap.wav', ms: 10000, vol: 0.7 },
    { file: 'copy.wav', ms: 11200, vol: 0.85 },
    { file: 'type.wav', ms: 13800, vol: 0.45 },
    { file: 'type.wav', ms: 14100, vol: 0.4 },
    { file: 'tap.wav', ms: 15200, vol: 0.8 },
    { file: 'success.wav', ms: 16800, vol: 1 },
    { file: 'cta.wav', ms: 22000, vol: 1 },
  ];

  const inputs = ['-f', 'lavfi', '-i', `anoisesrc=d=${durationSec}:c=pink:a=0.008`];
  for (const cue of cues) {
    inputs.push('-i', path.join(sfxDir, cue.file));
  }

  const filters = ['[0]volume=0.35[bg]'];
  const mixInputs = ['[bg]'];

  cues.forEach((cue, i) => {
    const idx = i + 1;
    const label = `s${idx}`;
    filters.push(`[${idx}]adelay=${cue.ms}|${cue.ms},volume=${cue.vol}[${label}]`);
    mixInputs.push(`[${label}]`);
  });

  filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0,afade=t=out:st=${durationSec - 0.4}:d=0.4[aout]`);

  await run(ffmpeg, [
    '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[aout]',
    '-t', String(durationSec),
    '-c:a', 'aac',
    '-b:a', '192k',
    outPath,
  ]);
}
