// Milex: Juntos — servidor de salas para jugar online de a dos.
// Sirve los archivos del juego y retransmite los mensajes entre los dos jugadores de cada sala.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const STATIC_ROOTS = [
  { prefix: '/vendor/three/', dir: path.join(__dirname, 'node_modules/three') },
  { prefix: '/', dir: path.join(__dirname, 'public') },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  for (const root of STATIC_ROOTS) {
    if (!url.startsWith(root.prefix)) continue;
    let rel = url.slice(root.prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(root.dir, rel));
    if (!file.startsWith(root.dir)) break;
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('No encontrado');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      res.end(data);
    });
    return;
  }
  res.writeHead(404);
  res.end('No encontrado');
});

// ---------------------------------------------------------------- salas

/** @type {Map<string, Room>} */
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

class Room {
  constructor(code) {
    this.code = code;
    this.players = []; // { ws, id, name, character, ready }
    this.started = false;
    this.startTime = 0;
    this.world = {}; // estado compartido del nivel: palancas, cajas rotas, botones juntados
    this.emptySince = 0;
  }

  lobbyInfo() {
    return {
      t: 'lobby',
      code: this.code,
      started: this.started,
      players: this.players.map((p) => ({ id: p.id, name: p.name, character: p.character, host: p === this.players[0] })),
    };
  }

  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    for (const p of this.players) {
      if (p.ws !== except && p.ws.readyState === 1) p.ws.send(data);
    }
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function cleanName(name) {
  return String(name || 'Jugador').replace(/[<>]/g, '').trim().slice(0, 16) || 'Jugador';
}

const wss = new WebSocketServer({ server, path: '/ws' });
let nextId = 1;

wss.on('connection', (ws) => {
  const me = { ws, id: nextId++, name: 'Jugador', character: null, room: null };
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const room = me.room;

    switch (msg.t) {
      case 'ping':
        send(ws, { t: 'pong', c: msg.c, s: Date.now() });
        break;

      case 'create': {
        if (room) return;
        const r = new Room(newCode());
        rooms.set(r.code, r);
        me.name = cleanName(msg.name);
        me.character = 'exe';
        me.room = r;
        r.players.push(me);
        send(ws, { t: 'joined', id: me.id, code: r.code });
        send(ws, r.lobbyInfo());
        break;
      }

      case 'join': {
        if (room) return;
        const code = String(msg.code || '').toUpperCase().trim();
        const r = rooms.get(code);
        if (!r) return send(ws, { t: 'error', msg: 'No existe una sala con ese código.' });
        // Reconexión: si la partida ya empezó y falta alguien, se puede volver a entrar.
        if (r.players.length >= 2) return send(ws, { t: 'error', msg: 'La sala está llena.' });
        me.name = cleanName(msg.name);
        const taken = r.players.map((p) => p.character);
        me.character = taken.includes('exe') ? 'mile' : 'exe';
        me.room = r;
        r.players.push(me);
        r.emptySince = 0;
        send(ws, { t: 'joined', id: me.id, code: r.code });
        r.broadcast(r.lobbyInfo());
        if (r.started) {
          send(ws, { t: 'start', startTime: r.startTime, world: r.world, players: r.lobbyInfo().players });
          r.broadcast({ t: 'partner-back', name: me.name }, ws);
        }
        break;
      }

      case 'swap': {
        // Intercambiar personajes (solo en el lobby)
        if (!room || room.started) return;
        for (const p of room.players) p.character = p.character === 'exe' ? 'mile' : 'exe';
        if (room.players.length === 1) room.players[0].character = msg.character === 'mile' ? 'mile' : 'exe';
        room.broadcast(room.lobbyInfo());
        break;
      }

      case 'start': {
        if (!room || room.started || room.players[0] !== me || room.players.length < 2) return;
        room.started = true;
        room.startTime = Date.now();
        room.world = {};
        room.broadcast({ t: 'start', startTime: room.startTime, world: room.world, players: room.lobbyInfo().players });
        break;
      }

      case 'restart': {
        if (!room || !room.started) return;
        room.world = {};
        room.broadcast({ t: 'restart' });
        break;
      }

      case 'state':
        // Posición/animación del jugador: se reenvía tal cual al compañero.
        if (room) room.broadcast(msg, ws);
        break;

      case 'ev': {
        // Eventos del mundo: se guardan para que una reconexión vea el mismo estado.
        if (!room) return;
        if (typeof msg.key === 'string' && msg.key.length < 40) room.world[msg.key] = msg.value ?? true;
        room.broadcast(msg, ws);
        break;
      }

      case 'fx':
        // Efectos momentáneos (catapulta, abrazo, saludo): solo se retransmiten.
        if (room) room.broadcast(msg, ws);
        break;
    }
  });

  ws.on('close', () => {
    const r = me.room;
    if (!r) return;
    r.players = r.players.filter((p) => p !== me);
    if (r.players.length === 0) {
      r.emptySince = Date.now();
    } else {
      r.broadcast({ t: 'partner-left', name: me.name });
      r.broadcast(r.lobbyInfo());
    }
  });
});

// Mantener conexiones vivas y limpiar salas vacías
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, r] of rooms) {
    if (r.players.length === 0 && now - r.emptySince > 10 * 60 * 1000) rooms.delete(code);
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`Milex: Juntos escuchando en http://localhost:${PORT}`);
});
