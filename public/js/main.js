// Milex: Juntos — arranque, menú, lobby online y bucle del juego.
import * as THREE from 'three';
import { World } from './world.js';
import { Player, RemotePlayer } from './player.js';
import { Effects } from './effects.js';
import { Net } from './net.js';
import { PeerNet } from './peernet.js';
import { sfx, unlockAudio, startMusic, toggleMusic } from './audio.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- render

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

function makeScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#d4ebf7', 90, 460);
  // cielo con degradé
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 top = vec3(0.31,0.6,0.9);
          vec3 mid = vec3(0.66,0.85,0.97);
          vec3 low = vec3(1.0,0.9,0.78);
          vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(low, mid, smoothstep(-0.1, 0.15, h));
          // sol
          vec3 sd = normalize(vec3(0.45, 0.55, 0.35));
          float s = max(dot(vP, sd), 0.0);
          c += vec3(1.0,0.9,0.6) * (pow(s, 400.0) * 2.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight('#cfe8ff', '#8a6a4a', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#ffd6e8', 0.5);
  fill.position.set(-30, 20, -10);
  scene.add(fill);
  return { scene, sun, sky };
}

// ---------------------------------------------------------------- entrada

const keys = new Set();
const pressed = new Set();
let mouseDX = 0, mouseDY = 0;
let rightClick = false;

addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  } else if (dragging) {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  }
});
let dragging = false;
canvas.addEventListener('mousedown', (e) => {
  if (!game) return;
  if (e.button === 2) rightClick = true;
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
    dragging = true;
  }
});
addEventListener('mouseup', () => (dragging = false));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  if (!game) return;
  const locked = document.pointerLockElement === canvas;
  $('click-hint').classList.toggle('show', !locked && !game.paused && !game.won);
  if (locked) wasLocked = true;
  else if (wasLocked && !game.won) setPaused(true);
});
let wasLocked = false;

function readGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (p && p.connected) return p;
  }
  return null;
}
const padPrev = {};
function padButton(p, i) {
  const v = p && p.buttons[i] && p.buttons[i].pressed;
  const was = padPrev[i];
  padPrev[i] = v;
  return { held: !!v, down: !!v && !was };
}

// ---------------------------------------------------------------- estado global

// Con el servidor Node (npm start) las salas pasan por WebSocket; en un hosting estático
// (Vercel) las dos compus se conectan directo por WebRTC.
let net = new PeerNet();
fetch('/health')
  .then((r) => (r.ok ? r.text() : ''))
  .then((t) => {
    if (t.trim() !== 'ok') return;
    const ws = new Net();
    ws.handlers = net.handlers;
    net = ws;
  })
  .catch(() => {});
let game = null;
let myName = localStorage.getItem('milex-name') || '';
let lobby = null;
let myId = 0;
$('name').value = myName;
const params = new URLSearchParams(location.search);
if (params.get('sala')) $('code').value = params.get('sala').toUpperCase();

function show(id) {
  for (const s of ['menu', 'lobby', 'pause', 'victory', 'loading']) $(s).classList.toggle('visible', s === id);
}

let toastTimer = null;
function toast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function saveName() {
  myName = $('name').value.trim() || (Math.random() < 0.5 ? 'Exe' : 'Mile');
  try {
    localStorage.setItem('milex-name', myName);
  } catch {}
}

async function ensureNet() {
  if (net.open) return;
  await net.connect();
}

// ---------------------------------------------------------------- menú y lobby

$('btn-create').onclick = async () => {
  unlockAudio();
  saveName();
  try {
    await ensureNet();
    net.send({ t: 'create', name: myName });
  } catch (e) {
    $('menu-error').textContent = e.message;
  }
};

$('btn-join').onclick = async () => {
  unlockAudio();
  saveName();
  const code = $('code').value.trim().toUpperCase();
  if (code.length !== 4) {
    $('menu-error').textContent = 'El código tiene 4 letras.';
    return;
  }
  try {
    await ensureNet();
    net.send({ t: 'join', code, name: myName });
  } catch (e) {
    $('menu-error').textContent = e.message;
  }
};
$('code').addEventListener('keydown', (e) => e.key === 'Enter' && $('btn-join').click());

$('btn-solo').onclick = () => {
  unlockAudio();
  saveName();
  startGame({ mode: 'solo', myKind: 'exe', startTime: Date.now(), world: {} });
};

$('btn-swap').onclick = () => net.send({ t: 'swap', character: lobbyMine()?.character === 'exe' ? 'mile' : 'exe' });
$('btn-start').onclick = () => net.send({ t: 'start' });
$('btn-copy').onclick = async () => {
  const link = `${location.origin}${location.pathname}?sala=${lobby.code}`;
  try {
    await navigator.clipboard.writeText(link);
    $('btn-copy').textContent = '¡Link copiado! 💌';
  } catch {
    $('btn-copy').textContent = link;
  }
  setTimeout(() => ($('btn-copy').textContent = 'Copiar link de invitación'), 2500);
};

function lobbyMine() {
  return lobby && lobby.players.find((p) => p.id === myId);
}

function renderLobby() {
  if (!lobby) return;
  $('lobby-code').textContent = lobby.code;
  const mine = lobbyMine();
  for (const kind of ['exe', 'mile']) {
    const p = lobby.players.find((x) => x.character === kind);
    const card = $('card-' + kind);
    card.querySelector('.who').textContent = p ? (p.id === myId ? `${p.name} (vos)` : p.name) : 'Esperando jugador…';
    card.classList.toggle('mine', !!p && p.id === myId);
  }
  const isHost = mine && mine.host;
  const btn = $('btn-start');
  if (lobby.players.length < 2) {
    btn.disabled = true;
    btn.textContent = 'Esperando a tu compañero…';
  } else if (isHost) {
    btn.disabled = false;
    btn.textContent = '¡Empezar aventura!';
  } else {
    btn.disabled = true;
    btn.textContent = 'El anfitrión empieza la partida';
  }
}

net.on('joined', (m) => {
  myId = m.id;
  history.replaceState(null, '', `?sala=${m.code}`);
});
net.on('lobby', (m) => {
  const had = lobby ? lobby.players.length : 0;
  lobby = m;
  if (!game) {
    show('lobby');
    if (m.players.length === 2 && had === 1) sfx.partner();
  }
  renderLobby();
});
net.on('error', (m) => ($('menu-error').textContent = m.msg));
net.on('start', (m) => {
  const me = m.players.find((p) => p.id === myId);
  const partner = m.players.find((p) => p.id !== myId);
  startGame({
    mode: 'online',
    myKind: me.character,
    partnerName: partner ? partner.name : 'Compañero',
    startTime: m.startTime,
    world: m.world,
    rejoin: Object.keys(m.world || {}).length > 0,
  });
});
net.on('state', (m) => game && game.remote && game.remote.push(m, performance.now()));
net.on('ev', (m) => game && game.world.applyEvent(m.key, m.value, true));
net.on('fx', (m) => game && onFx(m));
net.on('restart', () => game && restartGame());
net.on('partner-left', (m) => {
  if (game) toast(`${m.name} se desconectó… esperando que vuelva`, 4000);
});
net.on('partner-back', (m) => {
  if (game) {
    toast(`¡${m.name} volvió!`);
    sfx.partner();
  }
});
net.on('close', () => {
  if (game && game.mode === 'online') toast('Se perdió la conexión con el servidor', 5000);
});

// ---------------------------------------------------------------- juego

function startGame(opts) {
  show('loading');
  // dejar que se pinte la pantalla de carga
  setTimeout(() => {
    buildGame(opts);
    show(null);
    $('hud').classList.remove('hidden');
    $('click-hint').classList.add('show');
    startMusic();
  }, 30);
}

function buildGame(opts) {
  const { scene, sun } = makeScene();
  const effects = new Effects(scene);
  const world = new World(scene);
  world.effects = effects;
  world.sfx = sfx;

  const g = {
    mode: opts.mode,
    opts,
    scene,
    sun,
    world,
    effects,
    players: [],
    active: 0,
    remote: null,
    startTime: opts.startTime,
    yaw: 0,
    pitch: 0.32,
    camDist: 7,
    camPos: new THREE.Vector3(),
    camTarget: new THREE.Vector3(),
    sendTimer: 0,
    paused: false,
    won: false,
    lastCollected: 0,
    clock: performance.now(),
    shake: 0,
    rejoinPending: !!opts.rejoin,
    playTime: 0,
  };

  const makeLocal = (kind) => {
    const p = new Player(kind, world, effects, sfx);
    p.spawnAt(0);
    scene.add(p.model.root);
    p.onPoundLand = (pos) => onPoundLand(p, pos);
    p.onCheckpoint = (cp) => {
      if (p === g.players[g.active]) {
        toast('¡Punto de control!', 1500);
        sfx.checkpoint();
        cp.flagMat.color.set(p.kind === 'exe' ? '#3f7fe0' : '#ec5d93');
      }
    };
    return p;
  };

  if (opts.mode === 'solo') {
    g.players.push(makeLocal('exe'), makeLocal('mile'));
  } else {
    g.players.push(makeLocal(opts.myKind));
    const other = opts.myKind === 'exe' ? 'mile' : 'exe';
    g.remote = new RemotePlayer(other);
    scene.add(g.remote.model.root);
    g.partnerName = opts.partnerName;
    world.onLocalEvent = (key, value) => net.send({ t: 'ev', key, value });
  }
  world.loadState(opts.world || {});
  g.lastCollected = world.collectedCount;
  $('hud-total').textContent = world.collectibles.length;

  game = g;
  g.camTarget.copy(g.players[0].pos);
  g.camPos.copy(g.players[0].pos).add(new THREE.Vector3(0, 3, 8));
  updateAbilityHud();
}

function restartGame() {
  const opts = { ...game.opts, world: {}, rejoin: false };
  if (game.mode === 'online') opts.startTime = game.startTime;
  disposeGame();
  buildGame(opts);
  show(null);
  $('hud').classList.remove('hidden');
}

function disposeGame() {
  if (!game) return;
  game.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  game = null;
}

function quitToMenu() {
  disposeGame();
  if (document.pointerLockElement) document.exitPointerLock();
  net.close();
  lobby = null;
  $('hud').classList.add('hidden');
  history.replaceState(null, '', location.pathname);
  show('menu');
}

function setPaused(p) {
  if (!game) return;
  game.paused = p;
  show(p ? 'pause' : null);
  $('click-hint').classList.toggle('show', !p && document.pointerLockElement !== canvas);
}

$('btn-resume').onclick = () => {
  setPaused(false);
  canvas.requestPointerLock?.();
};
// en línea el servidor devuelve 'restart' a los dos, así reinician juntos
const requestRestart = () => (game.mode === 'online' ? net.send({ t: 'restart' }) : restartGame());
$('btn-restart').onclick = requestRestart;
$('btn-quit').onclick = quitToMenu;
$('btn-victory-quit').onclick = quitToMenu;
$('btn-again').onclick = requestRestart;

function activePlayer() {
  return game.players[game.active];
}

function partnerOf(p) {
  if (game.mode === 'solo') return game.players.find((x) => x !== p);
  return game.remote && game.remote.state ? game.remote : null;
}

function updateAbilityHud() {
  const p = activePlayer();
  const lines = [`Jugás con <b>${p.kind === 'exe' ? 'Exe' : 'Mile'}</b>`];
  lines.push('<b>Espacio</b> saltar ×2 · <b>Shift</b> correr · <b>E</b> usar');
  if (p.kind === 'exe') lines.push('<b>Ctrl / Clic der.</b> en el aire: golpe de suelo');
  else lines.push('<b>Mantener Espacio</b> tras el doble salto: planear');
  lines.push('<b>F</b> abrazo · <b>1</b> saludo · <b>2</b> baile · <b>R</b> reaparecer');
  if (game.mode === 'solo') lines.push('<b>Tab</b> cambiar de personaje');
  $('hud-ability').innerHTML = lines.join('<br>');
}

function onPoundLand(p, pos) {
  const world = game.world;
  game.shake = 0.35;
  // romper cajas agrietadas cercanas
  for (const b of world.breakables) {
    if (b.broken) continue;
    const c = b.col;
    const dx = Math.max(c.min.x - pos.x, 0, pos.x - c.max.x);
    const dz = Math.max(c.min.z - pos.z, 0, pos.z - c.max.z);
    if (Math.hypot(dx, dz) < 2.4 && pos.y > c.min.y - 0.6 && pos.y < c.max.y + 0.6) world.applyEvent(b.id, true, false);
  }
  // catapulta
  const z = world.catapult.poundZone;
  if (pos.x > z.min.x && pos.x < z.max.x && pos.z > z.min.z && pos.z < z.max.z && pos.y < z.max.y) {
    fireCatapult();
    if (game.mode === 'online') net.send({ t: 'fx', kind: 'catapult' });
  }
}

function fireCatapult() {
  const world = game.world;
  world.fireCatapult();
  sfx.boing();
  const z = world.catapult.launchZone;
  for (const p of game.players) {
    if (p.pos.x > z.min.x && p.pos.x < z.max.x && p.pos.z > z.min.z && p.pos.z < z.max.z && p.pos.y < z.max.y) {
      p.launch(0, 24, -5.2, 0.9);
      game.effects.dustPuff(p.pos, 14, 3);
    }
  }
}

function onFx(m) {
  if (m.kind === 'catapult') fireCatapult();
  else if (m.kind === 'hug') {
    const me = game.players[0];
    me.facing = Math.atan2(game.remote.pos.x - me.pos.x, game.remote.pos.z - me.pos.z);
    me.emote('hug', 2.4);
    game.effects.heartBurst(midpoint(me.pos, game.remote.pos), 14);
    sfx.hug();
  } else if (m.kind === 'victory') {
    if (!game.won) win();
  }
}

function midpoint(a, b) {
  return new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + 1.4, (a.z + b.z) / 2);
}

function tryHug(p) {
  const other = partnerOf(p);
  if (!other || other.pos.distanceTo(p.pos) > 2.4) return false;
  p.facing = Math.atan2(other.pos.x - p.pos.x, other.pos.z - p.pos.z);
  p.emote('hug', 2.4);
  if (game.mode === 'solo') {
    other.facing = Math.atan2(p.pos.x - other.pos.x, p.pos.z - other.pos.z);
    other.emote('hug', 2.4);
  } else {
    net.send({ t: 'fx', kind: 'hug' });
  }
  game.effects.heartBurst(midpoint(p.pos, other.pos), 14);
  sfx.hug();
  return true;
}

function nearLever(p) {
  for (const l of game.world.levers) {
    if (game.world.state[l.id]) continue;
    if (Math.hypot(l.pos.x - p.pos.x, l.pos.z - p.pos.z) < 1.9 && Math.abs(l.pos.y - p.pos.y) < 1.5) return l;
  }
  return null;
}

function win() {
  game.won = true;
  for (const p of game.players) p.emote('celebrate', 999);
  const center = game.world.bloom.goal.center.clone().add(new THREE.Vector3(0, 2, 0));
  game.effects.confetti(center, 220);
  game.effects.heartBurst(center, 30);
  sfx.victory();
  const mins = Math.floor(game.playTime / 60);
  const secs = Math.floor(game.playTime % 60);
  setTimeout(() => {
    if (!game) return;
    $('victory-stats').innerHTML = `Botones encontrados: <b>${game.world.collectedCount}/${game.world.collectibles.length}</b> · Tiempo: <b>${mins}:${String(secs).padStart(2, '0')}</b>`;
    if (document.pointerLockElement) document.exitPointerLock();
    $('hud').classList.add('hidden');
    show('victory');
  }, 2600);
}

// ---------------------------------------------------------------- cámara

const raycaster = new THREE.Raycaster();
const box = new THREE.Box3();
const hitPoint = new THREE.Vector3();

function updateCamera(dt, p) {
  const sens = 0.0024;
  game.yaw -= mouseDX * sens;
  game.pitch = Math.max(-0.35, Math.min(1.25, game.pitch + mouseDY * sens));
  mouseDX = mouseDY = 0;

  const pad = readGamepad();
  if (pad) {
    const rx = Math.abs(pad.axes[2]) > 0.15 ? pad.axes[2] : 0;
    const ry = Math.abs(pad.axes[3]) > 0.15 ? pad.axes[3] : 0;
    game.yaw -= rx * dt * 2.8;
    game.pitch = Math.max(-0.35, Math.min(1.25, game.pitch + ry * dt * 2));
  }

  const target = game.camTarget;
  const want = p.pos.clone().add(new THREE.Vector3(0, 1.35, 0));
  // la cámara sigue con suavidad, un poco más lenta en vertical (como en los plataformeros 3D)
  target.x += (want.x - target.x) * (1 - Math.exp(-12 * dt));
  target.z += (want.z - target.z) * (1 - Math.exp(-12 * dt));
  target.y += (want.y - target.y) * (1 - Math.exp(-(p.grounded ? 8 : 4) * dt));

  const dist = game.camDist;
  const dir = new THREE.Vector3(Math.sin(game.yaw) * Math.cos(game.pitch), Math.sin(game.pitch), Math.cos(game.yaw) * Math.cos(game.pitch));
  // colisión de la cámara con el escenario
  raycaster.set(target, dir);
  let maxD = dist;
  for (const c of game.world.colliders) {
    if (!c.enabled || c.tag === 'move') continue;
    box.min.copy(c.min);
    box.max.copy(c.max);
    if (box.containsPoint(target)) continue;
    if (raycaster.ray.intersectBox(box, hitPoint)) {
      const d = hitPoint.distanceTo(target) - 0.3;
      if (d < maxD) maxD = Math.max(1.2, d);
    }
  }
  const camPos = target.clone().addScaledVector(dir, maxD);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt);
    const s = game.shake * 0.5;
    camPos.x += (Math.random() - 0.5) * s;
    camPos.y += (Math.random() - 0.5) * s;
  }
  game.camPos.lerp(camPos, maxD < game.camPos.distanceTo(target) ? 1 : 1 - Math.exp(-10 * dt));
  camera.position.copy(game.camPos);
  camera.lookAt(target);
  camera.fov += ((p.vel.lengthSq() > 60 ? 66 : 60) - camera.fov) * (1 - Math.exp(-3 * dt));
  camera.updateProjectionMatrix();

  // el sol sigue al jugador para que las sombras sean nítidas
  game.sun.position.set(target.x + 22, target.y + 34, target.z + 16);
  game.sun.target.position.copy(target);
}

// ---------------------------------------------------------------- HUD

const tagEl = $('partner-tag');
const v3 = new THREE.Vector3();
function updateHud(p) {
  const world = game.world;
  const count = world.collectedCount;
  $('hud-buttons').querySelector('span').textContent = count;
  if (count !== game.lastCollected) {
    game.lastCollected = count;
    $('hud-buttons').animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
  }
  $('hud-section').textContent = world.sectionName(p.pos);
  $('hud-ping').textContent = game.mode === 'online' ? `${Math.round(net.rtt)} ms` : 'modo práctica';

  // etiqueta del compañero (con flecha si está fuera de pantalla)
  const other = partnerOf(p);
  if (other) {
    tagEl.style.display = 'flex';
    tagEl.className = other.kind;
    tagEl.querySelector('.pname').textContent = game.mode === 'solo' ? (other.kind === 'exe' ? 'Exe' : 'Mile') : game.partnerName;
    v3.copy(other.pos).add(new THREE.Vector3(0, 1.75, 0)).project(camera);
    const behind = v3.z > 1;
    let x = (v3.x * 0.5 + 0.5) * innerWidth;
    let y = (-v3.y * 0.5 + 0.5) * innerHeight;
    if (behind) {
      x = innerWidth - x;
      y = innerHeight - 40;
    }
    const m = 40;
    const off = behind || x < m || x > innerWidth - m || y < m + 30 || y > innerHeight - m;
    x = Math.max(m, Math.min(innerWidth - m, x));
    y = Math.max(m + 30, Math.min(innerHeight - m, y));
    tagEl.classList.toggle('offscreen', off);
    if (off) {
      const ang = Math.atan2(y - innerHeight / 2, x - innerWidth / 2) + Math.PI / 2;
      tagEl.querySelector('.arrow').style.transform = `rotate(${ang}rad)`;
    }
    tagEl.style.left = `${x}px`;
    tagEl.style.top = `${y}px`;
  } else {
    tagEl.style.display = 'none';
  }

  // indicaciones contextuales
  const prompt = $('prompt');
  const lever = nearLever(p);
  let text = '';
  if (lever) text = `E — Activar ${lever.label}`;
  else if (other && other.pos.distanceTo(p.pos) < 2.4 && p.action !== 'hug') text = 'F — Abrazo 💞';
  else if (p.kind === 'mile' && insideZone(p.pos, world.catapult.launchZone) && world.catapult.fireT < 0)
    text = game.mode === 'solo' ? 'Tab: cambiá a Exe y golpeá el mango' : 'Esperá a que Exe golpee el mango';
  prompt.textContent = text;
  prompt.classList.toggle('show', !!text);
}

function insideZone(pos, z) {
  return pos.x > z.min.x && pos.x < z.max.x && pos.z > z.min.z && pos.z < z.max.z && pos.y < z.max.y && pos.y > z.min.y;
}

// ---------------------------------------------------------------- bucle principal

const noInput = { dir: new THREE.Vector3(), jumpPressed: false, jumpHeld: false, poundPressed: false, sprint: false };

function gatherInput() {
  const pad = readGamepad();
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  let jumpPressed = pressed.has('Space');
  let jumpHeld = keys.has('Space');
  let poundPressed = pressed.has('ControlLeft') || pressed.has('ControlRight') || pressed.has('KeyC') || rightClick;
  let sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  let interact = pressed.has('KeyE');
  let hug = pressed.has('KeyF');
  if (pad) {
    const ax = Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : 0;
    const ay = Math.abs(pad.axes[1]) > 0.18 ? pad.axes[1] : 0;
    ix += ax;
    iz -= ay;
    const a = padButton(pad, 0), b = padButton(pad, 1), x = padButton(pad, 2), y = padButton(pad, 3), rb = padButton(pad, 5);
    jumpPressed ||= a.down;
    jumpHeld ||= a.held;
    poundPressed ||= b.down;
    interact ||= x.down;
    hug ||= y.down;
    sprint ||= rb.held || Math.hypot(ax, ay) > 0.95;
  }
  const len = Math.hypot(ix, iz);
  if (len > 1) {
    ix /= len;
    iz /= len;
  }
  const fwd = new THREE.Vector3(-Math.sin(game.yaw), 0, -Math.cos(game.yaw));
  const right = new THREE.Vector3(Math.cos(game.yaw), 0, -Math.sin(game.yaw));
  const dir = fwd.multiplyScalar(iz).addScaledVector(right, ix);
  return { dir, jumpPressed, jumpHeld, poundPressed, sprint, interact, hug };
}

function syncedTime() {
  const now = game.mode === 'online' ? net.serverNow() : Date.now();
  return (now - game.startTime) / 1000;
}

function frame() {
  requestAnimationFrame(frame);
  if (!game) {
    pressed.clear();
    return;
  }
  const now = performance.now();
  const dt = Math.min(0.05, (now - game.clock) / 1000);
  game.clock = now;
  const time = syncedTime();

  const p = activePlayer();
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  const input = game.paused || game.won || typing ? { ...noInput, interact: false, hug: false } : gatherInput();

  if (!game.paused && !game.won) {
    if (pressed.has('Tab') && game.mode === 'solo') {
      game.active = 1 - game.active;
      updateAbilityHud();
      toast(game.active === 0 ? 'Ahora sos Exe' : 'Ahora sos Mile', 1200);
    }
    if (pressed.has('KeyR')) p.respawn();
    if (pressed.has('Digit1')) {
      p.emote('wave', 1.8);
      sfx.wave();
    }
    if (pressed.has('Digit2')) p.emote('dance', 4);
    if (pressed.has('KeyM')) toast(toggleMusic() ? 'Música: sí 🎵' : 'Música: no', 1200);
    if (input.interact) {
      const l = nearLever(p);
      if (l) {
        p.facing = Math.atan2(l.pos.x - p.pos.x, l.pos.z - p.pos.z);
        p.emote('lever', 0.6);
        game.world.applyEvent(l.id, true, false);
        toast(l.id === 'L1' ? '¡El ascensor se puso en marcha!' : '¡El puente de lápiz se extiende!', 2000);
      }
    }
    if (input.hug) tryHug(p);
  }
  if (pressed.has('Escape') || pressed.has('KeyP')) setPaused(!game.paused);
  pressed.clear();
  rightClick = false;

  // física de los jugadores locales
  for (const pl of game.players) pl.update(dt, pl === p ? input : noInput);

  // compañero remoto
  if (game.remote) {
    game.remote.update(dt, now, sfx, game.effects);
    if (game.rejoinPending && game.remote.state) {
      game.rejoinPending = false;
      p.checkpoint = game.remote.checkpoint;
      p.respawn();
    }
  }

  const actors = [...game.players];
  if (game.remote && game.remote.state) actors.push(game.remote);
  game.world.update(dt, time, actors);
  game.effects.update(dt);

  for (const pl of game.players) pl.render(dt);
  if (game.remote) game.remote.render(dt);

  // enviar estado ~20 veces por segundo
  if (game.mode === 'online') {
    game.sendTimer -= dt;
    if (game.sendTimer <= 0) {
      game.sendTimer = 0.05;
      net.send({ t: 'state', ...p.serialize() });
    }
  }

  // llegada: los dos dentro del corazón
  if (!game.won) {
    game.playTime += dt;
    const other = partnerOf(p);
    if (other && game.world.isGoal(p.pos) && game.world.isGoal(other.pos)) {
      win();
      if (game.mode === 'online') net.send({ t: 'fx', kind: 'victory' });
    }
  }

  updateCamera(dt, p);
  updateHud(p);
  renderer.render(game.scene, camera);
}

// ---------------------------------------------------------------- fondo animado del menú

const menuScene = makeScene();
const menuWorld = { t: 0 };
(function menuBackdrop() {
  // Exe y Mile saludando en el menú
  import('./character.js').then(({ CharacterModel }) => {
    const exe = new CharacterModel('exe');
    const mile = new CharacterModel('mile');
    exe.root.position.set(-0.8, 0, 0);
    mile.root.position.set(0.8, 0, 0);
    exe.root.rotation.y = 0.35;
    mile.root.rotation.y = -0.35;
    menuScene.scene.add(exe.root, mile.root);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 40), new THREE.MeshStandardMaterial({ color: '#7cc35b', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    menuScene.scene.add(ground);
    menuScene.sun.position.set(4, 8, 6);
    let last = performance.now();
    const loop = () => {
      if (!game) {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        menuWorld.t += dt;
        const t = menuWorld.t;
        const cycle = t % 9;
        exe.update(dt, { speed: 0, grounded: true, vy: 0, action: cycle < 3 ? 'wave' : cycle < 6 ? 'dance' : 'none', actionT: 0, landImpact: 0, turnRate: 0, flipT: -1 });
        mile.update(dt, { speed: 0, grounded: true, vy: 0, action: cycle < 3 ? 'dance' : cycle < 6 ? 'wave' : 'none', actionT: 0, landImpact: 0, turnRate: 0, flipT: -1 });
        camera.position.set(Math.sin(t * 0.15) * 0.6, 1.2, 4.2);
        camera.lookAt(0, 0.75, 0);
        camera.fov = 45;
        camera.updateProjectionMatrix();
        renderer.render(menuScene.scene, camera);
      } else {
        last = performance.now();
      }
      requestAnimationFrame(loop);
    };
    loop();
  });
})();

requestAnimationFrame(frame);

// acceso para pruebas automáticas desde la consola
window.__milex = { get game() { return game; }, get net() { return net; } };
