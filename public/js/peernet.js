// Salas sin servidor propio: las dos compus se conectan directo por WebRTC (PeerJS).
// Quien crea la sala hace de "servidor": guarda el estado del nivel y reenvía mensajes.
// Tiene la misma interfaz que Net (connect, send, on, serverNow, rtt, close).
const PREFIX = 'milex-juntos-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar la conexión online.'));
    document.head.appendChild(s);
  });
}

function newCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

export class PeerNet {
  constructor() {
    this.handlers = {};
    this.offset = 0;
    this.rtt = 0;
    this.peer = null;
    this.conn = null; // anfitrión: conexión con el invitado; invitado: conexión con el anfitrión
    this.isHost = false;
    this.room = null; // solo el anfitrión
    this.pingTimer = null;
  }

  async connect() {
    await loadPeerJS();
  }

  get open() {
    return true;
  }

  serverNow() {
    return Date.now() + this.offset;
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  emit(type, msg) {
    if (this.handlers[type]) this.handlers[type](msg);
  }

  close() {
    clearInterval(this.pingTimer);
    if (this.peer) this.peer.destroy();
    this.peer = null;
    this.conn = null;
    this.room = null;
    this.isHost = false;
  }

  send(msg) {
    if (msg.t === 'create') return this.createRoom(msg.name);
    if (msg.t === 'join') return this.joinRoom(msg.code, msg.name);
    if (msg.t === 'ping') return;
    if (this.isHost) this.handleHost(msg, 'host');
    else if (this.conn && this.conn.open) this.conn.send(msg);
  }

  // ---------------------------------------------------------------- anfitrión

  createRoom(name, attempt = 0) {
    const code = newCode();
    const peer = new window.Peer(PREFIX + code);
    this.peer = peer;
    peer.on('open', () => {
      this.isHost = true;
      this.room = {
        code,
        started: false,
        startTime: 0,
        world: {},
        players: [{ id: 1, name, character: 'exe' }],
      };
      this.emit('joined', { id: 1, code });
      this.emit('lobby', this.lobbyInfo());
    });
    peer.on('connection', (conn) => this.acceptGuest(conn));
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && attempt < 5) {
        peer.destroy();
        this.createRoom(name, attempt + 1);
      } else if (!this.isHost) {
        this.emit('error', { msg: 'No se pudo crear la sala. Revisá tu conexión a internet.' });
      }
    });
    peer.on('disconnected', () => {
      // se perdió el servidor de señalización: las conexiones ya hechas siguen andando
      if (!peer.destroyed) peer.reconnect();
    });
  }

  lobbyInfo() {
    const r = this.room;
    return {
      t: 'lobby',
      code: r.code,
      started: r.started,
      players: r.players.map((p, i) => ({ id: p.id, name: p.name, character: p.character, host: i === 0 })),
    };
  }

  toGuest(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }

  // mensaje para los dos (anfitrión local + invitado)
  toAll(msg) {
    this.emit(msg.t, msg);
    this.toGuest(msg);
  }

  acceptGuest(conn) {
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'join') {
        const r = this.room;
        if (!r || (this.conn && this.conn.open && this.conn !== conn) || r.players.length >= 2) {
          conn.send({ t: 'error', msg: 'La sala está llena.' });
          setTimeout(() => conn.close(), 300);
          return;
        }
        this.conn = conn;
        const name = String(msg.name || 'Jugador').replace(/[<>]/g, '').slice(0, 16) || 'Jugador';
        const character = r.players[0].character === 'exe' ? 'mile' : 'exe';
        r.players.push({ id: 2, name, character });
        conn.send({ t: 'joined', id: 2, code: r.code });
        this.toAll(this.lobbyInfo());
        if (r.started) {
          conn.send({ t: 'start', startTime: r.startTime, world: r.world, players: this.lobbyInfo().players });
          this.emit('partner-back', { name });
        }
        return;
      }
      if (conn === this.conn) this.handleHost(msg, 'guest');
    });
    conn.on('close', () => {
      if (conn !== this.conn) return;
      this.conn = null;
      const r = this.room;
      const guest = r.players[1];
      r.players = r.players.slice(0, 1);
      if (guest) this.emit('partner-left', { name: guest.name });
      this.emit('lobby', this.lobbyInfo());
    });
  }

  // La misma lógica que server.js, ejecutada en la compu del anfitrión
  handleHost(msg, from) {
    const r = this.room;
    if (!r) return;
    const relay = (m) => (from === 'host' ? this.toGuest(m) : this.emit(m.t, m));
    switch (msg.t) {
      case 'pong-req':
        if (from === 'guest') this.toGuest({ t: 'pong', c: msg.c, s: Date.now() });
        break;
      case 'swap':
        if (r.started) return;
        for (const p of r.players) p.character = p.character === 'exe' ? 'mile' : 'exe';
        this.toAll(this.lobbyInfo());
        break;
      case 'start':
        if (from !== 'host' || r.started || r.players.length < 2) return;
        r.started = true;
        r.startTime = Date.now();
        r.world = {};
        this.toAll({ t: 'start', startTime: r.startTime, world: r.world, players: this.lobbyInfo().players });
        break;
      case 'restart':
        if (!r.started) return;
        r.world = {};
        this.toAll({ t: 'restart' });
        break;
      case 'state':
      case 'fx':
        relay(msg);
        break;
      case 'ev':
        if (typeof msg.key === 'string' && msg.key.length < 40) r.world[msg.key] = msg.value ?? true;
        relay(msg);
        break;
    }
  }

  // ---------------------------------------------------------------- invitado

  joinRoom(code, name) {
    const peer = new window.Peer();
    this.peer = peer;
    let opened = false;
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => {
        opened = true;
        conn.send({ t: 'join', name });
        this.ping();
        this.pingTimer = setInterval(() => this.ping(), 2000);
      });
      conn.on('data', (msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'pong') {
          const now = Date.now();
          const rtt = now - msg.c;
          const offset = msg.s - (msg.c + rtt / 2);
          this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
          this.offset = this.samples ? this.offset * 0.8 + offset * 0.2 : offset;
          this.samples = (this.samples || 0) + 1;
          return;
        }
        this.emit(msg.t, msg);
      });
      conn.on('close', () => {
        clearInterval(this.pingTimer);
        if (opened) this.emit('partner-left', { name: 'Tu compañero (anfitrión)' });
      });
      setTimeout(() => {
        if (!opened) this.emit('error', { msg: 'No se pudo conectar con la sala. ¿El código es correcto y tu compañero sigue en el lobby?' });
      }, 15000);
    });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') this.emit('error', { msg: 'No existe una sala con ese código.' });
      else if (!opened) this.emit('error', { msg: 'No se pudo conectar. Revisá tu conexión a internet.' });
    });
  }

  ping() {
    if (this.conn && this.conn.open) this.conn.send({ t: 'pong-req', c: Date.now() });
  }
}
