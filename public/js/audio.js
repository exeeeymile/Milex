// Sonidos y música sintetizados con WebAudio (sin archivos de audio).
let ctx = null;
let master, sfxGain, musicGain;
let musicOn = true;
let musicTimer = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.55;
  sfxGain.connect(master);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

function tone({ freq = 440, to = null, dur = 0.15, type = 'sine', vol = 0.5, delay = 0, attack = 0.005, out = null }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(out || sfxGain);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.4, freq = 800, q = 1, type = 'lowpass', delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(sfxGain);
  src.start(t0);
}

export const sfx = {
  jump: (who) => tone({ freq: who === 'mile' ? 520 : 380, to: who === 'mile' ? 900 : 700, dur: 0.16, type: 'triangle', vol: 0.3 }),
  doubleJump: (who) => {
    tone({ freq: who === 'mile' ? 700 : 500, to: who === 'mile' ? 1300 : 1000, dur: 0.18, type: 'triangle', vol: 0.25 });
    noise({ dur: 0.18, vol: 0.12, freq: 3000, type: 'highpass' });
  },
  land: () => noise({ dur: 0.09, vol: 0.25, freq: 500 }),
  step: () => noise({ dur: 0.04, vol: 0.08, freq: 1400, type: 'bandpass', q: 2 }),
  pound: () => {
    tone({ freq: 160, to: 40, dur: 0.45, type: 'sine', vol: 0.8 });
    noise({ dur: 0.35, vol: 0.5, freq: 400 });
  },
  poundStart: () => tone({ freq: 300, to: 900, dur: 0.22, type: 'sawtooth', vol: 0.08 }),
  breakCrate: () => {
    noise({ dur: 0.4, vol: 0.55, freq: 1200, type: 'bandpass', q: 0.8 });
    tone({ freq: 120, to: 60, dur: 0.3, type: 'square', vol: 0.15 });
  },
  collect: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 660 * Math.pow(2, n / 12), dur: 0.2, type: 'triangle', vol: 0.22, delay: i * 0.055 })),
  lever: () => {
    tone({ freq: 220, to: 180, dur: 0.08, type: 'square', vol: 0.12 });
    tone({ freq: 880, dur: 0.12, type: 'sine', vol: 0.15, delay: 0.08 });
  },
  door: () => tone({ freq: 90, to: 140, dur: 0.6, type: 'sawtooth', vol: 0.06 }),
  plate: (on) => tone({ freq: on ? 520 : 390, dur: 0.1, type: 'square', vol: 0.08 }),
  boing: () => {
    tone({ freq: 180, to: 900, dur: 0.5, type: 'sine', vol: 0.4 });
    tone({ freq: 200, to: 600, dur: 0.35, type: 'triangle', vol: 0.15, delay: 0.05 });
  },
  glideOpen: () => noise({ dur: 0.2, vol: 0.18, freq: 2000, type: 'bandpass', q: 1.5 }),
  checkpoint: () => [0, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.35, type: 'sine', vol: 0.2, delay: i * 0.09 })),
  hurt: () => tone({ freq: 400, to: 150, dur: 0.35, type: 'square', vol: 0.12 }),
  hug: () => [0, 4, 7, 11, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.5, type: 'sine', vol: 0.15, delay: i * 0.08 })),
  wave: () => tone({ freq: 700, to: 1000, dur: 0.12, type: 'sine', vol: 0.12 }),
  victory: () => {
    const notes = [0, 4, 7, 12, 7, 12, 16, 19, 24];
    notes.forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.4, type: 'triangle', vol: 0.22, delay: i * 0.11 }));
  },
  partner: () => tone({ freq: 600, to: 800, dur: 0.15, type: 'sine', vol: 0.15 }),
};

// Música: progresión suave en loop con arpegio, bajo y pad.
const PROG = [
  [60, 64, 67, 71], // Cmaj7
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [55, 59, 62, 65], // G7
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function scheduleBar(barIndex, when) {
  const chord = PROG[barIndex % PROG.length];
  const beat = 0.42;
  // bajo
  tone({ freq: mtof(chord[0] - 24), dur: beat * 3.5, type: 'triangle', vol: 0.5, delay: when, attack: 0.02, out: musicGain });
  tone({ freq: mtof(chord[0] - 17), dur: beat * 1.8, type: 'triangle', vol: 0.3, delay: when + beat * 4, attack: 0.02, out: musicGain });
  // pad
  for (const n of chord) tone({ freq: mtof(n), dur: beat * 7.5, type: 'sine', vol: 0.08, delay: when, attack: 0.6, out: musicGain });
  // arpegio tipo caja de música
  const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
  pattern.forEach((p, i) => {
    if (barIndex % 2 === 1 && i === 7) return;
    tone({ freq: mtof(chord[p] + 12), dur: 0.35, type: 'triangle', vol: 0.22, delay: when + i * beat, out: musicGain });
  });
  if (barIndex % 4 === 3) tone({ freq: mtof(chord[3] + 24), dur: 0.6, type: 'sine', vol: 0.12, delay: when + beat * 6, out: musicGain });
  return beat * 8;
}

export function startMusic() {
  const c = ensure();
  if (!c || musicTimer) return;
  let bar = 0;
  const loop = () => {
    if (musicOn) scheduleBar(bar, 0.05);
    bar++;
    musicTimer = setTimeout(loop, 0.42 * 8 * 1000);
  };
  loop();
}

export function toggleMusic() {
  musicOn = !musicOn;
  if (musicGain) musicGain.gain.value = musicOn ? 0.16 : 0;
  return musicOn;
}
