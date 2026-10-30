// Conexión entre jugadores (WebRTC vía PeerJS) para el modo online.
// El anfitrión registra el id "milexkart-v1-<CÓDIGO>" en el servidor público de PeerJS;
// los invitados se conectan directo a ese id. El servidor solo presenta a los jugadores:
// los datos de la carrera viajan de dispositivo a dispositivo.
const PREFIX = 'milexkart-v1-';
let loading = null;

function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/peerjs.min.js';
      s.onload = res;
      s.onerror = () => { loading = null; rej(new Error('load')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

// ?peerhost=localhost&peerport=9000 permite usar un servidor propio (pruebas)
function peerOptions() {
  const q = new URLSearchParams(location.search);
  const o = { debug: 0 };
  if (q.get('peerhost')) {
    o.host = q.get('peerhost');
    o.port = +(q.get('peerport') || 9000);
    o.path = q.get('peerpath') || '/';
    o.secure = q.get('peersecure') === '1';
  }
  return o;
}

export function randomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[(Math.random() * A.length) | 0];
  return s;
}

export function netErrorText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'No existe una sala con ese código (o ya se cerró).';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo conectar al servidor. Revisá tu conexión a internet.';
  if (t === 'browser-incompatible') return 'Tu navegador no soporta el juego online.';
  if (e && e.message === 'timeout') return 'La sala no respondió. Probá de nuevo.';
  if (e && e.message === 'load') return 'No se pudo cargar el módulo online. Revisá tu conexión.';
  return 'Error de conexión. Probá de nuevo.';
}

export class NetSession {
  constructor() {
    this.peer = null;
    this.conns = new Map();
    this.role = null;
    this.handlers = {};
    this.closed = false;
    this.ready = false;
  }
  on(ev, fn) { this.handlers[ev] = fn; return this; }
  emit(ev, ...a) { if (!this.closed) this.handlers[ev]?.(...a); }
  async host(code) {
    await loadPeerJS();
    this.role = 'host';
    this.code = code;
    this.myId = 'host';
    await new Promise((res, rej) => {
      const peer = (this.peer = new window.Peer(PREFIX + code, peerOptions()));
      const to = setTimeout(() => rej(new Error('timeout')), 15000);
      peer.on('open', () => { clearTimeout(to); this.ready = true; res(); });
      peer.on('error', (e) => { if (!this.ready) { clearTimeout(to); rej(e); } else this.emit('error', e); });
      peer.on('connection', (c) => this.setupConn(c, c.peer));
      // si se cae el servidor de presentación, las partidas en curso siguen; reintentamos registrarnos
      peer.on('disconnected', () => { if (!this.closed) setTimeout(() => !this.closed && peer.reconnect(), 1500); });
    });
  }
  async join(code) {
    await loadPeerJS();
    this.role = 'guest';
    this.code = code;
    await new Promise((res, rej) => {
      const peer = (this.peer = new window.Peer(peerOptions()));
      let done = false;
      const fail = (e) => { if (!done) { done = true; clearTimeout(to); rej(e); } else this.emit('error', e); };
      const to = setTimeout(() => fail(new Error('timeout')), 15000);
      peer.on('error', fail);
      peer.on('open', (id) => {
        this.myId = id;
        const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        c.on('open', () => {
          if (done) return;
          done = true; clearTimeout(to);
          this.ready = true;
          this.setupConn(c, 'host');
          res();
        });
      });
    });
  }
  setupConn(c, id) {
    const ready = () => { this.conns.set(id, c); this.emit('join', id); };
    if (c.open) ready(); else c.on('open', ready);
    c.on('data', (m) => this.emit('message', id, m));
    c.on('close', () => {
      if (this.conns.get(id) === c) { this.conns.delete(id); this.emit('leave', id); }
    });
    c.on('error', () => {});
  }
  send(id, msg) {
    const c = this.conns.get(id);
    if (c && c.open) c.send(msg);
  }
  broadcast(msg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }
  close() {
    this.closed = true;
    for (const c of this.conns.values()) { try { c.close(); } catch { /* ya cerrada */ } }
    this.conns.clear();
    try { this.peer?.destroy(); } catch { /* ya destruido */ }
  }
}
