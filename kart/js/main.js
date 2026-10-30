// Milex Kart — carreras de karts 3D (Three.js). Jugable con teclado, táctil y joystick.
import * as THREE from 'three';

// ============================================================================
// Utilidades
// ============================================================================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const $ = (id) => document.getElementById(id);
const fmtTime = (t) => {
  if (!isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('milexkart.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('milexkart.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};

const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (IS_TOUCH) document.body.classList.add('touch');

// ============================================================================
// Datos: personajes, pistas, ítems
// ============================================================================
const CHARACTERS = [
  { id: 'exe', name: 'Exe', icon: '🧢', head: 'human', color: 0xe53935, accent: 0x1e3a8a, hat: 0xe53935, skin: 0xf2c48d, speed: 3, accel: 3, handling: 3, weight: 3 },
  { id: 'mile', name: 'Mile', icon: '🎀', head: 'girl', color: 0xec4fa0, accent: 0xffffff, hat: 0x8b4a1f, skin: 0xf6d2b0, speed: 3, accel: 4, handling: 3, weight: 2 },
  { id: 'rocco', name: 'Rocco', icon: '🐻', head: 'bear', color: 0x8d5524, accent: 0xffb300, hat: 0x6d3d14, skin: 0xa0682e, speed: 5, accel: 1, handling: 2, weight: 5 },
  { id: 'tina', name: 'Tina', icon: '🐰', head: 'rabbit', color: 0x7ec8ff, accent: 0xffffff, hat: 0xffffff, skin: 0xffffff, speed: 2, accel: 5, handling: 4, weight: 1 },
  { id: 'gus', name: 'Gus', icon: '🐸', head: 'frog', color: 0x43a047, accent: 0xffeb3b, hat: 0x66bb6a, skin: 0x66bb6a, speed: 2, accel: 4, handling: 5, weight: 2 },
  { id: 'luna', name: 'Luna', icon: '🐱', head: 'cat', color: 0x7e57c2, accent: 0xffd54f, hat: 0x9575cd, skin: 0x9575cd, speed: 3, accel: 3, handling: 4, weight: 2 },
  { id: 'bruno', name: 'Bruno', icon: '🤖', head: 'robot', color: 0x607d8b, accent: 0x00e5ff, hat: 0xb0bec5, skin: 0xb0bec5, speed: 4, accel: 2, handling: 2, weight: 4 },
  { id: 'kiki', name: 'Kiki', icon: '🐥', head: 'chick', color: 0xffc107, accent: 0xff7043, hat: 0xffeb3b, skin: 0xffeb3b, speed: 1, accel: 5, handling: 5, weight: 1 },
];

const TRACKS = [
  {
    id: 'pradera', name: 'Pradera Soleada', desc: 'Colinas verdes y curvas suaves',
    pts: [[0, 0], [100, 0], [170, -20], [200, -80], [170, -140], [100, -150], [60, -200], [0, -240], [-90, -230], [-150, -180], [-160, -100], [-120, -50], [-140, 10], [-90, 45]],
    theme: {
      skyTop: 0x2f7fe0, skyBottom: 0xbfe6ff, fog: 0xbfe6ff, ground: ['#4caf50', '#43a047', '#66bb6a'], groundBase: 0x4caf50,
      curb: ['#e53935', '#ffffff'], wall: 'tires', deco: 'trees', mountains: 0x5d9b4a, sun: 0xfff3d6, hemiGround: 0x3d6b2f,
    },
    music: 0,
  },
  {
    id: 'dunas', name: 'Dunas del Sol', desc: 'Desierto, cactus y pirámides',
    pts: [[0, 0], [150, 0], [230, 30], [260, 100], [210, 160], [130, 150], [85, 105], [30, 120], [-20, 170], [-100, 170], [-160, 110], [-150, 30], [-90, -10]],
    theme: {
      skyTop: 0x3b8fd9, skyBottom: 0xffe0a8, fog: 0xffe2b0, ground: ['#e9c27a', '#dcb36a', '#f1cf8d'], groundBase: 0xe2bb72,
      curb: ['#ff8f00', '#ffffff'], wall: 'sandstone', deco: 'cactus', mountains: 0xd29b55, sun: 0xffe7b8, hemiGround: 0xb98a45,
    },
    music: 1,
  },
  {
    id: 'nevado', name: 'Pico Nevado', desc: 'Pinos, nieve y curvas cerradas',
    pts: [[0, 0], [80, 0], [140, -40], [140, -110], [80, -140], [60, -200], [110, -260], [60, -320], [-30, -310], [-60, -240], [-130, -220], [-180, -160], [-150, -90], [-85, -85], [-50, -30]],
    theme: {
      skyTop: 0x6c8fc7, skyBottom: 0xe8f1ff, fog: 0xdfe9f7, ground: ['#f4f8ff', '#e6eef9', '#ffffff'], groundBase: 0xeef4fc,
      curb: ['#1e88e5', '#ffffff'], wall: 'ice', deco: 'pines', mountains: 0xb8c8e0, sun: 0xffffff, hemiGround: 0x9fb3cc, snow: true,
    },
    music: 2,
  },
  {
    id: 'neon', name: 'Ciudad Neón', desc: 'Noche, rascacielos y luces',
    pts: [[0, 0], [120, 0], [180, -30], [190, -110], [130, -150], [130, -210], [190, -260], [150, -320], [40, -320], [-40, -280], [-40, -200], [-110, -180], [-180, -200], [-220, -140], [-180, -60], [-90, -40], [-50, 10]],
    theme: {
      skyTop: 0x05031a, skyBottom: 0x3a1460, fog: 0x1d0d3a, ground: ['#1b1b2e', '#202036', '#17172a'], groundBase: 0x1c1c30,
      curb: ['#00e5ff', '#ff2bd6'], wall: 'neon', deco: 'city', mountains: 0x14102a, sun: 0x9f8cff, hemiGround: 0x221a44, night: true,
    },
    music: 3,
  },
];

const ITEMS = {
  turbo: { icon: '⚡' },
  triple: { icon: '⚡³' },
  oil: { icon: '🛢️' },
  missile: { icon: '🎯' },
  bomb: { icon: '💣' },
  shield: { icon: '🛡️' },
  star: { icon: '🌈' },
  storm: { icon: '🌩️' },
};
const ITEM_TABLES = [
  { oil: 34, bomb: 18, shield: 26, turbo: 16, missile: 6 },                                  // adelante
  { turbo: 20, triple: 14, missile: 24, oil: 10, bomb: 16, shield: 10, star: 6 },           // mitad
  { triple: 28, star: 22, missile: 16, storm: 12, turbo: 22 },                               // atrás
];
const CC = [
  { name: '50cc', mul: 0.86, ai: 0.88 },
  { name: '100cc', mul: 1.0, ai: 0.95 },
  { name: '150cc', mul: 1.14, ai: 1.0 },
];
const GP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
const TOTAL_LAPS = 3;
const ROAD_W = 18;
const HALF = ROAD_W / 2;
const CURB = 1.6;
const WALL = HALF + 7.5;
const TRACK_SCALE = 1.3;

// ============================================================================
// Audio (Web Audio, todo sintetizado)
// ============================================================================
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = [
  { bpm: 150, lead: 'square', mel: [72, 0, 76, 79, 0, 76, 72, 74, 76, 0, 74, 72, 69, 0, 67, 0, 72, 0, 76, 79, 0, 81, 79, 76, 74, 0, 76, 74, 72, 0, 0, 0], bass: [48, 48, 53, 55, 48, 48, 53, 55] },
  { bpm: 138, lead: 'sawtooth', mel: [62, 0, 63, 66, 67, 0, 66, 63, 62, 0, 0, 58, 60, 0, 62, 0, 62, 0, 63, 66, 67, 0, 69, 70, 69, 0, 67, 66, 63, 0, 62, 0], bass: [50, 50, 48, 46, 50, 50, 46, 48] },
  { bpm: 132, lead: 'triangle', mel: [69, 0, 72, 76, 74, 0, 72, 71, 72, 0, 69, 0, 64, 0, 0, 0, 65, 0, 69, 72, 71, 0, 69, 68, 69, 0, 0, 0, 76, 0, 74, 0], bass: [45, 45, 41, 41, 43, 43, 40, 45] },
  { bpm: 160, lead: 'sawtooth', mel: [64, 64, 67, 64, 71, 64, 69, 67, 64, 64, 67, 64, 72, 71, 69, 67, 64, 64, 67, 64, 71, 64, 74, 72, 71, 0, 69, 0, 67, 0, 66, 0], bass: [40, 40, 40, 40, 36, 36, 38, 38] },
  { bpm: 112, lead: 'square', mel: [67, 0, 72, 0, 76, 0, 74, 72, 74, 0, 71, 0, 67, 0, 0, 0, 65, 0, 69, 0, 72, 0, 71, 69, 67, 0, 0, 0, 0, 0, 0, 0], bass: [48, 48, 43, 43, 41, 41, 43, 43] },
];

class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = store.get('sound', true);
    this.song = -1;
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.enabled ? 0.8 : 0;
      this.master.connect(c.destination);
      this.music = c.createGain(); this.music.gain.value = 0.18; this.music.connect(this.master);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
      // ruido reutilizable
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // motor
      this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth';
      this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square';
      this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600;
      this.engGain = c.createGain(); this.engGain.gain.value = 0;
      this.engOsc.connect(this.engFilter); this.engOsc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.sfx);
      this.engOsc.start(); this.engOsc2.start();
      // derrape (chirrido)
      this.sq = c.createBufferSource(); this.sq.buffer = this.noiseBuf; this.sq.loop = true;
      this.sqFilter = c.createBiquadFilter(); this.sqFilter.type = 'bandpass'; this.sqFilter.frequency.value = 2600; this.sqFilter.Q.value = 6;
      this.sqGain = c.createGain(); this.sqGain.gain.value = 0;
      this.sq.connect(this.sqFilter); this.sqFilter.connect(this.sqGain); this.sqGain.connect(this.sfx);
      this.sq.start();
      this.seqTimer = setInterval(() => this.schedule(), 25);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setEnabled(on) {
    this.enabled = on;
    store.set('sound', on);
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }
  tone(freq, dur = 0.15, type = 'square', vol = 0.25, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur = 0.3, vol = 0.4, freq = 1200, sweep = 0, type = 'lowpass') {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + dur + 0.05);
  }
  play(name) {
    switch (name) {
      case 'beep': this.tone(440, 0.25, 'square', 0.3); break;
      case 'go': this.tone(880, 0.6, 'square', 0.3); break;
      case 'box': this.tone(660, 0.08, 'square', 0.2); this.tone(990, 0.12, 'square', 0.2, 0, 0.06); break;
      case 'tick': this.tone(1200 + Math.random() * 600, 0.03, 'square', 0.08); break;
      case 'got': this.tone(784, 0.1, 'triangle', 0.3); this.tone(1046, 0.15, 'triangle', 0.3, 0, 0.08); break;
      case 'boost': this.noise(0.6, 0.45, 400, 3000, 'bandpass'); this.tone(220, 0.5, 'sawtooth', 0.12, 660); break;
      case 'hop': this.tone(300, 0.08, 'square', 0.12, 500); break;
      case 'hit': this.noise(0.4, 0.5, 2000, 200); this.tone(500, 0.4, 'square', 0.15, 120); break;
      case 'bump': this.noise(0.15, 0.35, 600, 150); break;
      case 'boom': this.noise(0.9, 0.8, 1500, 60); this.tone(120, 0.6, 'sine', 0.5, 40); break;
      case 'shoot': this.noise(0.3, 0.3, 3000, 500, 'bandpass'); this.tone(900, 0.25, 'sawtooth', 0.1, 300); break;
      case 'drop': this.tone(200, 0.15, 'sine', 0.3, 90); break;
      case 'shield': this.tone(523, 0.1, 'triangle', 0.25); this.tone(784, 0.2, 'triangle', 0.25, 0, 0.08); break;
      case 'star': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.18, 0, i * 0.07)); break;
      case 'storm': this.noise(1.2, 0.7, 5000, 100, 'highpass'); this.tone(80, 1, 'sawtooth', 0.3, 30); break;
      case 'lap': [659, 784, 988].forEach((f, i) => this.tone(f, 0.14, 'square', 0.22, 0, i * 0.1)); break;
      case 'final': [784, 784, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.22, 0, i * 0.13)); break;
      case 'finish': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'square', 0.22, 0, i * 0.12)); break;
      case 'click': this.tone(880, 0.05, 'square', 0.12); break;
      case 'spark': this.tone(1500, 0.06, 'triangle', 0.1); break;
      default: break;
    }
  }
  engine(speed, maxSpeed, boosting, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = clamp(Math.abs(speed) / maxSpeed, 0, 1.4);
    const f = 55 + r * 120 + (boosting ? 40 : 0);
    this.engOsc.frequency.setTargetAtTime(f, t, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(400 + r * 1400, t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.07 + r * 0.06 : 0, t, 0.1);
  }
  squeal(on) {
    if (!this.ctx) return;
    this.sqGain.gain.setTargetAtTime(on ? 0.06 : 0, this.ctx.currentTime, 0.05);
  }
  playSong(i) {
    if (!this.ctx || this.song === i) return;
    this.song = i;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
  }
  stopSong() { this.song = -1; }
  schedule() {
    if (!this.ctx || this.song < 0) return;
    const s = SONGS[this.song];
    const stepDur = 60 / s.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step % 32, t = this.nextTime;
      const n = s.mel[i];
      if (n) this.musicNote(NOTE(n), stepDur * 0.9, s.lead, 0.22, t);
      if (i % 4 === 0) {
        const b = s.bass[(i / 4) | 0];
        this.musicNote(NOTE(b - 12), stepDur * 1.6, 'triangle', 0.5, t);
        this.musicNote(NOTE(b), stepDur * 0.8, 'triangle', 0.25, t + stepDur * 2);
      }
      if (i % 2 === 0) this.hat(t, i % 8 === 4 ? 0.25 : 0.08);
      this.nextTime += stepDur;
      this.step++;
    }
  }
  musicNote(freq, dur, type, vol, t) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.02);
  }
  hat(t, vol) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.music); s.start(t); s.stop(t + 0.06);
  }
}
const audio = new Audio();

// ============================================================================
// Render básico
// ============================================================================
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 1600);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  $('rotate-hint').classList.toggle('hidden', !(IS_TOUCH && h > w && !rotateDismissed));
}
let rotateDismissed = false;
window.addEventListener('resize', resize);

// ============================================================================
// Texturas procedurales (canvas)
// ============================================================================
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = MAX_ANISO;
  return t;
}
function speckle(g, w, h, colors, n) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = rand(0.2, 0.7);
    const s = rand(1, 4);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 1;
}
function roadTexture(night) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = night ? '#2a2a3a' : '#5b5d66';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, night ? ['#3a3a52', '#1d1d2b', '#4a4a66'] : ['#6c6e78', '#4c4e56', '#7a7c86'], 2500);
    g.fillStyle = night ? '#ff2bd6' : '#f5f5f5';
    g.fillRect(6, 0, 6, h); g.fillRect(w - 12, 0, 6, h);
    g.fillStyle = night ? 'rgba(0,229,255,.5)' : 'rgba(255,255,255,.35)';
    g.fillRect(w / 2 - 3, 0, 6, h / 2);
  });
}
function stripeTexture(a, b) {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = b; g.fillRect(0, h / 2, w, h / 2);
  });
}
function groundTexture(cols) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
    speckle(g, w, h, cols, 6000);
  });
}
function wallTexture(kind) {
  return canvasTex(128, 64, (g, w, h) => {
    if (kind === 'tires') {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? '#ffffff' : '#e53935';
        g.fillRect(i * 32, 0, 32, h);
      }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 10, w, 10);
    } else if (kind === 'sandstone') {
      g.fillStyle = '#c98f4f'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#a06a32'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < w; x += 32) g.strokeRect(x, y, 32, 16);
    } else if (kind === 'ice') {
      g.fillStyle = '#9fd3ff'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#e3f4ff' : '#5fb2f0'; g.fillRect(i * 32, 0, 32, h); }
    } else {
      g.fillStyle = '#0b0b1a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#00e5ff'; g.fillRect(0, 6, w, 6);
      g.fillStyle = '#ff2bd6'; g.fillRect(0, h - 14, w, 6);
    }
  });
}
function checkerTexture() {
  return canvasTex(128, 32, (g, w, h) => {
    const s = 16;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      g.fillStyle = ((x + y) / s) % 2 ? '#111' : '#fff';
      g.fillRect(x, y, s, s);
    }
  }, false);
}
function bannerTexture(text, bg, fg) {
  return canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = 'italic 900 64px Trebuchet MS, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  }, false);
}
const ITEMBOX_TEX = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h);
  ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'].forEach((c, i) => gr.addColorStop(i / 4, c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#fff'; g.strokeStyle = '#333'; g.lineWidth = 6;
  g.font = '900 96px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeText('?', w / 2, h / 2 + 6); g.fillText('?', w / 2, h / 2 + 6);
}, false);
const BOOST_TEX = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#ff6f00'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffeb3b';
  for (let i = 0; i < 2; i++) {
    const y = i * 32;
    g.beginPath(); g.moveTo(8, y + 28); g.lineTo(32, y + 6); g.lineTo(56, y + 28); g.lineTo(56, y + 18); g.lineTo(32, y - 4); g.lineTo(8, y + 18); g.closePath(); g.fill();
  }
});
const SHADOW_TEX = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false);
function windowsTexture() {
  return canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#141428'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12) for (let x = 6; x < w; x += 14) {
      const r = Math.random();
      g.fillStyle = r < 0.45 ? '#ffd86b' : r < 0.6 ? '#7ff3ff' : r < 0.68 ? '#ff7be8' : '#24243e';
      g.fillRect(x, y, 8, 6);
    }
  });
}

// ============================================================================
// Pista
// ============================================================================
class Track {
  constructor(def) {
    this.def = def;
    const curve = new THREE.CatmullRomCurve3(def.pts.map((p) => new THREE.Vector3(p[0] * TRACK_SCALE, 0, p[1] * TRACK_SCALE)), true, 'centripetal');
    this.length = curve.getLength();
    const N = (this.N = Math.round(this.length / 1.5));
    this.step = this.length / N;
    const pts = curve.getSpacedPoints(N);
    this.px = new Float32Array(N); this.pz = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    this.nx = new Float32Array(N); this.nz = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.px[i] = pts[i].x; this.pz[i] = pts[i].z; }
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz;
      this.nx[i] = dz; this.nz[i] = -dx; // normal (lado izquierdo/derecho consistente)
    }
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]);
      minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ };
    this.group = new THREE.Group();
    this.build();
  }
  wrap(i) { const N = this.N; return ((i % N) + N) % N; }
  heading(i) { i = this.wrap(i); return Math.atan2(this.tx[i], this.tz[i]); }
  // Busca el punto más cercano de la pista (local alrededor de "hint", global si hace falta)
  locate(x, z, hint = -1, out = {}) {
    let best = -1, bd = Infinity;
    const scan = (from, to, stride) => {
      for (let j = from; j <= to; j += stride) {
        const i = this.wrap(j);
        const dx = x - this.px[i], dz = z - this.pz[i];
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    };
    if (hint >= 0) scan(hint - 30, hint + 30, 1);
    if (hint < 0 || bd > 30 * 30) {
      scan(0, this.N - 1, 3);
      const c = best; bd = Infinity; scan(c - 4, c + 4, 1);
    }
    const i = best;
    out.idx = i;
    out.lat = (x - this.px[i]) * this.nx[i] + (z - this.pz[i]) * this.nz[i];
    const along = (x - this.px[i]) * this.tx[i] + (z - this.pz[i]) * this.tz[i];
    out.s = (i * this.step + along + this.length) % this.length;
    out.dist = Math.sqrt(bd);
    return out;
  }
  pointAt(s, lat, out = new THREE.Vector3()) {
    const f = (((s % this.length) + this.length) % this.length) / this.step;
    const i = Math.floor(f) % this.N, j = (i + 1) % this.N, t = f - Math.floor(f);
    const x = lerp(this.px[i], this.px[j], t), z = lerp(this.pz[i], this.pz[j], t);
    const nx = lerp(this.nx[i], this.nx[j], t), nz = lerp(this.nz[i], this.nz[j], t);
    return out.set(x + nx * lat, 0, z + nz * lat);
  }
  strip(off0, off1, vScale, mat, y0 = 0, y1 = 0, vertical = false) {
    const N = this.N;
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= N; k++) {
      const i = k % N;
      const v = (k * this.step) / vScale;
      if (vertical) {
        pos.push(this.px[i] + this.nx[i] * off0, y0, this.pz[i] + this.nz[i] * off0);
        pos.push(this.px[i] + this.nx[i] * off0, y1, this.pz[i] + this.nz[i] * off0);
      } else {
        pos.push(this.px[i] + this.nx[i] * off0, y0, this.pz[i] + this.nz[i] * off0);
        pos.push(this.px[i] + this.nx[i] * off1, y1, this.pz[i] + this.nz[i] * off1);
      }
      uv.push(0, v, 1, v);
      if (k < N) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    this.group.add(m);
    return m;
  }
  distToTrack(x, z) {
    let bd = Infinity;
    for (let i = 0; i < this.N; i += 2) {
      const d = (x - this.px[i]) ** 2 + (z - this.pz[i]) ** 2;
      if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
  }
  build() {
    const th = this.def.theme;
    const night = !!th.night;
    const Mat = (o) => (night ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o));
    // Suelo
    const b = this.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 900;
    const gtex = groundTexture(th.ground); gtex.repeat.set(size / 12, size / 12);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: gtex, color: night ? 0x777799 : 0xffffff }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.05, cz);
    this.group.add(ground);
    // Asfalto, cordones, muros
    this.strip(-HALF, HALF, 16, new THREE.MeshLambertMaterial({ map: roadTexture(night), color: night ? 0xb0b0d0 : 0xffffff }), 0.01, 0.01);
    const ct = stripeTexture(th.curb[0], th.curb[1]);
    const curbMat = night ? new THREE.MeshBasicMaterial({ map: ct }) : new THREE.MeshLambertMaterial({ map: ct });
    this.strip(HALF, HALF + CURB, 6, curbMat, 0.03, 0.08);
    this.strip(-HALF - CURB, -HALF, 6, curbMat, 0.08, 0.03);
    const wt = wallTexture(th.wall);
    const wallMat = Mat({ map: wt, side: THREE.DoubleSide });
    this.strip(WALL, WALL, 8, wallMat, 0, 1.4, true);
    this.strip(-WALL, -WALL, 8, wallMat, 0, 1.4, true);
    // Línea de largada + arco
    const chk = checkerTexture();
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 2.5), new THREE.MeshBasicMaterial({ map: chk }));
    line.rotation.x = -Math.PI / 2; line.rotation.z = this.heading(0);
    line.position.set(this.px[0], 0.04, this.pz[0]);
    this.group.add(line);
    const arch = new THREE.Group();
    const postMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    for (const sd of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9, 10), postMat);
      p.position.set(sd * (HALF + 2.5), 4.5, 0); arch.add(p);
    }
    const ban = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6, 2.6, 0.6), [
      postMat, postMat, postMat, postMat,
      new THREE.MeshBasicMaterial({ map: bannerTexture('MILEX KART', '#e53935', '#ffffff') }),
      new THREE.MeshBasicMaterial({ map: bannerTexture('MILEX KART', '#e53935', '#ffffff') }),
    ]);
    ban.position.y = 8.2; arch.add(ban);
    arch.position.set(this.px[0], 0, this.pz[0]);
    arch.rotation.y = this.heading(0);
    this.group.add(arch);
    // Cielo
    const skyGeo = new THREE.SphereGeometry(1200, 24, 16);
    const cols = [], top = new THREE.Color(th.skyTop), bot = new THREE.Color(th.skyBottom);
    const p = skyGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = clamp(p.getY(i) / 1200, 0, 1);
      const c = bot.clone().lerp(top, Math.pow(t, 0.6));
      cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.position.set(cx, 0, cz);
    this.group.add(this.sky);
    if (night) this.addStars(cx, cz);
    else this.addClouds(cx, cz);
    this.addMountains(cx, cz, size);
    this.addDecorations();
  }
  addStars(cx, cz) {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = rand(0.08, 1.3);
      pos[i * 3] = cx + Math.cos(a) * Math.cos(e) * 1100;
      pos[i * 3 + 1] = Math.sin(e) * 1100;
      pos[i * 3 + 2] = cz + Math.sin(a) * Math.cos(e) * 1100;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: false, fog: false })));
  }
  addClouds(cx, cz) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x888888, fog: false });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const cloud = new THREE.InstancedMesh(geo, mat, 90);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let k = 0;
    for (let c = 0; c < 18; c++) {
      const a = Math.random() * Math.PI * 2, r = rand(350, 800), h = rand(120, 260);
      const x0 = cx + Math.cos(a) * r, z0 = cz + Math.sin(a) * r;
      for (let j = 0; j < 5; j++) {
        v.set(x0 + rand(-30, 30), h + rand(-6, 6), z0 + rand(-30, 30));
        const sc = rand(14, 28); s.set(sc * 1.5, sc * 0.7, sc);
        m.compose(v, q, s); cloud.setMatrixAt(k++, m);
      }
    }
    this.group.add(cloud);
  }
  addMountains(cx, cz, size) {
    const th = this.def.theme;
    const mat = new THREE.MeshLambertMaterial({ color: th.mountains, flatShading: true });
    const n = 26;
    const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const R = size / 2 - 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
      const r = R + rand(-20, 40);
      const h = th.deco === 'city' ? rand(60, 160) : rand(80, 220);
      v.set(cx + Math.cos(a) * r, h / 2 - 2, cz + Math.sin(a) * r);
      s.set(rand(70, 140), h, rand(70, 140));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6));
      m.compose(v, q, s); mesh.setMatrixAt(i, m);
    }
    this.group.add(mesh);
    if (th.snow) {
      const cap = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n);
      for (let i = 0; i < n; i++) {
        mesh.getMatrixAt(i, m); m.decompose(v, q, s);
        v.y = v.y + s.y * 0.3; s.multiplyScalar(0.42);
        m.compose(v, q, s); cap.setMatrixAt(i, m);
      }
      this.group.add(cap);
    }
    if (th.deco === 'cactus') {
      // pirámides
      const pm = new THREE.MeshLambertMaterial({ color: 0xe0b46a, flatShading: true });
      for (let i = 0; i < 3; i++) {
        const py = new THREE.Mesh(new THREE.ConeGeometry(70 - i * 15, 80 - i * 18, 4), pm);
        const a = 0.6 + i * 0.35;
        py.position.set(cx + Math.cos(a) * (R - 120), (80 - i * 18) / 2, cz + Math.sin(a) * (R - 120));
        py.rotation.y = Math.PI / 4;
        this.group.add(py);
      }
    }
  }
  scatter(n, minDist, maxDist) {
    const b = this.bounds, out = [];
    let tries = 0;
    while (out.length < n && tries < n * 30) {
      tries++;
      const x = rand(b.minX - 120, b.maxX + 120), z = rand(b.minZ - 120, b.maxZ + 120);
      const d = this.distToTrack(x, z);
      if (d > minDist && d < maxDist) out.push([x, z]);
    }
    return out;
  }
  addDecorations() {
    const th = this.def.theme;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const place = (geo, mat, list, fn) => {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => { fn(p, v, s, q, i); m.compose(v, q, s); mesh.setMatrixAt(i, m); });
      this.group.add(mesh);
      return mesh;
    };
    const up = new THREE.Vector3(0, 1, 0);
    if (th.deco === 'trees' || th.deco === 'pines') {
      const pts = this.scatter(IS_TOUCH ? 170 : 260, WALL + 4, 150);
      const sz = pts.map(() => rand(0.8, 1.6));
      const pine = th.deco === 'pines';
      place(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), new THREE.MeshLambertMaterial({ color: 0x6d4c41 }), pts, (p, v, s, q, i) => {
        v.set(p[0], 1.5 * sz[i], p[1]); s.setScalar(sz[i]); q.identity();
      });
      const fol = pine ? new THREE.ConeGeometry(2.6, 7, 7) : new THREE.IcosahedronGeometry(3, 0);
      place(fol, new THREE.MeshLambertMaterial({ color: pine ? 0x2e6b4a : 0x2e9d3a, flatShading: true }), pts, (p, v, s, q, i) => {
        v.set(p[0], (pine ? 6 : 5) * sz[i], p[1]); s.setScalar(sz[i]); q.setFromAxisAngle(up, i);
      });
      if (pine) {
        place(new THREE.ConeGeometry(1.4, 2.6, 7), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), pts, (p, v, s, q, i) => {
          v.set(p[0], 8.6 * sz[i], p[1]); s.setScalar(sz[i]); q.setFromAxisAngle(up, i);
        });
        // muñecos de nieve
        const sm = this.scatter(14, WALL + 3, 30);
        const wm = new THREE.MeshLambertMaterial({ color: 0xffffff });
        place(new THREE.SphereGeometry(1.4, 10, 8), wm, sm, (p, v, s, q) => { v.set(p[0], 1.2, p[1]); s.setScalar(1); q.identity(); });
        place(new THREE.SphereGeometry(0.95, 10, 8), wm, sm, (p, v, s, q) => { v.set(p[0], 3.1, p[1]); s.setScalar(1); q.identity(); });
      } else {
        const fl = this.scatter(IS_TOUCH ? 120 : 220, WALL + 1.5, 60);
        const colors = [0xff5252, 0xffeb3b, 0xffffff, 0xe040fb];
        const mesh = place(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), fl, (p, v, s, q) => {
          v.set(p[0], 0.4, p[1]); s.setScalar(rand(0.6, 1.2)); q.identity();
        });
        fl.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(colors[i % colors.length])));
      }
    } else if (th.deco === 'cactus') {
      const pts = this.scatter(IS_TOUCH ? 110 : 170, WALL + 4, 150);
      const mat = new THREE.MeshLambertMaterial({ color: 0x3e9b4f, flatShading: true });
      const sz = pts.map(() => rand(0.8, 1.5));
      place(new THREE.CylinderGeometry(0.8, 0.9, 7, 8), mat, pts, (p, v, s, q, i) => { v.set(p[0], 3.5 * sz[i], p[1]); s.setScalar(sz[i]); q.identity(); });
      place(new THREE.CylinderGeometry(0.5, 0.5, 3, 8), mat, pts, (p, v, s, q, i) => {
        v.set(p[0] + 1.3 * sz[i], 4.5 * sz[i], p[1]); s.setScalar(sz[i]); q.identity();
      });
      const rocks = this.scatter(70, WALL + 3, 120);
      place(new THREE.DodecahedronGeometry(2, 0), new THREE.MeshLambertMaterial({ color: 0xb07a45, flatShading: true }), rocks, (p, v, s, q, i) => {
        v.set(p[0], 0.6, p[1]); s.set(rand(0.6, 1.8), rand(0.4, 1), rand(0.6, 1.8)); q.setFromAxisAngle(up, i);
      });
    } else if (th.deco === 'city') {
      const pts = this.scatter(IS_TOUCH ? 110 : 170, WALL + 8, 170);
      const wt = windowsTexture();
      const hs = pts.map(() => rand(15, 70));
      const mesh = place(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: wt }), pts, (p, v, s, q, i) => {
        const w = rand(10, 20);
        v.set(p[0], hs[i] / 2, p[1]); s.set(w, hs[i], w); q.setFromAxisAngle(up, rand(0, 3));
      });
      const tint = [0xffffff, 0xc8b8ff, 0xb8f0ff, 0xffd0f0];
      pts.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(tint[i % 4])));
      // faroles a lo largo de la pista
      const lamps = [];
      for (let i = 0; i < this.N; i += 18) lamps.push([this.px[i] + this.nx[i] * (WALL + 1), this.pz[i] + this.nz[i] * (WALL + 1)], [this.px[i] - this.nx[i] * (WALL + 1), this.pz[i] - this.nz[i] * (WALL + 1)]);
      place(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), new THREE.MeshBasicMaterial({ color: 0x333355 }), lamps, (p, v, s, q) => { v.set(p[0], 3.5, p[1]); s.setScalar(1); q.identity(); });
      const lm = place(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps, (p, v, s, q) => { v.set(p[0], 7.2, p[1]); s.setScalar(1); q.identity(); });
      lamps.forEach((_, i) => lm.setColorAt(i, new THREE.Color(i % 2 ? 0x00e5ff : 0xff2bd6)));
    }
  }
}

// ============================================================================
// Modelos de kart y personajes
// ============================================================================
function makeKart(ch) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const bodyMat = M(ch.color);
  const accMat = M(ch.accent);
  const dark = M(0x222222);
  const skinMat = M(ch.skin);
  const hatMat = M(ch.hat);
  const white = M(0xffffff);
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const body = new THREE.Group();
  g.add(body);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 2.7), bodyMat);
  chassis.position.y = 0.55; body.add(chassis);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.8), bodyMat);
  nose.position.set(0, 0.6, 1.55); nose.rotation.x = 0.25; body.add(nose);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 0.3), accMat);
  bumper.position.set(0, 0.45, 1.95); body.add(bumper);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.3), dark);
  seat.position.set(0, 1.05, -0.75); body.add(seat);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), accMat);
  wing.position.set(0, 1.3, -1.35); body.add(wing);
  for (const sx of [-0.7, 0.7]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.2), dark);
    st.position.set(sx, 1.05, -1.35); body.add(st);
  }
  const pipes = [];
  for (const sx of [-0.4, 0.4]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.6, 8), M(0x9e9e9e));
    p.rotation.x = Math.PI / 2; p.position.set(sx, 0.6, -1.5); body.add(p); pipes.push(p);
  }
  const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.38, 14);
  wheel.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8); hubGeo.rotateZ(Math.PI / 2);
  const wheels = [], front = [];
  for (const [x, z, f] of [[-0.95, 1.0, 1], [0.95, 1.0, 1], [-1.0, -0.95, 0], [1.0, -0.95, 0]]) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.42, z);
    const w = new THREE.Mesh(f ? wheel : wheel.clone().scale(1.15, 1.1, 1.1), dark);
    const hub = new THREE.Mesh(hubGeo, accMat);
    w.add(hub);
    holder.add(w);
    body.add(holder);
    wheels.push(w);
    if (f) front.push(holder);
  }
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 14), dark);
  steering.position.set(0, 1.15, 0.45); steering.rotation.x = -0.9; body.add(steering);
  // Piloto
  const driver = new THREE.Group();
  driver.position.set(0, 0.9, -0.35);
  body.add(driver);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.8, 10), accMat);
  torso.position.y = 0.4; driver.add(torso);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.8, 6), accMat);
    arm.position.set(sx * 0.35, 0.45, 0.4); arm.rotation.x = -1.2; arm.rotation.z = sx * 0.2; driver.add(arm);
  }
  const head = new THREE.Group();
  head.position.y = 1.15; driver.add(head);
  const hk = ch.head;
  const headMesh = hk === 'robot'
    ? new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.75), skinMat)
    : new THREE.Mesh(new THREE.SphereGeometry(hk === 'frog' ? 0.5 : 0.45, 14, 12), skinMat);
  if (hk === 'frog') headMesh.scale.set(1.15, 0.8, 1);
  head.add(headMesh);
  const eye = (x, y, z, r = 0.07) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), black);
    e.position.set(x, y, z); head.add(e);
  };
  if (hk === 'human' || hk === 'girl') {
    eye(-0.15, 0.05, 0.4); eye(0.15, 0.05, 0.4);
    if (hk === 'human') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
      cap.position.y = 0.05; head.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.4), hatMat);
      brim.position.set(0, 0.1, 0.45); head.add(brim);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), hatMat);
      hair.rotation.x = -0.35; head.add(hair);
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), hatMat);
      tail.position.set(0, 0.0, -0.55); tail.scale.set(1, 1.6, 1); head.add(tail);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.06, 6, 10), M(ch.color));
      bow.position.set(0, 0.3, -0.45); head.add(bow);
    }
  } else if (hk === 'bear' || hk === 'cat' || hk === 'rabbit') {
    eye(-0.15, 0.08, 0.4); eye(0.15, 0.08, 0.4);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), hk === 'bear' ? M(0xd7a86e) : white);
    snout.position.set(0, -0.1, 0.4); snout.scale.set(1.2, 0.8, 0.8); head.add(snout);
    eye(0, -0.05, 0.53, 0.05);
    for (const sx of [-1, 1]) {
      let ear;
      if (hk === 'bear') { ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), skinMat); ear.position.set(sx * 0.32, 0.38, 0); }
      else if (hk === 'cat') { ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 4), skinMat); ear.position.set(sx * 0.27, 0.45, 0); ear.rotation.z = -sx * 0.3; }
      else { ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 8), skinMat); ear.position.set(sx * 0.16, 0.7, -0.05); ear.rotation.z = -sx * 0.15; }
      head.add(ear);
    }
  } else if (hk === 'frog') {
    for (const sx of [-1, 1]) {
      const eb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), white);
      eb.position.set(sx * 0.25, 0.38, 0.2); head.add(eb);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), black);
      p.position.set(sx * 0.25, 0.4, 0.36); head.add(p);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 4, 12, Math.PI), black);
    mouth.position.set(0, -0.05, 0.45); mouth.rotation.z = Math.PI; head.add(mouth);
  } else if (hk === 'robot') {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.05), new THREE.MeshBasicMaterial({ color: ch.accent }));
    visor.position.set(0, 0.05, 0.39); head.add(visor);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), dark);
    ant.position.y = 0.55; head.add(ant);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff1744 }));
    bulb.position.y = 0.78; head.add(bulb);
  } else if (hk === 'chick') {
    eye(-0.15, 0.1, 0.4); eye(0.15, 0.1, 0.4);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), M(0xff7043));
    beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.05, 0.5); head.add(beak);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), skinMat);
    tuft.position.y = 0.5; head.add(tuft);
  }
  // Sombra
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06;
  g.add(shadow);
  // Fuego de turbo
  const flame = new THREE.Group();
  for (const sx of [-0.4, 0.4]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xff9800, transparent: true, opacity: 0.85 }));
    f.rotation.x = -Math.PI / 2; f.position.set(sx, 0.6, -2.3); flame.add(f);
    const fi = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xfff59d }));
    fi.rotation.x = -Math.PI / 2; fi.position.set(sx, 0.6, -2.1); flame.add(fi);
  }
  flame.visible = false;
  body.add(flame);
  // Escudo
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.1, 18, 14), new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.28, depthWrite: false }));
  shield.position.y = 1; shield.visible = false;
  g.add(shield);
  return { group: g, body, wheels, front, flame, shield, bodyMat, driver };
}

// ============================================================================
// Partículas
// ============================================================================
class Particles {
  constructor(max, size, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3).fill(-9999);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: additive ? 1 : 0.7,
    }));
    this.points.frustumCulled = false;
    this.additive = additive;
  }
  emit(x, y, z, vx, vy, vz, color, life, grav = 0) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = _col.set(color);
    this.base[i * 3] = c.r; this.base[i * 3 + 1] = c.g; this.base[i * 3 + 2] = c.b;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -9999; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.additive ? this.life[i] / this.maxLife[i] : 1;
      this.col[i * 3] = this.base[i * 3] * f; this.col[i * 3 + 1] = this.base[i * 3 + 1] * f; this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.pos.fill(-9999); }
}
const _col = new THREE.Color();
const sparks = new Particles(IS_TOUCH ? 500 : 900, 0.45, true);
const dust = new Particles(IS_TOUCH ? 250 : 450, 1.1, false);
const DRIFT_COLORS = [0xfff3a0, 0x3fb8ff, 0xff9d2e, 0xd36bff];

// ============================================================================
// Kart (física arcade)
// ============================================================================
class Kart {
  constructor(ch, isPlayer) {
    this.ch = ch;
    this.isPlayer = isPlayer;
    const m = makeKart(ch);
    Object.assign(this, { mesh: m.group, parts: m });
    this.input = { accel: false, brake: false, steer: 0, drift: false, item: false };
    this.ai = isPlayer ? null : { lane: rand(-4, 4), phase: rand(0, 10), hold: 0, stuck: 0, skill: 1 };
  }
  reset(track, s, lat, cc) {
    this.track = track;
    const p = track.pointAt(s, lat);
    const loc = track.locate(p.x, p.z);
    this.x = p.x; this.z = p.z; this.y = 0; this.vy = 0;
    this.h = track.heading(loc.idx);
    this.speed = 0;
    this.idx = loc.idx; this.lat = loc.lat;
    this.s = loc.s; this.lap = 0; this.maxS = 0;
    this.progress = this.s - track.length;
    this.finished = false; this.finishTime = Infinity; this.place = 1;
    this.drift = 0; this.driftT = 0; this.driftLvl = 0; this.driftHeld = false; this.hopDir = 0;
    this.boostT = 0; this.spinT = 0; this.spinAng = 0; this.starT = 0; this.shrinkT = 0; this.shieldT = 0;
    this.item = null; this.itemCount = 0; this.rollT = 0; this.rollItem = null;
    this.offroad = false; this.wrongT = 0; this.lapStart = 0; this.lapTimes = [];
    this.rocket = 0; this.firstAccelT = -1;
    const st = this.ch;
    this.maxSpeed = (34.5 + st.speed * 1.1) * CC[cc].mul;
    this.accelRate = (11 + st.accel * 3.2) * CC[cc].mul;
    this.turnRate = 1.5 + st.handling * 0.11;
    this.mass = 1 + st.weight * 0.3;
    this.maxMul = 1;
    if (this.ai) { this.ai.lane = rand(-4.5, 4.5); this.ai.hold = 0; this.ai.stuck = 0; }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.set(0, this.h, 0);
    this.mesh.scale.setScalar(1);
  }
  get forwardX() { return Math.sin(this.h); }
  get forwardZ() { return Math.cos(this.h); }
  boost(t) {
    this.boostT = Math.max(this.boostT, t);
    if (this.isPlayer) audio.play('boost');
  }
  hit(kind = 'spin') {
    if (this.starT > 0) return false;
    if (this.shieldT > 0) { this.shieldT = 0; if (this.isPlayer) audio.play('shield'); return false; }
    this.spinT = kind === 'boom' ? 1.6 : 1.15;
    this.speed *= 0.3;
    this.drift = 0; this.driftT = 0; this.driftLvl = 0;
    this.boostT = 0;
    if (kind === 'boom') this.vy = 9;
    for (let i = 0; i < 14; i++) sparks.emit(this.x, this.y + 1.5, this.z, rand(-6, 6), rand(3, 8), rand(-6, 6), 0xffee58, 0.6, 12);
    if (this.isPlayer || race.isNear(this)) audio.play('hit');
    return true;
  }
  update(dt, race) {
    const inp = this.input;
    const control = race.phase === 'race' && this.spinT <= 0;
    // temporizadores
    this.boostT = Math.max(0, this.boostT - dt);
    this.starT = Math.max(0, this.starT - dt);
    this.shrinkT = Math.max(0, this.shrinkT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    if (this.spinT > 0) { this.spinT -= dt; this.spinAng += dt * 14; if (this.spinT <= 0) this.spinAng = 0; }
    let max = this.maxSpeed * this.maxMul;
    if (this.shrinkT > 0) max *= 0.72;
    if (this.starT > 0) max *= 1.18;
    const boosting = this.boostT > 0 || this.starT > 0;
    if (this.offroad && !boosting) max *= 0.48;
    if (this.boostT > 0) max *= 1.38;
    if (control) {
      if (inp.accel && !inp.brake) {
        if (this.speed < max) this.speed = Math.min(max, this.speed + this.accelRate * dt * (this.speed < 0 ? 3 : 1) * (1 - 0.45 * clamp(this.speed / max, 0, 1)));
        if (this.boostT > 0) this.speed = Math.min(max, this.speed + 70 * dt);
      } else if (inp.brake) {
        if (this.speed > 0) this.speed = Math.max(0, this.speed - 42 * dt);
        else this.speed = Math.max(-13, this.speed - 16 * dt);
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
      }
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), (this.spinT > 0 ? 30 : 8) * dt);
    }
    if (this.speed > max) this.speed = Math.max(max, this.speed - 28 * dt);
    // salto / derrape
    const onGround = this.y <= 0.001;
    if (control && inp.drift && !this.driftHeld && onGround) {
      this.vy = 5.5; this.hopDir = 0;
      if (this.isPlayer) audio.play('hop');
    }
    if (!onGround && Math.abs(inp.steer) > 0.3 && this.hopDir === 0) this.hopDir = Math.sign(inp.steer);
    if (control && inp.drift && !this.drift && onGround && this.speed > 14) {
      const dir = this.hopDir || (Math.abs(inp.steer) > 0.5 ? Math.sign(inp.steer) : 0);
      if (dir) { this.drift = dir; this.driftT = 0; this.driftLvl = 0; }
    }
    this.driftHeld = inp.drift;
    if (this.drift && (!inp.drift || this.speed < 10 || !control)) {
      if (this.driftLvl > 0 && control) {
        this.boost([0, 0.7, 1.2, 1.8][this.driftLvl]);
      }
      this.drift = 0; this.driftT = 0; this.driftLvl = 0;
    }
    // giro
    const turn = this.turnRate * (1 - 0.22 * clamp(this.speed / this.maxSpeed, 0, 1.3));
    if (control) {
      if (this.drift) {
        const rel = clamp(inp.steer * this.drift, -1, 1);
        this.h -= this.drift * (0.95 + 0.55 * rel) * turn * dt;
        if (!this.offroad) this.driftT += dt * (1 + 0.7 * Math.max(0, rel));
        const lvl = this.driftT > 3.1 ? 3 : this.driftT > 1.9 ? 2 : this.driftT > 0.85 ? 1 : 0;
        if (lvl > this.driftLvl && this.isPlayer) audio.play('spark');
        this.driftLvl = lvl;
      } else {
        const spdF = clamp(Math.abs(this.speed) / 10, 0, 1) * Math.sign(this.speed || 1);
        this.h -= inp.steer * turn * spdF * dt;
      }
    }
    // movimiento
    this.x += Math.sin(this.h) * this.speed * dt;
    this.z += Math.cos(this.h) * this.speed * dt;
    this.vy -= 26 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y <= 0) this.vy = 0;
    // pista
    const loc = this.track.locate(this.x, this.z, this.idx, _loc);
    this.idx = loc.idx; this.lat = loc.lat;
    const lim = WALL - 1.1;
    if (Math.abs(loc.lat) > lim) {
      const sg = Math.sign(loc.lat), push = Math.abs(loc.lat) - lim;
      this.x -= this.track.nx[loc.idx] * sg * push;
      this.z -= this.track.nz[loc.idx] * sg * push;
      const th = this.track.heading(loc.idx);
      const fwd = Math.abs(angDiff(this.h, th)) < Math.PI / 2 ? th : th + Math.PI;
      if (Math.abs(this.speed) > 8) {
        if (this.isPlayer) audio.play('bump');
        this.speed *= 0.7;
      }
      this.h += angDiff(this.h, fwd) * 0.25;
    }
    this.offroad = Math.abs(loc.lat) > HALF + CURB && this.y < 0.2;
    // vueltas
    const L = this.track.length;
    const prevS = this.s;
    this.s = loc.s;
    if (prevS > L * 0.75 && this.s < L * 0.25) {
      if (this.lap === 0 || this.maxS > L * 0.5) {
        this.lap++; this.maxS = 0;
        race.onLap(this);
      } else this.lap++;
    } else if (prevS < L * 0.25 && this.s > L * 0.75) {
      this.lap--;
    }
    if (this.lap >= 1 && this.s < L * 0.9) this.maxS = Math.max(this.maxS, this.s);
    this.progress = (this.lap - 1) * L + this.s;
    // sentido contrario
    const th = this.track.heading(loc.idx);
    if (this.isPlayer && race.phase === 'race' && Math.abs(angDiff(this.h, th)) > 2.1 && this.speed > 4) this.wrongT += dt; else this.wrongT = 0;
    // efectos
    this.updateFx(dt);
  }
  updateFx(dt) {
    const m = this.mesh, p = this.parts;
    m.position.set(this.x, this.y, this.z);
    const visYaw = this.h - this.drift * 0.42 + this.spinAng;
    m.rotation.y = visYaw;
    const sc = this.shrinkT > 0 ? 0.6 : 1;
    m.scale.setScalar(lerp(m.scale.x, sc, 0.15));
    const steerVis = this.drift ? -this.drift * 0.4 : -this.input.steer * 0.45;
    for (const f of p.front) f.rotation.y = steerVis;
    for (const w of p.wheels) w.rotation.x += this.speed * dt / 0.42;
    p.body.rotation.z = lerp(p.body.rotation.z, (this.drift ? this.drift * 0.12 : this.input.steer * 0.06) * clamp(this.speed / 20, 0, 1), 0.2);
    p.body.rotation.x = lerp(p.body.rotation.x, this.boostT > 0 ? -0.06 : 0, 0.2);
    p.flame.visible = this.boostT > 0;
    if (p.flame.visible) p.flame.scale.z = rand(0.7, 1.3);
    p.shield.visible = this.shieldT > 0;
    if (this.starT > 0) {
      p.bodyMat.emissive.setHSL((performance.now() / 300) % 1, 1, 0.45);
    } else p.bodyMat.emissive.setRGB(0, 0, 0);
    // partículas
    const fx = Math.sin(this.h), fz = Math.cos(this.h), rx = Math.cos(this.h), rz = -Math.sin(this.h);
    if (this.drift && this.y < 0.1) {
      const col = DRIFT_COLORS[this.driftLvl];
      for (const sd of [-1, 1]) {
        if (Math.random() < (this.driftLvl ? 0.9 : 0.35)) {
          const bx = this.x - fx * 1.1 + rx * sd * 1.0, bz = this.z - fz * 1.1 + rz * sd * 1.0;
          sparks.emit(bx, 0.3, bz, rand(-3, 3) - fx * 4, rand(2, 5), rand(-3, 3) - fz * 4, col, 0.3, 14);
        }
      }
    }
    if (this.boostT > 0 && Math.random() < 0.8) {
      sparks.emit(this.x - fx * 2.4 + rand(-0.4, 0.4), this.y + 0.6, this.z - fz * 2.4 + rand(-0.4, 0.4), -fx * 6, rand(0, 2), -fz * 6, Math.random() < 0.5 ? 0xff9800 : 0xffeb3b, 0.25);
    }
    if (this.starT > 0 && Math.random() < 0.6) {
      _col.setHSL(Math.random(), 1, 0.6);
      sparks.emit(this.x + rand(-1.2, 1.2), this.y + rand(0.3, 2), this.z + rand(-1.2, 1.2), 0, 2, 0, _col.getHex(), 0.4);
    }
    if (this.offroad && Math.abs(this.speed) > 8 && Math.random() < 0.6) {
      dust.emit(this.x - fx * 1.4 + rand(-1, 1), 0.4, this.z - fz * 1.4 + rand(-1, 1), rand(-1, 1), rand(1, 3), rand(-1, 1), race.track.def.theme.groundBase, 0.6, 3);
    }
  }
}
const _loc = {};

// ============================================================================
// Ítems en pista: cajas, turbos, peligros, proyectiles
// ============================================================================
const boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
const boxMat = new THREE.MeshBasicMaterial({ map: ITEMBOX_TEX, transparent: true, opacity: 0.9 });
const missileGeo = (() => {
  const g = new THREE.Group();
  const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 10), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
  bodyM.rotation.x = Math.PI / 2; g.add(bodyM);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 10), new THREE.MeshLambertMaterial({ color: 0xe53935 }));
  tip.rotation.x = Math.PI / 2; tip.position.z = 1.1; g.add(tip);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xe53935 }));
    fin.position.z = -0.6; fin.rotation.z = (i * Math.PI) / 2; fin.position.x = Math.cos((i * Math.PI) / 2) * 0.35; fin.position.y = Math.sin((i * Math.PI) / 2) * 0.35;
    g.add(fin);
  }
  return g;
})();
function makeBomb() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), new THREE.MeshLambertMaterial({ color: 0x222233 }));
  g.add(b);
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), new THREE.MeshLambertMaterial({ color: 0xbca27f }));
  f.position.y = 0.95; g.add(f);
  const eyes = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), eyes); e.position.set(sx, 0.2, 0.68); g.add(e); }
  return g;
}
function makeOil() {
  const tex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(20,10,30,1)'); gr.addColorStop(0.7, 'rgba(40,20,60,.95)'); gr.addColorStop(1, 'rgba(40,20,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(160,120,255,.35)'; g.beginPath(); g.ellipse(24, 22, 10, 5, -0.5, 0, 7); g.fill();
  }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.07;
  return m;
}

// ============================================================================
// Entrada (teclado / táctil / joystick)
// ============================================================================
const input = { accel: false, brake: false, steer: 0, drift: false, itemQueued: false, kbL: false, kbR: false, touchSteer: 0, touchDrift: false, touchBrake: false, touchAccel: false };
let autoAccel = store.get('autoaccel', IS_TOUCH);
const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift', KeyE: 'item', KeyZ: 'item', ControlLeft: 'item', ControlRight: 'item', KeyX: 'item',
};
const keyState = {};
window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  const k = KEYS[e.code];
  if (!k) return;
  e.preventDefault();
  if (k === 'item' && !keyState.item) input.itemQueued = true;
  keyState[k] = true;
});
window.addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) keyState[k] = false; });
window.addEventListener('blur', () => { for (const k in keyState) keyState[k] = false; });

function bindHold(el, on, off) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); el.setPointerCapture(e.pointerId); el.classList.add('on'); on(); });
  const up = (e) => { el.classList.remove('on'); off(); if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
bindHold($('btn-drift'), () => { input.touchDrift = true; }, () => { input.touchDrift = false; });
bindHold($('btn-brake'), () => { input.touchBrake = true; }, () => { input.touchBrake = false; });
bindHold($('btn-accel'), () => { input.touchAccel = true; }, () => { input.touchAccel = false; });
bindHold($('btn-item'), () => { input.itemQueued = true; }, () => {});
{
  const pad = $('steerpad'), knob = $('steerknob');
  let pid = null;
  const setFrom = (e) => {
    const r = pad.getBoundingClientRect();
    const v = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    input.touchSteer = Math.abs(v) < 0.08 ? 0 : clamp(v * 1.35, -1, 1);
    knob.style.left = `${((v + 1) / 2) * 100}%`;
  };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); pid = e.pointerId; pad.setPointerCapture(pid); setFrom(e); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) setFrom(e); });
  const end = (e) => { if (e.pointerId !== pid) return; pid = null; input.touchSteer = 0; knob.style.left = '50%'; };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });

let padPrev = {};
function pollInput() {
  let steer = (keyState.right ? 1 : 0) - (keyState.left ? 1 : 0);
  let accel = !!keyState.up, brake = !!keyState.down, drift = !!keyState.drift;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const ax = gp.axes[0] || 0;
    if (Math.abs(ax) > 0.15) steer = ax;
    const b = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3);
    if (b(14)) steer = -1; if (b(15)) steer = 1;
    if (b(0) || b(7)) accel = true;
    if (b(1) || b(6)) brake = true;
    if (b(5) || b(3)) drift = true;
    const itemNow = b(2) || b(4);
    if (itemNow && !padPrev.item) input.itemQueued = true;
    if (b(9) && !padPrev.start) togglePause();
    padPrev = { item: itemNow, start: b(9) };
  }
  if (input.touchSteer) steer = input.touchSteer;
  if (input.touchDrift) drift = true;
  if (input.touchBrake) brake = true;
  if (input.touchAccel) accel = true;
  if (autoAccel && !brake) accel = true;
  input.steer = clamp(steer, -1, 1);
  input.accel = accel; input.brake = brake; input.drift = drift;
}

// ============================================================================
// Carrera
// ============================================================================
class Race {
  constructor() {
    this.track = null;
    this.karts = [];
    this.phase = 'menu';
    this.boxes = [];
    this.pads = [];
    this.hazards = [];
    this.projectiles = [];
    this.time = 0;
    this.t = 0;
    this.cc = 1;
    this.mode = 'single';
    this.playerChar = 0;
    this.gp = null;
    this.trackIndex = 0;
    this.trackCache = new Map();
    this.camYaw = 0;
    this.camPos = new THREE.Vector3();
    this.snow = null;
  }
  isNear(k) { return this.player && Math.hypot(k.x - this.player.x, k.z - this.player.z) < 40; }
  loadTrack(i) {
    if (this.track) scene.remove(this.track.group);
    let tr = this.trackCache.get(i);
    if (!tr) { tr = new Track(TRACKS[i]); this.trackCache.set(i, tr); }
    this.track = tr;
    this.trackIndex = i;
    scene.add(tr.group);
    const th = tr.def.theme;
    scene.fog = new THREE.Fog(th.fog, th.night ? 120 : 180, th.night ? 650 : 900);
    scene.background = new THREE.Color(th.fog);
    hemi.color.set(th.night ? 0x8a7dff : 0xffffff);
    hemi.groundColor.set(th.hemiGround);
    hemi.intensity = th.night ? 1.6 : 1.2;
    sun.color.set(th.sun);
    sun.intensity = th.night ? 0.6 : 1.7;
    if (this.snow) { scene.remove(this.snow); this.snow = null; }
    if (th.snow) this.snow = makeSnow();
    if (this.snow) scene.add(this.snow);
    buildMinimap(tr);
  }
  clearObjects() {
    for (const o of [...this.boxes, ...this.pads]) scene.remove(o.mesh);
    for (const o of [...this.hazards, ...this.projectiles]) scene.remove(o.mesh);
    for (const k of this.karts) scene.remove(k.mesh);
    this.boxes = []; this.pads = []; this.hazards = []; this.projectiles = [];
    sparks.clear(); dust.clear();
  }
  setup(trackIdx) {
    this.clearObjects();
    this.loadTrack(trackIdx);
    const tr = this.track, L = tr.length;
    // Cajas de ítems
    if (this.mode !== 'timetrial') {
      for (const f of [0.14, 0.42, 0.7, 0.9]) {
        for (const lat of [-6.5, -3.25, 0, 3.25, 6.5]) {
          const p = tr.pointAt(L * f, lat);
          const mesh = new THREE.Mesh(boxGeo, boxMat);
          mesh.position.set(p.x, 1.3, p.z);
          scene.add(mesh);
          this.boxes.push({ x: p.x, z: p.z, mesh, respawn: 0, rot: Math.random() * 6 });
        }
      }
    }
    // Turbos en el piso
    for (const f of [0.28, 0.57, 0.83]) {
      const lat = rand(-4, 4);
      const loc = tr.locate(...(() => { const p = tr.pointAt(L * f, lat); return [p.x, p.z]; })());
      const tex = BOOST_TEX.clone(); tex.needsUpdate = true; tex.repeat.set(1, 1.5);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ map: tex }));
      const p = tr.pointAt(L * f, lat);
      mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = tr.heading(loc.idx) + Math.PI;
      mesh.position.set(p.x, 0.05, p.z);
      scene.add(mesh);
      this.pads.push({ idx: loc.idx, lat, mesh, tex });
    }
    // Karts
    const chars = CHARACTERS.map((c, i) => i).filter((i) => i !== this.playerChar);
    chars.sort(() => Math.random() - 0.5);
    const order = this.mode === 'timetrial' ? [this.playerChar] : [...chars.slice(0, 7), this.playerChar];
    if (this.gp && this.gp.order) {
      // en el GP la grilla sigue el orden inverso de la clasificación
      order.length = 0; order.push(...this.gp.order);
    }
    this.karts = order.map((ci) => {
      const k = this.kartCache[ci] && this.kartCache[ci].isPlayer === (ci === this.playerChar) ? this.kartCache[ci] : (this.kartCache[ci] = new Kart(CHARACTERS[ci], ci === this.playerChar));
      return k;
    });
    this.karts.forEach((k, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const s = L - 6 - row * 7 - col * 3.5;
      k.reset(tr, s, col ? 4.5 : -4.5, this.cc);
      if (k.ai) {
        const base = CC[this.cc].ai;
        k.ai.skill = base - (this.cc === 0 ? 0.04 : 0) + rand(-0.02, 0.025);
      }
      scene.add(k.mesh);
    });
    // en contrarreloj: posición inicial al centro
    if (this.mode === 'timetrial') this.karts[0].reset(tr, L - 6, 0, this.cc);
    this.player = this.karts.find((k) => k.isPlayer);
    if (this.mode === 'timetrial') { this.player.item = 'triple'; this.player.itemCount = 3; }
    this.finishOrder = [];
    this.time = 0; this.t = 0;
    this.phase = 'intro';
    this.camYaw = this.player.h;
    this.lastPlace = 0;
    this.finalLapShown = false;
    $('laptotal').textContent = TOTAL_LAPS;
    const rec = store.get('records', {})[tr.def.id];
    $('bestlap').textContent = rec ? `Récord vuelta ${fmtTime(rec.lap)}` : '';
    audio.playSong(tr.def.music);
    showCenter(tr.def.name, 'small', 2.2);
  }
  onLap(k) {
    if (k.lap > 1) {
      const lt = this.time - k.lapStart;
      k.lapTimes.push(lt);
      if (k.isPlayer) this.saveRecord('lap', lt);
    }
    k.lapStart = this.time;
    if (k.lap > TOTAL_LAPS && !k.finished) {
      k.finished = true;
      k.finishTime = this.time;
      this.finishOrder.push(k);
      if (k.isPlayer) this.playerFinished();
    } else if (k.isPlayer && k.lap > 1) {
      if (k.lap === TOTAL_LAPS) { showCenter('¡ÚLTIMA VUELTA!', 'small', 1.8); audio.play('final'); }
      else { showCenter(`VUELTA ${k.lap}`, 'small', 1.2); audio.play('lap'); }
    }
  }
  saveRecord(kind, t) {
    const all = store.get('records', {});
    const id = this.track.def.id;
    const r = all[id] || {};
    if (kind === 'lap' && (!r.lap || t < r.lap)) r.lap = t;
    if (kind === 'total' && (!r.total || t < r.total)) r.total = t;
    all[id] = r;
    store.set('records', all);
    if (r.lap) $('bestlap').textContent = `Récord vuelta ${fmtTime(r.lap)}`;
  }
  playerFinished() {
    this.phase = 'finished';
    this.finishT = 0;
    const place = this.finishOrder.length;
    if (this.mode === 'timetrial') this.saveRecord('total', this.time);
    showCenter(this.mode === 'timetrial' ? '¡META!' : `¡META! ${place}°`, 'small', 3);
    audio.play('finish');
    this.player.ai = { lane: 0, phase: 0, hold: 99, stuck: 0, skill: 0.9 };
  }
  rollItem(k) {
    const n = this.karts.length;
    const p = n > 1 ? (k.place - 1) / (n - 1) : 0;
    const tbl = ITEM_TABLES[p < 0.3 ? 0 : p < 0.7 ? 1 : 2];
    let sum = 0; for (const v of Object.values(tbl)) sum += v;
    let r = Math.random() * sum;
    for (const [key, v] of Object.entries(tbl)) { r -= v; if (r <= 0) return key; }
    return 'turbo';
  }
  useItem(k) {
    const it = k.item;
    if (!it || k.rollT > 0) return;
    const fx = k.forwardX, fz = k.forwardZ;
    const near = k.isPlayer || this.isNear(k);
    switch (it) {
      case 'turbo': k.boost(1.1); break;
      case 'triple': k.boost(1.1); k.itemCount--; if (k.itemCount > 0) return; break;
      case 'shield': k.shieldT = 10; if (near) audio.play('shield'); break;
      case 'star': k.starT = 7.5; k.boost(0.6); if (near) audio.play('star'); break;
      case 'oil': {
        const mesh = makeOil();
        const x = k.x - fx * 3.2, z = k.z - fz * 3.2;
        mesh.position.x = x; mesh.position.z = z;
        scene.add(mesh);
        this.hazards.push({ type: 'oil', x, z, mesh, owner: k, grace: 0.6 });
        if (this.hazards.length > 24) { const o = this.hazards.shift(); scene.remove(o.mesh); }
        if (near) audio.play('drop');
        break;
      }
      case 'missile': {
        const mesh = missileGeo.clone();
        scene.add(mesh);
        const ahead = this.karts.filter((o) => o !== k && !o.finished && o.progress > k.progress).sort((a, b) => a.progress - b.progress)[0] || null;
        this.projectiles.push({ type: 'missile', x: k.x + fx * 2.5, z: k.z + fz * 2.5, y: 1, h: k.h, s: k.s, lat: k.lat, prog: k.progress, target: ahead, owner: k, life: 9, mesh, speed: Math.max(62, k.speed + 18), grace: 0.4 });
        if (near) audio.play('shoot');
        break;
      }
      case 'bomb': {
        const mesh = makeBomb();
        scene.add(mesh);
        this.projectiles.push({ type: 'bomb', x: k.x + fx * 2.5, z: k.z + fz * 2.5, y: 1.5, vx: fx * (k.speed + 22), vz: fz * (k.speed + 22), vy: 9, fuse: 3.2, owner: k, mesh, grace: 0.5, idx: k.idx });
        if (near) audio.play('drop');
        break;
      }
      case 'storm': {
        for (const o of this.karts) {
          if (o === k || o.finished) continue;
          if (o.progress > k.progress || this.karts.length < 3) {
            if (o.hit('spin')) o.shrinkT = 5;
          }
        }
        audio.play('storm');
        flash();
        break;
      }
      default: break;
    }
    k.item = null; k.itemCount = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.phase === 'intro' && this.t > 2.6) { this.phase = 'countdown'; this.t = 0; this.cdStep = -1; }
    if (this.phase === 'countdown') {
      const step = Math.floor(this.t);
      if (step !== this.cdStep) {
        this.cdStep = step;
        if (step < 3) { showCenter(String(3 - step), '', 0.9); audio.play('beep'); }
        else {
          showCenter('¡YA!', '', 0.9); audio.play('go');
          this.phase = 'race'; this.time = 0;
          for (const k of this.karts) {
            k.lapStart = 0;
            if (k.isPlayer) { if (k.firstAccelT >= 1.9 && k.firstAccelT <= 2.7) k.boost(1.2); }
            else if (Math.random() < k.ai.skill - 0.55) k.boost(rand(0.6, 1.1));
          }
        }
      }
      if (input.accel && this.player.firstAccelT < 0 && !autoAccel) this.player.firstAccelT = this.t;
    }
    if (this.phase === 'race' || this.phase === 'finished') this.time += dt;
    // entrada del jugador
    const P = this.player;
    if (this.phase !== 'finished') {
      P.input.accel = input.accel; P.input.brake = input.brake; P.input.steer = input.steer; P.input.drift = input.drift;
      if (input.itemQueued) { input.itemQueued = false; if (this.phase === 'race') this.useItem(P); }
    }
    for (const k of this.karts) if (k.ai && (!k.isPlayer || this.phase === 'finished')) this.updateAI(k, dt);
    for (const k of this.karts) k.update(dt, this);
    this.collideKarts();
    this.updateBoxes(dt);
    this.updatePads(dt);
    this.updateHazards(dt);
    this.updateProjectiles(dt);
    // posiciones
    const sorted = [...this.karts].sort((a, b) => (a.finished || b.finished) ? (a.finishTime - b.finishTime) : (b.progress - a.progress));
    sorted.forEach((k, i) => { k.place = i + 1; });
    // rodillos de ítems
    for (const k of this.karts) {
      if (k.rollT > 0) {
        k.rollT -= dt;
        if (k.isPlayer && Math.random() < 0.5) audio.play('tick');
        if (k.rollT <= 0) {
          k.item = k.rollItem; k.itemCount = k.item === 'triple' ? 3 : 1;
          if (k.isPlayer) audio.play('got');
        }
      }
    }
    if (this.phase === 'finished') {
      this.finishT += dt;
      if (this.finishT > 4.5 && !this.resultsShown) this.showResults();
    }
  }
  updateAI(k, dt) {
    const tr = this.track, ai = k.ai, inp = k.input;
    const look = 9 + Math.abs(k.speed) * 0.42;
    const ti = tr.wrap(k.idx + Math.round(look / tr.step));
    let lane = clamp(ai.lane + Math.sin(this.time * 0.35 + ai.phase) * 2.2, -HALF + 2, HALF - 2);
    // esquivar aceite cercano
    for (const hz of this.hazards) {
      const dx = hz.x - k.x, dz = hz.z - k.z;
      if (dx * dx + dz * dz < 900) {
        const loc = tr.locate(hz.x, hz.z, k.idx, _loc2);
        if (Math.abs(loc.lat - lane) < 3) lane = clamp(loc.lat + (loc.lat > 0 ? -5 : 5), -HALF + 1.5, HALF - 1.5);
      }
    }
    // apuntar a cajas si no tiene ítem
    if (!k.item && k.rollT <= 0) {
      for (const b of this.boxes) {
        if (b.respawn > 0) continue;
        const dx = b.x - k.x, dz = b.z - k.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 45 * 45 && dx * k.forwardX + dz * k.forwardZ > 8) {
          lane = tr.locate(b.x, b.z, k.idx, _loc2).lat;
          break;
        }
      }
    }
    const tx = tr.px[ti] + tr.nx[ti] * lane, tz = tr.pz[ti] + tr.nz[ti] * lane;
    const desired = Math.atan2(tx - k.x, tz - k.z);
    const d = angDiff(k.h, desired);
    inp.steer = clamp(-d * 2.4, -1, 1);
    // curvatura por delante para derrapar
    const ci = tr.wrap(k.idx + Math.round(30 / tr.step));
    const curv = angDiff(tr.heading(k.idx), tr.heading(ci));
    const wantDrift = Math.abs(curv) > 0.45 && k.speed > 20 && ai.skill > 0.85;
    inp.drift = wantDrift && (k.drift ? Math.sign(-curv) === k.drift : true) && Math.abs(d) < 1.0;
    if (k.drift && Math.abs(curv) < 0.2 && k.driftLvl >= 1) inp.drift = false;
    inp.accel = true;
    inp.brake = Math.abs(d) > 1.3 && k.speed > 18;
    // goma elástica
    const P = this.player;
    let rub = 1;
    if (P && !P.finished && this.mode !== 'timetrial') {
      const diff = k.progress - P.progress;
      rub = diff > 70 ? 0.9 : diff > 30 ? 0.96 : diff < -120 ? 1.12 : diff < -50 ? 1.06 : 1;
    }
    k.maxMul = lerp(k.maxMul, ai.skill * rub, dt);
    // atascado
    if (this.phase === 'race' && Math.abs(k.speed) < 3) { ai.stuck += dt; if (ai.stuck > 2) { inp.brake = true; inp.steer = -inp.steer; if (ai.stuck > 3.2) ai.stuck = 0; } } else ai.stuck = 0;
    // ítems
    if (k.item && k.rollT <= 0 && this.phase === 'race') {
      ai.hold += dt;
      const it = k.item;
      let use = false;
      if (it === 'missile' || it === 'bomb') {
        const tgt = this.karts.some((o) => o !== k && o.progress > k.progress && o.progress - k.progress < (it === 'bomb' ? 50 : 160));
        use = (tgt && ai.hold > 1) || ai.hold > 7;
      } else if (it === 'oil') {
        const behind = this.karts.some((o) => o !== k && o.progress < k.progress && k.progress - o.progress < 30);
        use = (behind && ai.hold > 1) || ai.hold > 9;
      } else if (it === 'turbo' || it === 'triple' || it === 'star') {
        use = ai.hold > 1.5 && Math.abs(curv) < 0.25;
      } else use = ai.hold > rand(1, 4);
      if (use) { this.useItem(k); if (!k.item) ai.hold = 0; else ai.hold = 0.8; }
    }
  }
  collideKarts() {
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i], b = ks[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const r = 1.15 * (a.shrinkT > 0 ? 0.6 : 1) + 1.15 * (b.shrinkT > 0 ? 0.6 : 1);
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = r - d;
      const ma = a.mass * (a.shrinkT > 0 ? 0.3 : 1) * (a.starT > 0 ? 10 : 1);
      const mb = b.mass * (b.shrinkT > 0 ? 0.3 : 1) * (b.starT > 0 ? 10 : 1);
      const ta = mb / (ma + mb), tb = ma / (ma + mb);
      a.x -= nx * pen * ta * 1.2; a.z -= nz * pen * ta * 1.2;
      b.x += nx * pen * tb * 1.2; b.z += nz * pen * tb * 1.2;
      if (a.starT > 0 && b.starT <= 0) b.hit('spin');
      else if (b.starT > 0 && a.starT <= 0) a.hit('spin');
      else if (b.shrinkT > 0 && a.shrinkT <= 0) b.hit('spin');
      else if (a.shrinkT > 0 && b.shrinkT <= 0) a.hit('spin');
      else if ((a.isPlayer || b.isPlayer) && pen > 0.3) audio.play('bump');
    }
  }
  updateBoxes(dt) {
    for (const b of this.boxes) {
      b.rot += dt * 1.5;
      if (b.respawn > 0) {
        b.respawn -= dt;
        if (b.respawn <= 0) b.mesh.visible = true;
        else continue;
      }
      b.mesh.rotation.set(b.rot * 0.7, b.rot, 0);
      b.mesh.position.y = 1.3 + Math.sin(b.rot * 2) * 0.2;
      const sc = b.respawn < 0 && b.respawn > -0.3 ? 1 + b.respawn : 1;
      b.mesh.scale.setScalar(Math.max(0.2, sc));
      for (const k of this.karts) {
        const dx = k.x - b.x, dz = k.z - b.z;
        if (dx * dx + dz * dz < 4.8 && k.y < 2.5) {
          b.respawn = 2.5; b.mesh.visible = false;
          for (let i = 0; i < 12; i++) sparks.emit(b.x, 1.3, b.z, rand(-6, 6), rand(2, 8), rand(-6, 6), [0xff5252, 0xffd740, 0x69f0ae, 0x40c4ff][i % 4], 0.5, 10);
          if (k.isPlayer || this.isNear(k)) audio.play('box');
          if (!k.item && k.rollT <= 0) {
            k.rollItem = this.rollItem(k);
            k.rollT = k.isPlayer ? 1.3 : 0.8;
            if (k.ai) k.ai.hold = 0;
          }
          break;
        }
      }
    }
  }
  updatePads(dt) {
    for (const p of this.pads) {
      p.tex.offset.y -= dt * 1.5;
      for (const k of this.karts) {
        const di = Math.abs(((k.idx - p.idx) % this.track.N + this.track.N + this.track.N / 2) % this.track.N - this.track.N / 2);
        if (di <= 2 && Math.abs(k.lat - p.lat) < 2.3 && k.y < 0.5 && k.boostT < 0.5) k.boost(0.9);
      }
    }
  }
  updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.grace -= dt;
      for (const k of this.karts) {
        if (h.grace > 0 && k === h.owner) continue;
        const dx = k.x - h.x, dz = k.z - h.z;
        if (dx * dx + dz * dz < 5.2 && k.y < 0.8) {
          k.hit('spin');
          scene.remove(h.mesh); this.hazards.splice(i, 1);
          break;
        }
      }
    }
  }
  explode(x, z, owner) {
    for (let i = 0; i < 60; i++) {
      const c = [0xff5722, 0xffc107, 0xffeb3b, 0xffffff][i % 4];
      sparks.emit(x, 1.5, z, rand(-14, 14), rand(4, 16), rand(-14, 14), c, rand(0.4, 0.9), 14);
    }
    for (let i = 0; i < 20; i++) dust.emit(x + rand(-2, 2), 1, z + rand(-2, 2), rand(-4, 4), rand(2, 7), rand(-4, 4), 0x555555, 1.2, 1);
    for (const k of this.karts) {
      const d = Math.hypot(k.x - x, k.z - z);
      if (d < 8) k.hit('boom');
    }
    const pd = this.player ? Math.hypot(this.player.x - x, this.player.z - z) : 0;
    if (pd < 80) { audio.play('boom'); if (pd < 25) shake = 0.6; }
  }
  updateProjectiles(dt) {
    const tr = this.track;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.grace -= dt;
      let dead = false;
      if (p.type === 'missile') {
        p.life -= dt;
        const t = p.target && !p.target.finished ? p.target : null;
        if (t && (t.progress - p.prog < 22 || Math.hypot(t.x - p.x, t.z - p.z) < 18)) {
          const desired = Math.atan2(t.x - p.x, t.z - p.z);
          p.h += clamp(angDiff(p.h, desired), -5 * dt, 5 * dt);
          p.x += Math.sin(p.h) * p.speed * dt; p.z += Math.cos(p.h) * p.speed * dt;
        } else {
          p.s += p.speed * dt; p.prog += p.speed * dt;
          const tgtLat = t ? clamp(t.lat, -HALF, HALF) : 0;
          p.lat = lerp(p.lat, tgtLat, 1 - Math.exp(-1.5 * dt));
          const q = tr.pointAt(p.s, p.lat, _v1);
          p.h = Math.atan2(q.x - p.x, q.z - p.z);
          p.x = q.x; p.z = q.z;
        }
        p.mesh.position.set(p.x, 1 + Math.sin(p.life * 20) * 0.08, p.z);
        p.mesh.rotation.y = p.h;
        if (Math.random() < 0.7) dust.emit(p.x - Math.sin(p.h) * 1.3, 1, p.z - Math.cos(p.h) * 1.3, 0, 0.5, 0, 0xdddddd, 0.5, 0);
        for (const k of this.karts) {
          if (k === p.owner && p.grace > 0) continue;
          if (Math.hypot(k.x - p.x, k.z - p.z) < 2.0) { k.hit('boom'); dead = true; break; }
        }
        if (p.life <= 0) dead = true;
        if (dead) this.explodeSmall(p.x, p.z);
      } else if (p.type === 'bomb') {
        p.vy -= 26 * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        if (p.y < 0.8) {
          p.y = 0.8; p.vy = Math.abs(p.vy) > 4 ? -p.vy * 0.35 : 0;
          p.vx *= Math.pow(0.15, dt); p.vz *= Math.pow(0.15, dt);
          p.fuse -= dt;
        }
        const loc = tr.locate(p.x, p.z, p.idx, _loc2); p.idx = loc.idx;
        if (Math.abs(loc.lat) > WALL - 1) {
          const sg = Math.sign(loc.lat), push = Math.abs(loc.lat) - (WALL - 1);
          p.x -= tr.nx[loc.idx] * sg * push; p.z -= tr.nz[loc.idx] * sg * push;
          p.vx *= -0.3; p.vz *= -0.3;
        }
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.rotation.y += dt * 3;
        const pulse = p.fuse < 1 ? 1 + Math.sin(p.fuse * 40) * 0.15 : 1;
        p.mesh.scale.setScalar(pulse);
        if (Math.random() < 0.5) sparks.emit(p.x, p.y + 1.2, p.z, rand(-1, 1), 2, rand(-1, 1), 0xffc107, 0.3);
        let trig = p.fuse <= 0;
        if (p.grace <= 0) for (const k of this.karts) if (Math.hypot(k.x - p.x, k.z - p.z) < 3) trig = true;
        if (trig) { this.explode(p.x, p.z, p.owner); dead = true; }
      }
      if (dead) { scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
  }
  explodeSmall(x, z) {
    for (let i = 0; i < 30; i++) sparks.emit(x, 1.2, z, rand(-9, 9), rand(3, 10), rand(-9, 9), i % 2 ? 0xff7043 : 0xffeb3b, 0.6, 14);
    if (this.player && Math.hypot(this.player.x - x, this.player.z - z) < 60) audio.play('boom');
  }
  showResults() {
    this.resultsShown = true;
    // Estimar tiempo de los que no terminaron
    const L = this.track.length;
    for (const k of this.karts) {
      if (!k.finished) {
        const remaining = TOTAL_LAPS * L - k.progress;
        k.finishTime = this.time + remaining / (k.maxSpeed * 0.85);
      }
    }
    const order = [...this.karts].sort((a, b) => a.finishTime - b.finishTime);
    order.forEach((k, i) => { k.place = i + 1; });
    const tbl = $('res-table');
    tbl.innerHTML = '';
    let next = 'Menú';
    if (this.gp) {
      order.forEach((k, i) => { this.gp.points[k.ch.id] = (this.gp.points[k.ch.id] || 0) + GP_POINTS[i]; });
      const last = this.gp.race >= TRACKS.length - 1;
      $('res-title').textContent = `Carrera ${this.gp.race + 1}/${TRACKS.length} — ${this.track.def.name}`;
      order.forEach((k, i) => addRow(tbl, i + 1, k, fmtTime(k.finishTime), `+${GP_POINTS[i]}`, `${this.gp.points[k.ch.id]} pts`));
      next = last ? 'Clasificación final ▶' : 'Siguiente carrera ▶';
      // grilla de la siguiente: los primeros salen adelante
      this.gp.order = order.map((k) => CHARACTERS.indexOf(k.ch));
    } else if (this.mode === 'timetrial') {
      const rec = store.get('records', {})[this.track.def.id] || {};
      $('res-title').textContent = `Contrarreloj — ${this.track.def.name}`;
      const P = this.player;
      P.lapTimes.forEach((t, i) => addRow(tbl, i + 1, P, `Vuelta ${i + 1}`, fmtTime(t), ''));
      addRow(tbl, '⏱', P, 'Total', fmtTime(P.finishTime), rec.total ? `Récord ${fmtTime(rec.total)}` : '');
      next = 'Reintentar ↻';
    } else {
      $('res-title').textContent = `Resultados — ${this.track.def.name}`;
      order.forEach((k, i) => addRow(tbl, i + 1, k, fmtTime(k.finishTime), '', ''));
      next = 'Otra pista ▶';
    }
    $('btn-res-next').textContent = next;
    ui.show('results', true);
  }
}
const _loc2 = {};
const _v1 = new THREE.Vector3();
function addRow(tbl, pos, k, a, b, c) {
  const tr = document.createElement('tr');
  if (k.isPlayer) tr.className = 'me';
  const col = '#' + new THREE.Color(k.ch.color).getHexString();
  tr.innerHTML = `<td class="n">${pos}</td><td><span class="dot" style="background:${col}"></span>${k.ch.icon} ${k.ch.name}</td><td class="n">${a}</td><td class="n">${b}</td><td class="n">${c}</td>`;
  tbl.appendChild(tr);
}

function makeSnow() {
  const n = IS_TOUCH ? 500 : 1200;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(-80, 80); pos[i * 3 + 1] = rand(0, 50); pos[i * 3 + 2] = rand(-80, 80); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.9 }));
  p.frustumCulled = false;
  return p;
}

// ============================================================================
// Escena: luces + objetos globales
// ============================================================================
const hemi = new THREE.HemisphereLight(0xffffff, 0x445522, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(80, 160, 60);
scene.add(sun);
scene.add(sparks.points, dust.points);
const race = new Race();
race.kartCache = [];

// ============================================================================
// HUD
// ============================================================================
let centerTimer = 0;
function showCenter(text, cls = '', dur = 1) {
  const el = $('center-msg');
  el.textContent = text;
  el.className = cls;
  void el.offsetWidth;
  el.classList.add('pop');
  centerTimer = dur;
}
function flash() {
  const f = $('flash');
  f.style.transition = 'none'; f.style.opacity = '0.9';
  requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = '0'; });
}
let shake = 0;
const mm = { canvas: $('minimap'), ctx: $('minimap').getContext('2d'), path: null, scale: 1, ox: 0, oz: 0 };
function buildMinimap(tr) {
  const b = tr.bounds, W = 180, pad = 14;
  const sc = Math.min((W - pad * 2) / (b.maxX - b.minX), (W - pad * 2) / (b.maxZ - b.minZ));
  mm.scale = sc;
  mm.ox = W / 2 - ((b.minX + b.maxX) / 2) * sc;
  mm.oz = W / 2 - ((b.minZ + b.maxZ) / 2) * sc;
  const path = new Path2D();
  for (let i = 0; i <= tr.N; i += 2) {
    const j = i % tr.N;
    const x = tr.px[j] * sc + mm.ox, y = tr.pz[j] * sc + mm.oz;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath();
  mm.path = path;
}
function drawMinimap() {
  const g = mm.ctx;
  g.clearRect(0, 0, 180, 180);
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 12; g.stroke(mm.path);
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6; g.stroke(mm.path);
  const tr = race.track;
  g.fillStyle = '#111';
  g.fillRect(tr.px[0] * mm.scale + mm.ox - 4, tr.pz[0] * mm.scale + mm.oz - 4, 8, 8);
  const ks = [...race.karts].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  for (const k of ks) {
    const x = k.x * mm.scale + mm.ox, y = k.z * mm.scale + mm.oz;
    g.beginPath(); g.arc(x, y, k.isPlayer ? 7 : 5, 0, Math.PI * 2);
    g.fillStyle = '#' + _col.set(k.ch.color).getHexString(); g.fill();
    g.lineWidth = 2; g.strokeStyle = k.isPlayer ? '#ffeb3b' : '#fff'; g.stroke();
  }
  for (const p of race.projectiles) {
    g.fillStyle = p.type === 'missile' ? '#ff1744' : '#000';
    g.fillRect(p.x * mm.scale + mm.ox - 2, p.z * mm.scale + mm.oz - 2, 4, 4);
  }
}
const hudEls = { lapnum: $('lapnum'), timer: $('timer'), pos: $('position'), posnum: $('posnum'), item: $('itemicon'), speed: $('speednum'), wrong: $('wrongway') };
let rollIconT = 0;
function updateHUD(dt) {
  const P = race.player;
  if (!P) return;
  hudEls.lapnum.textContent = clamp(P.lap, 1, TOTAL_LAPS);
  hudEls.timer.textContent = fmtTime(race.time);
  const solo = race.mode === 'timetrial';
  hudEls.pos.classList.toggle('hidden', solo);
  if (P.place !== race.lastPlace) {
    race.lastPlace = P.place;
    hudEls.posnum.textContent = P.place;
    hudEls.pos.className = P.place <= 3 ? `p${P.place}` : '';
    void hudEls.pos.offsetWidth;
    hudEls.pos.classList.add('bump');
    if (solo) hudEls.pos.classList.add('hidden');
  }
  if (P.rollT > 0) {
    rollIconT -= dt;
    if (rollIconT <= 0) {
      rollIconT = 0.07;
      const keys = Object.keys(ITEMS);
      hudEls.item.textContent = ITEMS[keys[(Math.random() * keys.length) | 0]].icon;
    }
    hudEls.item.classList.add('rolling');
  } else {
    hudEls.item.classList.remove('rolling');
    const it = P.item;
    hudEls.item.textContent = it ? (it === 'triple' ? '⚡'.repeat(P.itemCount) : ITEMS[it].icon) : '';
    hudEls.item.style.fontSize = it === 'triple' ? (P.itemCount > 2 ? '26px' : '34px') : '';
  }
  hudEls.speed.textContent = Math.round(Math.abs(P.speed) * 3.2);
  hudEls.wrong.classList.toggle('hidden', P.wrongT < 1);
  if (centerTimer > 0) { centerTimer -= dt; if (centerTimer <= 0) $('center-msg').textContent = ''; }
  drawMinimap();
}

// ============================================================================
// Cámara
// ============================================================================
const _camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const P = race.player;
  if (!P) return;
  const portrait = camera.aspect < 1;
  if (race.phase === 'intro') {
    const a = P.h + Math.PI * (1 - race.t / 2.6) * 0.9;
    const r = lerp(9, 7.5, race.t / 2.6);
    camera.position.set(P.x + Math.sin(a) * r, 3 + (1 - race.t / 2.6) * 3, P.z + Math.cos(a) * r);
    camera.lookAt(P.x, 1.2, P.z);
    race.camYaw = P.h;
    camera.fov = portrait ? 85 : 65;
    camera.updateProjectionMatrix();
    return;
  }
  if (race.phase === 'finished') {
    const a = P.h + Math.PI * 0.75 + race.finishT * 0.4;
    camera.position.set(P.x + Math.sin(a) * 9, 3.5, P.z + Math.cos(a) * 9);
    camera.lookAt(P.x, 1.2, P.z);
    return;
  }
  race.camYaw += angDiff(race.camYaw, P.h - P.drift * 0.12) * (1 - Math.exp(-7 * dt));
  const back = portrait ? 8.8 : 7.2, up = portrait ? 3.6 : 3.0;
  const fx = Math.sin(race.camYaw), fz = Math.cos(race.camYaw);
  camera.position.set(P.x - fx * back, P.y * 0.5 + up, P.z - fz * back);
  if (shake > 0) {
    shake -= dt;
    camera.position.x += rand(-0.3, 0.3) * shake * 2; camera.position.y += rand(-0.3, 0.3) * shake * 2;
  }
  _camTarget.set(P.x + fx * 5, 1.3 + P.y * 0.3, P.z + fz * 5);
  camera.lookAt(_camTarget);
  const boosting = P.boostT > 0 || P.starT > 0;
  const tf = (portrait ? 84 : 68) + clamp(P.speed / P.maxSpeed, 0, 1.4) * 6 + (boosting ? 10 : 0);
  camera.fov = lerp(camera.fov, tf, 1 - Math.exp(-4 * dt));
  camera.updateProjectionMatrix();
}

// ============================================================================
// Menús y showroom
// ============================================================================
const ui = {
  stack: [],
  current: null,
  show(name, dim = false) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    const el = $('scr-' + name);
    el.classList.remove('hidden');
    $('menu').classList.remove('hidden');
    $('menu').classList.toggle('dim', dim);
    if (this.current && this.current !== name && !['pause', 'results'].includes(name)) this.stack.push(this.current);
    this.current = name;
    const first = el.querySelector('.mbtn.primary, .mbtn, .trackcard');
    if (first && !IS_TOUCH) first.focus({ preventScroll: true });
  },
  back() {
    const prev = this.stack.pop() || 'title';
    this.current = null;
    this.show(prev);
  },
  hide() { $('menu').classList.add('hidden'); this.current = null; this.stack = []; },
};
let state = 'menu'; // menu | game | paused
let menuFlow = { mode: 'single', cc: 1 };
let previewKart = null;

function setSoundLabel() {
  const l = audio.enabled ? '🔊 Sonido: SÍ' : '🔇 Sonido: NO';
  $('btn-sound').textContent = l; $('btn-sound2').textContent = l;
}
setSoundLabel();
function setAutoAccelLabel() {
  $('btn-autoaccel').textContent = `Aceleración automática: ${autoAccel ? 'SÍ' : 'NO'}`;
  document.body.classList.toggle('autoaccel', autoAccel);
}
setAutoAccelLabel();

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  audio.unlock(); audio.play('click');
  const go = b.dataset.go;
  if (go === 'howto') return ui.show('howto');
  menuFlow.mode = go;
  if (go === 'timetrial') { menuFlow.cc = 2; ui.show('char'); buildCharGrid(); }
  else ui.show('cc');
}));
document.querySelectorAll('[data-cc]').forEach((b) => b.addEventListener('click', () => {
  audio.play('click');
  menuFlow.cc = +b.dataset.cc;
  ui.show('char'); buildCharGrid();
}));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { audio.play('click'); ui.back(); }));
$('btn-fs').addEventListener('click', async () => {
  audio.unlock();
  try {
    if (!document.fullscreenElement) {
      await (document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }) ?? Promise.reject());
      await screen.orientation?.lock?.('landscape').catch(() => {});
    } else await document.exitFullscreen();
  } catch { /* no soportado (iOS Safari) */ }
});
const toggleSound = () => { audio.unlock(); audio.setEnabled(!audio.enabled); setSoundLabel(); };
$('btn-sound').addEventListener('click', toggleSound);
$('btn-sound2').addEventListener('click', toggleSound);
$('btn-autoaccel').addEventListener('click', () => { autoAccel = !autoAccel; store.set('autoaccel', autoAccel); setAutoAccelLabel(); });
$('btn-resume').addEventListener('click', () => togglePause());
$('btn-restart').addEventListener('click', () => { state = 'game'; ui.hide(); race.resultsShown = false; startRace(race.trackIndex); });
$('btn-quit').addEventListener('click', () => toMenu());
$('pausebtn').addEventListener('click', () => togglePause());
$('rotate-ok').addEventListener('click', () => { rotateDismissed = true; resize(); });
$('btn-res-menu').addEventListener('click', () => toMenu());
$('btn-res-next').addEventListener('click', () => {
  audio.play('click');
  if (race.mode === 'gpdone') return toMenu();
  if (race.gp) {
    if (race.gp.race >= TRACKS.length - 1) return showGPFinal();
    race.gp.race++;
    startRace(race.gp.race);
  } else if (race.mode === 'timetrial') startRace(race.trackIndex);
  else { ui.stack = ['title']; ui.current = null; ui.show('track'); buildTrackGrid(); state = 'menu'; showroomOn(); }
});

let selChar = store.get('char', 0);
function buildCharGrid() {
  const grid = $('chargrid');
  grid.innerHTML = '';
  CHARACTERS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'charcard' + (i === selChar ? ' sel' : '');
    b.innerHTML = `<div class="sw" style="background:#${_col.set(c.color).getHexString()}">${c.icon}</div>${c.name}`;
    b.addEventListener('click', () => { selChar = i; audio.play('click'); buildCharGrid(); });
    grid.appendChild(b);
  });
  const c = CHARACTERS[selChar];
  const bar = (n, v) => `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${v * 20}%"></i></div></div>`;
  $('charstats').innerHTML = bar('Velocidad', c.speed) + bar('Aceleración', c.accel) + bar('Manejo', c.handling) + bar('Peso', c.weight);
  setPreview(selChar);
}
$('btn-char-ok').addEventListener('click', () => {
  audio.play('click');
  store.set('char', selChar);
  race.playerChar = selChar;
  if (menuFlow.mode === 'grandprix') {
    race.mode = 'grandprix'; race.cc = menuFlow.cc;
    race.gp = { race: 0, points: {}, order: null };
    startRace(0);
  } else { ui.show('track'); buildTrackGrid(); }
});
function buildTrackGrid() {
  const grid = $('trackgrid');
  grid.innerHTML = '';
  const recs = store.get('records', {});
  TRACKS.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'trackcard';
    const c = document.createElement('canvas'); c.width = 160; c.height = 100;
    drawTrackThumb(c, t);
    b.appendChild(c);
    const r = recs[t.id];
    b.insertAdjacentHTML('beforeend', `${t.name}<small>${t.desc}${r && r.total ? ` · ⏱ ${fmtTime(r.total)}` : ''}</small>`);
    b.addEventListener('click', () => {
      audio.play('click');
      race.mode = menuFlow.mode; race.cc = menuFlow.cc; race.gp = null;
      startRace(i);
    });
    grid.appendChild(b);
  });
}
function drawTrackThumb(c, t) {
  const g = c.getContext('2d');
  const th = t.theme;
  g.fillStyle = th.ground[0]; g.fillRect(0, 0, c.width, c.height);
  const xs = t.pts.map((p) => p[0]), zs = t.pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const sc = Math.min((c.width - 24) / (maxX - minX), (c.height - 20) / (maxZ - minZ));
  const ox = c.width / 2 - ((minX + maxX) / 2) * sc, oz = c.height / 2 - ((minZ + maxZ) / 2) * sc;
  const curve = new THREE.CatmullRomCurve3(t.pts.map((p) => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal');
  const pts = curve.getSpacedPoints(120);
  g.lineJoin = 'round';
  for (const [w, col] of [[9, '#222'], [5, th.night ? '#ff2bd6' : '#fff']]) {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x * sc + ox, p.z * sc + oz) : g.moveTo(p.x * sc + ox, p.z * sc + oz)));
    g.closePath(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
}
function setPreview(i) {
  if (previewKart) scene.remove(previewKart.mesh);
  previewKart = race.kartCache[i] || (race.kartCache[i] = new Kart(CHARACTERS[i], false));
  if (!race.track) race.loadTrack(0);
  previewKart.reset(race.track, 30, 0, 1);
  scene.add(previewKart.mesh);
}
function showroomOn() {
  for (const k of race.karts) scene.remove(k.mesh);
  race.clearObjects();
  race.player = null;
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
  setPreview(selChar);
  audio.playSong(4);
}
function toMenu() {
  state = 'menu';
  race.phase = 'menu'; race.gp = null;
  audio.engine(0, 1, false, false); audio.squeal(false);
  ui.stack = []; ui.current = null;
  ui.show('title');
  showroomOn();
}
function startRace(i) {
  if (previewKart) { scene.remove(previewKart.mesh); previewKart = null; }
  ui.hide();
  state = 'game';
  race.resultsShown = false;
  race.setup(i);
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !IS_TOUCH);
  resize();
}
function togglePause() {
  if (state === 'game' && race.phase !== 'finished') {
    state = 'paused';
    ui.show('pause', true);
    audio.engine(0, 1, false, false); audio.squeal(false);
  } else if (state === 'paused') {
    state = 'game';
    ui.hide();
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'game') togglePause(); });
function showGPFinal() {
  const pts = race.gp.points;
  const ranked = CHARACTERS.filter((c) => race.karts.some((k) => k.ch === c)).sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
  const tbl = $('res-table');
  tbl.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉'];
  ranked.forEach((c, i) => {
    const k = race.karts.find((x) => x.ch === c);
    addRow(tbl, medals[i] || i + 1, k, `${pts[c.id] || 0} pts`, '', '');
  });
  const myPos = ranked.findIndex((c) => c === CHARACTERS[race.playerChar]) + 1;
  $('res-title').textContent = myPos === 1 ? '🏆 ¡Campeón del Gran Premio!' : `Gran Premio terminado — ${myPos}° lugar`;
  $('btn-res-next').textContent = 'Menú';
  race.gp = null;
  race.mode = 'gpdone';
  if (myPos === 1) audio.play('finish');
  ui.show('results', true);
}

// ============================================================================
// Bucle principal
// ============================================================================
const clock = new THREE.Clock();
let menuT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  pollInput();
  if (state === 'game') {
    // subpasos para estabilidad
    const steps = dt > 1 / 45 ? 2 : 1;
    for (let i = 0; i < steps; i++) race.update(dt / steps);
    sparks.update(dt); dust.update(dt);
    updateCamera(dt);
    updateHUD(dt);
    const P = race.player;
    audio.engine(P.speed, P.maxSpeed, P.boostT > 0, race.phase !== 'finished');
    audio.squeal(P.drift !== 0 && P.y < 0.1);
    if (race.snow) race.snow.position.set(P.x, 0, P.z), animateSnow(dt);
  } else if (state === 'menu') {
    menuT += dt;
    if (previewKart) {
      const k = previewKart;
      k.mesh.rotation.y += dt * 0.6;
      k.parts.front.forEach((f) => { f.rotation.y = Math.sin(menuT) * 0.3; });
      const charScreen = ui.current === 'char';
      const r = charScreen ? 6.2 : 11, a = charScreen ? k.h + 0.2 : menuT * 0.15;
      _camTarget.set(k.x + Math.sin(a) * r, charScreen ? 2.4 : 4.5, k.z + Math.cos(a) * r);
      camera.position.lerp(_camTarget, 1 - Math.exp(-3 * dt));
      // desplazar el kart a la derecha de la pantalla en la selección
      const side = charScreen && camera.aspect > 1 ? 1.8 : 0;
      const rx = Math.cos(a), rz = -Math.sin(a);
      camera.lookAt(k.x - rx * side, 1.1, k.z - rz * side);
      camera.fov = camera.aspect < 1 ? 80 : 55; camera.updateProjectionMatrix();
    }
    sparks.update(dt); dust.update(dt);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function animateSnow(dt) {
  const p = race.snow.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i) - dt * 6;
    if (y < 0) y += 50;
    p.setY(i, y);
    p.setX(i, p.getX(i) + Math.sin(y * 0.3 + i) * dt * 0.8);
  }
  p.needsUpdate = true;
}

// Inicio
race.loadTrack(0);
resize();
toMenu();
$('loading').classList.add('hidden');
requestAnimationFrame(frame);

// Exponer para pruebas automatizadas
window.__milex = { race, input, CHARACTERS, TRACKS, startRace, get state() { return state; } };
