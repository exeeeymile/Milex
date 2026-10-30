// Conexión WebSocket con el servidor de salas + sincronización de reloj.
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.offset = 0; // serverTime - Date.now()
    this.rtt = 0;
    this.pingTimer = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      ws.onopen = () => {
        this.ping();
        this.pingTimer = setInterval(() => this.ping(), 2000);
        resolve();
      };
      ws.onerror = () => reject(new Error('No se pudo conectar con el servidor.'));
      ws.onclose = () => {
        clearInterval(this.pingTimer);
        this.emit('close', {});
      };
      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.t === 'pong') {
          const now = Date.now();
          const rtt = now - msg.c;
          const offset = msg.s - (msg.c + rtt / 2);
          // suavizado: los primeros pings pesan más
          this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
          this.offset = this.samples ? this.offset * 0.8 + offset * 0.2 : offset;
          this.samples = (this.samples || 0) + 1;
          return;
        }
        this.emit(msg.t, msg);
      };
    });
  }

  get open() {
    return this.ws && this.ws.readyState === 1;
  }

  ping() {
    this.send({ t: 'ping', c: Date.now() });
  }

  serverNow() {
    return Date.now() + this.offset;
  }

  send(msg) {
    if (this.open) this.ws.send(JSON.stringify(msg));
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  emit(type, msg) {
    if (this.handlers[type]) this.handlers[type](msg);
  }

  close() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    clearInterval(this.pingTimer);
    this.ws = null;
  }
}
