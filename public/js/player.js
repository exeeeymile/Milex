// Control y física del personaje: correr, saltar, doble salto, planeo, golpe de suelo y colisiones.
import * as THREE from 'three';
import { CharacterModel } from './character.js';

const R = 0.3; // radio horizontal (caja de colisión)
const H = 1.25; // altura
const STEP = 0.36; // altura máxima de escalón

const TUNING = {
  exe: { walk: 5.6, sprint: 8.6, jump: 10.6, airJump: 9.4 },
  mile: { walk: 5.8, sprint: 8.8, jump: 10.8, airJump: 9.6 },
};
const GRAVITY = 28;

const tmp = new THREE.Vector3();

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Player {
  constructor(kind, world, effects, sfx) {
    this.kind = kind;
    this.world = world;
    this.effects = effects;
    this.sfx = sfx;
    this.model = new CharacterModel(kind);
    this.tune = TUNING[kind];

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.grounded = false;
    this.groundCol = null;
    this.disc = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJumps = 1;
    this.jumpsUsed = 0;
    this.action = 'none';
    this.actionT = 0;
    this.flipT = -1;
    this.landImpact = 0;
    this.controlLock = 0;
    this.stun = 0;
    this.gliding = false;
    this.checkpoint = 0;
    this.lastStep = 0;
    this.turnRate = 0;
    this.respawnFade = 0;
    this.hugTarget = null;

    // callbacks que conecta main.js
    this.onPoundLand = null;
    this.onCheckpoint = null;
    this.onRespawn = null;
  }

  spawnAt(index) {
    const cp = this.world.checkpoints[index];
    const side = this.kind === 'exe' ? -1 : 1;
    this.pos.set(cp.pos.x + side * 1.2, cp.pos.y + 0.5, cp.pos.z);
    this.vel.set(0, 0, 0);
    this.facing = cp.rotY;
    this.action = 'none';
    this.stun = 0;
    this.controlLock = 0;
    this.grounded = false;
    this.groundCol = null;
    this.disc = null;
  }

  respawn() {
    this.spawnAt(this.checkpoint);
    this.respawnFade = 1;
    if (this.effects) this.effects.sparkle(this.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), this.kind === 'exe' ? '#7fb4ff' : '#ff9cc3', 24);
    if (this.onRespawn) this.onRespawn();
  }

  launch(vx, vy, vz, lock = 0.6) {
    this.vel.set(vx, vy, vz);
    this.grounded = false;
    this.groundCol = null;
    this.disc = null;
    this.controlLock = lock;
    this.jumpsUsed = 1;
    this.airJumps = 1;
    this.action = 'none';
    this.flipT = 0;
  }

  emote(name, duration = 2.2) {
    if (!this.grounded) return;
    this.action = name;
    this.actionT = 0;
    this.actionDur = duration;
  }

  overlaps(c) {
    return (
      c.enabled &&
      this.pos.x - R < c.max.x && this.pos.x + R > c.min.x &&
      this.pos.z - R < c.max.z && this.pos.z + R > c.min.z &&
      this.pos.y < c.max.y && this.pos.y + H > c.min.y
    );
  }

  /**
   * @param {number} dt
   * @param {{dir: THREE.Vector3, jumpPressed: boolean, jumpHeld: boolean, poundPressed: boolean, sprint: boolean}} input
   */
  update(dt, input) {
    // subpasos para colisiones estables
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h, input, i === 0);
    this.postUpdate(dt);
  }

  step(dt, input, first) {
    const world = this.world;
    const t = this.tune;
    const dir = input.dir;
    const hasInput = dir.lengthSq() > 0.001;

    this.controlLock = Math.max(0, this.controlLock - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.actionT += dt;
    if (this.flipT >= 0) this.flipT += dt;
    if (this.flipT > 0.5) this.flipT = -1;

    // Emotes: se cortan al moverse o saltar
    if (['wave', 'dance', 'hug', 'lever'].includes(this.action)) {
      if ((hasInput && this.action !== 'lever') || input.jumpPressed || this.actionT > this.actionDur) this.action = 'none';
    }

    // Arrastre por plataformas móviles / tocadiscos
    if (this.grounded && this.groundCol && first) {
      this.pos.add(this.groundCol.delta);
    }
    if (this.grounded && this.disc && first) {
      const d = this.disc;
      const a = d.delta;
      const dx = this.pos.x - d.center.x, dz = this.pos.z - d.center.z;
      const c = Math.cos(-a), s = Math.sin(-a);
      this.pos.x = d.center.x + dx * c - dz * s;
      this.pos.z = d.center.z + dx * s + dz * c;
      this.facing -= a;
    }

    // ----- Entrada horizontal
    const canControl = this.controlLock <= 0 && this.stun <= 0 && this.action !== 'pound' && !['hug', 'lever'].includes(this.action);
    const speed = input.sprint ? t.sprint : t.walk;
    let targetVX = 0, targetVZ = 0;
    if (canControl && hasInput) {
      const maxSp = this.gliding ? 7 : speed;
      targetVX = dir.x * maxSp;
      targetVZ = dir.z * maxSp;
    }
    const accel = this.grounded ? (hasInput ? 55 : 40) : this.controlLock > 0 ? 2 : 16;
    const k = 1 - Math.exp(-accel * dt / 6);
    if (this.action !== 'pound' && this.stun <= 0) {
      this.vel.x += (targetVX - this.vel.x) * k;
      this.vel.z += (targetVZ - this.vel.z) * k;
    }

    // Orientación hacia donde se mueve
    if (canControl && hasInput) {
      const target = Math.atan2(dir.x, dir.z);
      const prev = this.facing;
      this.facing = angleLerp(this.facing, target, 1 - Math.exp(-14 * dt));
      this.turnRate = (this.facing - prev) / dt;
    } else {
      this.turnRate *= 0.9;
    }

    // ----- Saltos
    if (this.grounded) {
      this.coyote = 0.11;
      this.jumpsUsed = 0;
      this.airJumps = 1;
    } else {
      this.coyote -= dt;
    }
    if (input.jumpPressed && first) this.jumpBuffer = 0.13;
    else this.jumpBuffer -= dt;

    if (this.jumpBuffer > 0 && this.stun <= 0 && this.action !== 'pound') {
      if (this.coyote > 0) {
        this.vel.y = t.jump;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpsUsed = 1;
        this.groundCol = null;
        this.disc = null;
        if (['wave', 'dance', 'hug', 'lever'].includes(this.action)) this.action = 'none';
        this.sfx.jump(this.kind);
        this.effects.dustPuff(this.pos, 5, 1.2);
      } else if (this.airJumps > 0) {
        this.vel.y = t.airJump;
        this.airJumps--;
        this.jumpsUsed = 2;
        this.jumpBuffer = 0;
        this.flipT = 0;
        this.sfx.doubleJump(this.kind);
        this.effects.sparkle(this.pos.clone().add(tmp.set(0, 0.3, 0)), this.kind === 'exe' ? '#9cc6ff' : '#ffb3d1', 10);
      }
    }

    // ----- Habilidades
    // Mile: planeo manteniendo saltar al caer después de usar el doble salto
    const wasGliding = this.gliding;
    this.gliding =
      this.kind === 'mile' && !this.grounded && input.jumpHeld && this.vel.y < 0.5 && this.jumpsUsed >= 2 && this.stun <= 0 && this.controlLock <= 0;
    if (this.gliding && !wasGliding) this.sfx.glideOpen();
    if (this.gliding) this.action = 'glide';
    else if (this.action === 'glide') this.action = 'none';

    // Exe: golpe de suelo
    if (this.kind === 'exe' && input.poundPressed && first && !this.grounded && this.action !== 'pound' && this.stun <= 0) {
      this.action = 'pound';
      this.actionT = 0;
      this.vel.set(0, 0, 0);
      this.sfx.poundStart();
    }

    // ----- Gravedad
    const inUpdraft = world.updrafts.some((u) => this.pos.x > u.min.x && this.pos.x < u.max.x && this.pos.z > u.min.z && this.pos.z < u.max.z && this.pos.y > u.min.y && this.pos.y < u.max.y);
    this.inUpdraft = inUpdraft;
    if (this.action === 'pound') {
      if (this.actionT < 0.28) this.vel.y = 0.6;
      else this.vel.y = -32;
    } else if (this.gliding) {
      if (inUpdraft) this.vel.y = Math.min(8, this.vel.y + 42 * dt);
      else this.vel.y = Math.max(-2.3, this.vel.y - GRAVITY * 0.3 * dt);
    } else {
      const g = inUpdraft ? (this.kind === 'mile' ? GRAVITY * 0.45 : GRAVITY * 0.75) : GRAVITY;
      // salto variable: soltar antes sube menos
      const extra = this.vel.y > 0 && !input.jumpHeld && this.controlLock <= 0 ? 1.8 : 1;
      this.vel.y -= g * extra * dt;
      if (this.vel.y < -30) this.vel.y = -30;
    }

    // ----- Movimiento con colisiones por eje
    const wasGrounded = this.grounded;
    const fallSpeed = this.vel.y;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveY(this.vel.y * dt);

    if (this.grounded && !wasGrounded) this.onLand(fallSpeed);

    // Brazo del tocadiscos
    for (const s of world.sweepers) {
      if (this.pos.y > s.y1 || this.pos.y + H < s.y0) continue;
      const ax = Math.cos(-s.angle), az = Math.sin(-s.angle);
      const dx = this.pos.x - s.center.x, dz = this.pos.z - s.center.z;
      const along = dx * ax + dz * az;
      if (along < 0.5 || along > s.length) continue;
      const perp = dx * -az + dz * ax;
      if (Math.abs(perp) < R + 0.2 && this.stun <= 0) {
        const sign = Math.sign(s.angVel) * -1;
        this.vel.set(-az * 9 * sign, 7, ax * 9 * sign);
        this.grounded = false;
        this.groundCol = null;
        this.disc = null;
        this.stun = 0.5;
        this.action = 'none';
        this.sfx.hurt();
        this.effects.sparkle(this.pos.clone().add(tmp.set(0, 0.6, 0)), '#ffffff', 12);
      }
    }
  }

  moveAxis(axis, d) {
    if (d === 0) return;
    this.pos[axis] += d;
    for (const c of this.world.colliders) {
      if (!this.overlaps(c)) continue;
      // ¿se puede subir como escalón?
      const rise = c.max.y - this.pos.y;
      if (this.grounded && rise > 0 && rise <= STEP && !this.blockedAbove(c.max.y)) {
        this.pos.y = c.max.y;
        this.groundCol = c;
        continue;
      }
      if (d > 0) this.pos[axis] = c.min[axis] - R - 0.0001;
      else this.pos[axis] = c.max[axis] + R + 0.0001;
      this.vel[axis] = 0;
    }
  }

  blockedAbove(y) {
    const saved = this.pos.y;
    this.pos.y = y + 0.001;
    const hit = this.world.colliders.some((c) => this.overlaps(c));
    this.pos.y = saved;
    return hit;
  }

  moveY(d) {
    const prevY = this.pos.y;
    this.pos.y += d;
    let landed = false;
    for (const c of this.world.colliders) {
      if (!this.overlaps(c)) continue;
      if (d <= 0 && prevY >= c.max.y - 0.25 - Math.max(0, c.delta.y)) {
        this.pos.y = c.max.y;
        this.vel.y = 0;
        landed = true;
        this.groundCol = c;
      } else if (d > 0 && prevY + H <= c.min.y + 0.25) {
        this.pos.y = c.min.y - H - 0.0001;
        this.vel.y = Math.min(0, this.vel.y);
      } else {
        // empuje mínimo (por ejemplo, una puerta que baja)
        const pushes = [
          ['x', c.max.x + R - this.pos.x], ['x', c.min.x - R - this.pos.x],
          ['z', c.max.z + R - this.pos.z], ['z', c.min.z - R - this.pos.z],
          ['y', c.max.y - this.pos.y],
        ];
        pushes.sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]));
        this.pos[pushes[0][0]] += pushes[0][1];
        if (pushes[0][0] === 'y') {
          landed = true;
          this.vel.y = Math.max(0, this.vel.y);
          this.groundCol = c;
        }
      }
    }
    // Discos giratorios
    let onDisc = null;
    if (!landed && d <= 0) {
      for (const disc of this.world.discs) {
        const r = Math.hypot(this.pos.x - disc.center.x, this.pos.z - disc.center.z);
        if (r < disc.radius && this.pos.y <= disc.top && prevY >= disc.top - 0.3) {
          this.pos.y = disc.top;
          this.vel.y = 0;
          landed = true;
          onDisc = disc;
          this.groundCol = null;
        }
      }
    }
    this.disc = onDisc;
    if (!landed) this.groundCol = null;
    this.grounded = landed;
  }

  onLand(fallSpeed) {
    const impact = Math.min(1, Math.abs(fallSpeed) / 22);
    this.landImpact = 0.25 + impact * 0.7;
    if (this.action === 'pound') {
      this.action = 'none';
      this.stun = 0.25;
      this.effects.shockwave(this.pos);
      this.sfx.pound();
      if (this.onPoundLand) this.onPoundLand(this.pos.clone());
    } else {
      if (impact > 0.3) {
        this.effects.dustPuff(this.pos, 8 + Math.floor(impact * 8), 1.5 + impact * 1.5);
        this.sfx.land();
      }
    }
    this.flipT = -1;
  }

  postUpdate(dt) {
    const world = this.world;
    // Caída al vacío
    if (this.pos.y < world.killY) this.respawn();

    // Puntos de control
    for (const cp of world.checkpoints) {
      if (cp.index <= this.checkpoint) continue;
      const z = cp.zone;
      if (this.pos.x > z.min.x && this.pos.x < z.max.x && this.pos.y > z.min.y && this.pos.y < z.max.y && this.pos.z > z.min.z && this.pos.z < z.max.z) {
        this.checkpoint = cp.index;
        if (this.onCheckpoint) this.onCheckpoint(cp);
      }
    }

    // Botones
    for (const c of world.collectibles) {
      if (c.taken) continue;
      if (Math.abs(c.pos.x - this.pos.x) < 0.8 && Math.abs(c.pos.z - this.pos.z) < 0.8 && c.pos.y > this.pos.y - 0.4 && c.pos.y < this.pos.y + H + 0.4) {
        world.applyEvent(c.id, true, false);
      }
    }

    // Pasos
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const phaseStep = Math.floor(this.model.phase / Math.PI);
    if (this.grounded && hs > 0.5 && phaseStep !== this.lastStep) {
      this.sfx.step();
      if (hs > 6.5) this.effects.dustPuff(this.pos, 2, 0.6);
    }
    this.lastStep = phaseStep;

    this.respawnFade = Math.max(0, this.respawnFade - dt * 2);
  }

  animState() {
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const s = {
      speed: hs / this.tune.walk,
      grounded: this.grounded,
      vy: this.vel.y,
      action: this.action,
      actionT: this.actionT,
      landImpact: this.landImpact,
      turnRate: this.turnRate,
      flipT: this.flipT,
    };
    this.landImpact = 0;
    return s;
  }

  render(dt) {
    const s = this.animState();
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.facing;
    this.model.update(dt, s);
    this.model.root.visible = this.respawnFade < 0.5 || Math.floor(this.respawnFade * 20) % 2 === 0;
    return s;
  }

  serialize() {
    const r = (x) => Math.round(x * 1000) / 1000;
    return {
      p: [r(this.pos.x), r(this.pos.y), r(this.pos.z)],
      v: [r(this.vel.x), r(this.vel.y), r(this.vel.z)],
      f: r(this.facing),
      a: this.action,
      at: r(this.actionT),
      g: this.grounded ? 1 : 0,
      fl: r(this.flipT),
      cp: this.checkpoint,
    };
  }
}

// El compañero online: se interpola entre los estados recibidos.
export class RemotePlayer {
  constructor(kind) {
    this.kind = kind;
    this.model = new CharacterModel(kind);
    this.pos = new THREE.Vector3(0, -100, 0);
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.buffer = [];
    this.last = null;
    this.landImpact = 0;
    this.wasGrounded = true;
    this.checkpoint = 0;
    this.lastHeard = 0;
  }

  push(msg, now) {
    this.buffer.push({ ...msg, time: now });
    if (this.buffer.length > 30) this.buffer.shift();
    this.lastHeard = now;
  }

  update(dt, now, sfx, effects) {
    const delay = 110; // ms de colchón de interpolación
    const target = now - delay;
    const b = this.buffer;
    if (b.length === 0) return;
    while (b.length >= 3 && b[1].time <= target) b.shift();
    const a = b[0], c = b[1] || b[0];
    const k = c.time === a.time ? 1 : Math.max(0, Math.min(1.25, (target - a.time) / (c.time - a.time)));
    const nx = a.p[0] + (c.p[0] - a.p[0]) * k;
    const ny = a.p[1] + (c.p[1] - a.p[1]) * k;
    const nz = a.p[2] + (c.p[2] - a.p[2]) * k;
    this.pos.set(nx, ny, nz);
    this.vel.set(c.v[0], c.v[1], c.v[2]);
    this.facing = angleLerp(this.facing, c.f, 1 - Math.exp(-18 * dt));
    this.checkpoint = c.cp;
    const grounded = !!c.g;
    if (grounded && !this.wasGrounded) {
      this.landImpact = 0.5;
      if (this.prevAction === 'pound') {
        effects.shockwave(this.pos);
        sfx.pound();
      } else {
        effects.dustPuff(this.pos, 8, 1.5);
      }
    }
    if (!grounded && this.wasGrounded && c.v[1] > 5) effects.dustPuff(this.pos, 5, 1.2);
    this.wasGrounded = grounded;
    this.prevAction = c.a;
    this.state = c;
  }

  render(dt) {
    const c = this.state;
    if (!c) return;
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.facing;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.model.update(dt, {
      speed: hs / 5.7,
      grounded: !!c.g,
      vy: c.v[1],
      action: c.a,
      actionT: c.at,
      landImpact: this.landImpact,
      turnRate: 0,
      flipT: c.fl,
    });
    this.landImpact = 0;
  }
}
