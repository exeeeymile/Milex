// Controles táctiles para celular: joystick a la izquierda, botones a la derecha
// y arrastre con el dedo en el resto de la pantalla para mover la cámara.
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export const touch = {
  mx: 0, // joystick: derecha +
  mz: 0, // joystick: adelante +
  jumpHeld: false,
  camDX: 0,
  camDY: 0,
  events: new Set(),
  consume(name) {
    const had = this.events.has(name);
    this.events.delete(name);
    return had;
  },
};

let root = null;

export function setupTouch({ onPause }) {
  if (!isTouch || root) return;
  root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div class="t-stick"><div class="t-knob"></div></div>
    <button class="t-btn t-jump" data-ev="jump">⤒<small>Saltar</small></button>
    <button class="t-btn t-pound" data-ev="pound">⬇<small>Golpe</small></button>
    <button class="t-btn t-use" data-ev="use">✋<small>Usar</small></button>
    <button class="t-btn t-hug" data-ev="hug">💞<small>Abrazo</small></button>
    <button class="t-btn t-swap" data-ev="swap">⇄<small>Cambiar</small></button>
    <button class="t-mini t-pause">⏸</button>
    <button class="t-mini t-emote" data-ev="wave">👋</button>
    <button class="t-mini t-dance" data-ev="dance">💃</button>
  `;
  document.body.appendChild(root);

  // --- joystick
  const stick = root.querySelector('.t-stick');
  const knob = root.querySelector('.t-knob');
  let stickId = null;
  let cx = 0, cy = 0;
  const R = 55;
  const moveStick = (x, y) => {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = Math.min(1, d / R);
    const n = d > 6 ? k / Math.max(1e-6, Math.hypot(dx, dy)) : 0;
    touch.mx = dx * n;
    touch.mz = -dy * n;
  };
  const resetStick = () => {
    stickId = null;
    touch.mx = touch.mz = 0;
    knob.style.transform = '';
    stick.classList.remove('active');
  };
  stick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    stickId = t.identifier;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    stick.classList.add('active');
    moveStick(t.clientX, t.clientY);
  }, { passive: false });

  // --- cámara: cualquier dedo que no esté en el joystick ni en un botón
  const camTouches = new Map();
  const canvas = document.getElementById('game');
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) camTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) moveStick(t.clientX, t.clientY);
      const c = camTouches.get(t.identifier);
      if (c) {
        touch.camDX += (t.clientX - c.x) * 1.5;
        touch.camDY += (t.clientY - c.y) * 1.5;
        c.x = t.clientX;
        c.y = t.clientY;
      }
    }
    if (stickId !== null || camTouches.size) e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) resetStick();
      camTouches.delete(t.identifier);
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  // --- botones
  for (const b of root.querySelectorAll('[data-ev]')) {
    const ev = b.dataset.ev;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touch.events.add(ev);
      if (ev === 'jump') touch.jumpHeld = true;
      b.classList.add('down');
    }, { passive: false });
    const up = (e) => {
      e.preventDefault();
      if (ev === 'jump') touch.jumpHeld = false;
      b.classList.remove('down');
    };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
  }
  root.querySelector('.t-pause').addEventListener('touchstart', (e) => {
    e.preventDefault();
    onPause();
  }, { passive: false });
}

export function showTouch(visible, { kind, solo } = {}) {
  if (!root) return;
  root.classList.toggle('visible', visible);
  if (kind) root.querySelector('.t-pound').style.display = kind === 'exe' ? '' : 'none';
  root.querySelector('.t-swap').style.display = solo ? '' : 'none';
  if (!visible) {
    touch.mx = touch.mz = 0;
    touch.jumpHeld = false;
    touch.events.clear();
  }
}

export function goFullscreen() {
  const el = document.documentElement;
  if (!isTouch || document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
}
