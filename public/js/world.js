// El nivel "El Gran Jardín": geometría, colisiones, puzzles cooperativos y decoración animada.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from './textures.js';
import { isTouch } from './touch.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Collider {
  constructor(min, max, tag = 'static') {
    this.min = min.clone();
    this.max = max.clone();
    this.delta = new THREE.Vector3();
    this.enabled = true;
    this.tag = tag;
  }
  moveTo(minX, minY, minZ) {
    const sx = this.max.x - this.min.x, sy = this.max.y - this.min.y, sz = this.max.z - this.min.z;
    this.delta.set(minX - this.min.x, minY - this.min.y, minZ - this.min.z);
    this.min.set(minX, minY, minZ);
    this.max.set(minX + sx, minY + sy, minZ + sz);
  }
}

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export const SECTIONS = [
  { z: 10, name: 'El Patio' },
  { z: -19, name: 'La Puerta de Libros' },
  { z: -28, name: 'La Catapulta' },
  { z: -46, name: 'El Pasillo de Cajas' },
  { z: -60, name: 'El Abismo del Ventilador' },
  { z: -80, name: 'El Tocadiscos' },
  { z: -110, name: 'El Corazón del Jardín' },
];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.discs = [];
    this.sweepers = [];
    this.plates = [];
    this.levers = [];
    this.collectibles = [];
    this.breakables = [];
    this.checkpoints = [];
    this.updrafts = [];
    this.animated = [];
    this.state = {}; // estado sincronizado (palancas, cajas, botones, flor)
    this.killY = -14;
    this.onLocalEvent = null; // (key, value) => void
    this.sfx = null;
    this.effects = null;

    this.mats = {
      wood: new THREE.MeshStandardMaterial({ map: T.woodTexture(), roughness: 0.75 }),
      woodDark: new THREE.MeshStandardMaterial({ map: T.woodTexture('#8f5a33', '#5e3518', 11), roughness: 0.8 }),
      cloth: new THREE.MeshStandardMaterial({ map: T.clothTexture(), roughness: 0.95 }),
      pages: new THREE.MeshStandardMaterial({ map: T.pagesTexture(), roughness: 0.9 }),
      crate: new THREE.MeshStandardMaterial({ map: T.crateTexture(false), roughness: 0.8 }),
      crateCracked: new THREE.MeshStandardMaterial({ map: T.crateTexture(true), roughness: 0.8 }),
      grass: new THREE.MeshStandardMaterial({ map: T.grassTexture(), roughness: 1 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c8cdd6', metalness: 0.7, roughness: 0.3 }),
      black: new THREE.MeshStandardMaterial({ color: '#2a2630', roughness: 0.5 }),
      pot: new THREE.MeshStandardMaterial({ color: '#d4703f', roughness: 0.85 }),
      soil: new THREE.MeshStandardMaterial({ color: '#5a3b26', roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#5cb84a', roughness: 0.7, side: THREE.DoubleSide }),
      stem: new THREE.MeshStandardMaterial({ color: '#4c9a3b', roughness: 0.7 }),
      gold: new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.6, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.4 }),
      white: new THREE.MeshStandardMaterial({ color: '#fbf6ee', roughness: 0.6 }),
    };
    this.bookColors = ['#d9534f', '#3f7fe0', '#59b84a', '#f0ad4e', '#8e5bd6', '#2bb3a3', '#ec5d93', '#e8743b'];
    this.bookMats = this.bookColors.map((c, i) => new THREE.MeshStandardMaterial({ map: T.bookTexture(c, i % 2 ? '#ffd94a' : '#fff3d6'), roughness: 0.7 }));

    this.build();
  }

  // ---------------------------------------------------------------- helpers de construcción

  box(min, max, mat, { collide = true, shadow = true, rounded = 0, tag } = {}) {
    const size = V(max.x - min.x, max.y - min.y, max.z - min.z);
    const geo = rounded ? new RoundedBoxGeometry(size.x, size.y, size.z, 3, rounded) : new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    let col = null;
    if (collide) {
      col = new Collider(min, max, tag);
      this.colliders.push(col);
    }
    return { mesh, col };
  }

  // Pila de libros que ocupa un bloque sólido (colisión = el bloque entero)
  books(min, max, seed = 1) {
    this.colliders.push(new Collider(min, max));
    let y = min.y;
    let i = seed;
    while (y < max.y - 0.01) {
      const h = Math.min(max.y - y, 0.9 + ((i * 37) % 7) * 0.12);
      const last = y + h >= max.y - 0.3;
      const hh = last ? max.y - y : h;
      const inset = 0.15 + ((i * 13) % 5) * 0.06;
      const sx = max.x - min.x, sz = max.z - min.z;
      const cover = this.bookMats[i % this.bookMats.length];
      const g = new THREE.Group();
      g.position.set((min.x + max.x) / 2 + (((i * 7) % 3) - 1) * 0.1, y + hh / 2, (min.z + max.z) / 2);
      // tapas
      const coverMesh = new THREE.Mesh(new RoundedBoxGeometry(sx - inset * 0.3, hh, sz - inset * 0.3, 2, 0.06), cover);
      coverMesh.castShadow = coverMesh.receiveShadow = true;
      g.add(coverMesh);
      // hojas que asoman por un costado
      const pages = new THREE.Mesh(new THREE.BoxGeometry(sx - inset * 0.3 + 0.02, hh * 0.72, sz - inset * 1.2), this.mats.pages);
      pages.position.x = 0.0;
      pages.receiveShadow = true;
      g.add(pages);
      this.scene.add(g);
      y += hh;
      i++;
    }
  }

  sign(pos, lines, rotY = 0, scale = 1) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8), this.mats.woodDark);
    post.position.y = 0.8;
    post.castShadow = true;
    g.add(post);
    const board = new THREE.Mesh(new RoundedBoxGeometry(2.6, 1.3, 0.12, 2, 0.05), this.mats.wood);
    board.position.y = 1.9;
    board.castShadow = true;
    g.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.15), new THREE.MeshStandardMaterial({ map: T.signTexture(lines), roughness: 0.9 }));
    face.position.set(0, 1.9, 0.065);
    g.add(face);
    this.scene.add(g);
    this.animated.push((t) => (g.rotation.z = Math.sin(t * 1.3 + pos.x) * 0.02));
  }

  flower(pos, color, h = 2, s = 1) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.scale.setScalar(s);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 6), this.mats.stem);
    stem.position.y = h / 2;
    stem.castShadow = true;
    g.add(stem);
    const head = new THREE.Group();
    head.position.y = h;
    g.add(head);
    const petalMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), petalMat);
      const a = (i / 6) * Math.PI * 2;
      petal.scale.set(1, 0.35, 0.6);
      petal.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
      petal.rotation.y = -a;
      petal.castShadow = true;
      head.add(petal);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffd94a' }));
    c.scale.y = 0.6;
    head.add(c);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), this.mats.leaf);
    leaf.scale.set(1, 0.1, 0.4);
    leaf.position.set(0.25, h * 0.4, 0);
    leaf.rotation.z = 0.4;
    g.add(leaf);
    this.scene.add(g);
    const off = Math.random() * 10;
    this.animated.push((t) => {
      g.rotation.z = Math.sin(t * 1.4 + off) * 0.06;
      g.rotation.x = Math.cos(t * 1.1 + off) * 0.04;
      head.rotation.y = t * 0.3 + off;
    });
  }

  pot(pos, r = 2, h = 2.5, collide = true) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.75, h, 28), this.mats.pot);
    body.position.y = h / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.4, 28), this.mats.pot);
    rim.position.y = h - 0.2;
    rim.castShadow = true;
    g.add(rim);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.1, 28), this.mats.soil);
    soil.position.y = h - 0.15;
    g.add(soil);
    this.scene.add(g);
    if (collide) {
      const k = r * 0.85;
      this.colliders.push(new Collider(V(pos.x - k, pos.y, pos.z - k), V(pos.x + k, pos.y + h - 0.1, pos.z + k)));
    }
    return g;
  }

  collectible(pos) {
    const id = 'c' + this.collectibles.length;
    const g = new THREE.Group();
    g.position.copy(pos);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 24), this.mats.gold);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), this.mats.gold);
    g.add(rim);
    for (const [x, y] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 8), this.mats.black);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(x, y, 0);
      g.add(hole);
    }
    this.scene.add(g);
    const c = { id, pos: pos.clone(), mesh: g, taken: false, t: Math.random() * 6 };
    this.collectibles.push(c);
    return c;
  }

  plate(pos, color, id) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.16, 32), this.mats.metal);
    base.position.y = 0.08;
    base.receiveShadow = true;
    g.add(base);
    const capMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.05 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.22, 32), capMat);
    cap.position.y = 0.25;
    cap.castShadow = true;
    g.add(cap);
    // ranuras de tapita de botella
    for (let i = 0; i < 20; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.08), capMat);
      const a = (i / 20) * Math.PI * 2;
      rib.position.set(Math.cos(a) * 1.0, 0.25, Math.sin(a) * 1.0);
      rib.rotation.y = -a;
      g.add(rib);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    g.add(ring);
    this.scene.add(g);
    const p = { id, pos: pos.clone(), cap, capMat, ring, pressed: false, amount: 0, radius: 1.05 };
    this.plates.push(p);
    return p;
  }

  lever(pos, rotY, id, label) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = rotY;
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.5, 0.8, 2, 0.1), this.mats.woodDark);
    base.position.y = 0.25;
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    const pivot = new THREE.Group();
    pivot.position.y = 0.45;
    g.add(pivot);
    // la palanca es un lápiz
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), new THREE.MeshStandardMaterial({ color: '#ffcc33', roughness: 0.5 }));
    shaft.position.y = 0.65;
    shaft.castShadow = true;
    pivot.add(shaft);
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10), new THREE.MeshStandardMaterial({ color: '#ff8fa8' }));
    eraser.position.y = 1.35;
    pivot.add(eraser);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff5555', emissive: '#ff2222', emissiveIntensity: 0.8 }));
    lamp.position.set(0.42, 0.55, 0.3);
    g.add(lamp);
    this.scene.add(g);
    this.colliders.push(new Collider(V(pos.x - 0.6, pos.y, pos.z - 0.6), V(pos.x + 0.6, pos.y + 0.5, pos.z + 0.6)));
    const l = { id, pos: pos.clone(), pivot, lamp, angle: -0.6, label };
    this.levers.push(l);
    return l;
  }

  crateBarrier(min, max, id) {
    const { mesh, col } = this.box(min, max, this.mats.crateCracked);
    // subdividir visualmente en cajas apiladas
    this.scene.remove(mesh);
    const g = new THREE.Group();
    const sx = max.x - min.x, sy = max.y - min.y, sz = max.z - min.z;
    const nx = Math.max(1, Math.round(sx / 1.6)), ny = Math.max(1, Math.round(sy / 1.5));
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(sx / nx - 0.04, sy / ny - 0.04, sz), this.mats.crateCracked);
        b.position.set(min.x + (ix + 0.5) * (sx / nx), min.y + (iy + 0.5) * (sy / ny), (min.z + max.z) / 2);
        b.rotation.y = ((ix * 3 + iy) % 3 - 1) * 0.03;
        b.castShadow = b.receiveShadow = true;
        g.add(b);
      }
    }
    this.scene.add(g);
    const b = { id, col, mesh: g, broken: false, center: V((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2) };
    this.breakables.push(b);
    return b;
  }

  checkpoint(pos, rotY = Math.PI, zone) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), this.mats.metal);
    pole.position.set(1.8, 1.2, 0);
    pole.castShadow = true;
    g.add(pole);
    const flagMat = new THREE.MeshStandardMaterial({ color: '#fff3d6', side: THREE.DoubleSide });
    const flagGeo = new THREE.PlaneGeometry(0.9, 0.6, 10, 4);
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(2.25, 2.1, 0);
    flag.castShadow = true;
    g.add(flag);
    this.scene.add(g);
    const base = flagGeo.attributes.position.array.slice();
    const cp = { pos: pos.clone(), rotY, zone, flagMat, active: false, index: this.checkpoints.length };
    this.animated.push((t) => {
      const arr = flagGeo.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i] + 0.45;
        arr[i + 2] = Math.sin(t * 6 - x * 4) * 0.08 * x;
      }
      flagGeo.attributes.position.needsUpdate = true;
    });
    this.checkpoints.push(cp);
    return cp;
  }

  // ---------------------------------------------------------------- el nivel

  build() {
    const m = this.mats;

    // ===== Sección 0: El Patio (mesa de jardín con mantel)
    this.box(V(-12, -1.2, -40), V(12, 0, 12), m.cloth);
    // patas de la mesa (visuales, muy abajo)
    for (const [x, z] of [[-10, 10], [10, 10], [-10, -38], [10, -38]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 40, 12), m.woodDark);
      leg.position.set(x, -21, z);
      leg.castShadow = true;
      this.scene.add(leg);
    }
    // borde del mantel con flecos
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(24.4, 1.6, 52.4), new THREE.MeshStandardMaterial({ map: T.clothTexture('#e85a5a', '#fff3e8'), roughness: 1 }));
    fringe.position.set(0, -1.6, -14);
    fringe.receiveShadow = true;
    this.scene.add(fringe);

    this.checkpoint(V(0, 0, 4), Math.PI, { min: V(-12, -2, -12), max: V(12, 30, 12) });
    this.sign(V(-4.5, 0, 0), ['WASD: moverse', 'Espacio: saltar (x2)'], 0.25);
    this.sign(V(4.5, 0, -2), ['Exe: Ctrl = golpe de suelo', 'Mile: mantené Espacio', 'para planear'], -0.25);

    // escalones de libros con premios
    this.books(V(-9, 0, -8), V(-6, 1, -5), 2);
    this.books(V(-11, 0, -12), V(-8, 2.2, -9), 4);
    this.books(V(-11, 0, -16), V(-8.5, 3.4, -13.5), 6);
    this.collectible(V(-7.5, 1.8, -6.5));
    this.collectible(V(-9.75, 4.3, -14.75));
    this.collectible(V(6, 1, -10));
    this.collectible(V(0, 1, -7));
    // taza decorativa con colisión
    const mug = new THREE.Group();
    mug.position.set(8.5, 0, -6);
    const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.5, 3.2, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#7ec4e8', roughness: 0.3, side: THREE.DoubleSide }));
    mugBody.position.y = 1.6;
    mugBody.castShadow = true;
    mug.add(mugBody);
    const mugBottom = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 28), mugBody.material);
    mugBottom.position.y = 0.1;
    mug.add(mugBottom);
    const tea = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), new THREE.MeshStandardMaterial({ color: '#a8642a', roughness: 0.1 }));
    tea.rotation.x = -Math.PI / 2;
    tea.position.y = 2.6;
    mug.add(tea);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.2, 10, 20, Math.PI), mugBody.material);
    handle.position.set(1.55, 1.6, 0);
    handle.rotation.z = -Math.PI / 2;
    mug.add(handle);
    this.scene.add(mug);
    this.colliders.push(new Collider(V(7.2, 0, -7.3), V(9.8, 3.2, -4.7)));
    // vapor del té
    this.animated.push((t, dt) => {
      if (this.effects && Math.random() < dt * 4) {
        this.effects.dust.spawn({ x: 8.5 + (Math.random() - 0.5), y: 3.3, z: -6 + (Math.random() - 0.5), vy: 0.8, life: 2, size: 0.6, grow: 2, color: '#ffffff', drag: 0.3, fade: 0.35 });
      }
    });

    this.pot(V(-8, 0, 6), 1.6, 2.2);
    this.flower(V(-8, 2.1, 6), '#ff7aa8', 2.6, 1.1);
    this.flower(V(-7.4, 2.1, 6.5), '#ffffff', 1.8, 0.9);
    // carretel de hilo
    this.spool(V(9, 0, 4), '#ec5d93');
    this.yarn(V(-9.5, 0, -2.5), '#5d97f0');

    // ===== Sección 1: La Puerta de Libros
    this.books(V(-12, 0, -22), V(-1.5, 7, -20), 3);
    this.books(V(1.5, 0, -22), V(12, 7, -20), 5);
    this.box(V(-1.5, 3.2, -22), V(1.5, 7, -20), this.bookMats[6], { rounded: 0.05 });
    const door = this.box(V(-1.5, 0, -21.7), V(1.5, 3.2, -20.3), m.woodDark, { rounded: 0.08 });
    this.door = { ...door, open: 0, baseY: 0 };
    // ventana redonda (ojo de cerradura) decorativa
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), m.gold);
    knob.position.set(0.9, -0.1, 0.72);
    door.mesh.add(knob);
    const knob2 = knob.clone();
    knob2.position.z = -0.72;
    door.mesh.add(knob2);
    this.plateA = this.plate(V(-6, 0, -15.5), '#3f7fe0', 'pA');
    this.plateB = this.plate(V(6, 0, -26), '#ec5d93', 'pB');
    this.sign(V(-3.5, 0, -14), ['Pisá la tapita', 'y la puerta se abre'], 0.2, 0.85);
    // hilos que unen las tapitas con la puerta
    this.thread([V(-6, 0.05, -15.5), V(-3, 0.05, -18), V(-1.6, 0.05, -19.9)], '#3f7fe0');
    this.thread([V(6, 0.05, -26), V(3, 0.05, -23.5), V(1.6, 0.05, -22.1)], '#ec5d93');
    this.collectible(V(10, 1, -18));
    this.collectible(V(-10, 1, -26));

    // ===== Sección 2: La Catapulta
    this.checkpoint(V(0, 0, -26), Math.PI, { min: V(-12, -2, -40), max: V(12, 7.9, -22.1) });
    this.books(V(-12, 0, -62), V(12, 8, -40), 1);
    this.buildCatapult(V(-4, 0, -34));
    this.sign(V(-7.5, 0, -30), ['Mile en la cuchara,', 'Exe golpea el mango'], 0.35, 0.85);
    this.elevator = this.box(V(6.5, -0.4, -38.9), V(9.5, 0.3, -35.9), m.woodDark, { rounded: 0.1, tag: 'move' });
    this.elevatorSpool(this.elevator.mesh);
    this.lever1 = this.lever(V(-4, 8, -44), 0, 'L1', 'el ascensor');
    this.collectible(V(8, 1.2, -32));
    this.collectible(V(-10, 9, -43));

    // ===== Sección 3: El Pasillo de Cajas
    this.checkpoint(V(0, 8, -43), Math.PI, { min: V(-12, 7.9, -48), max: V(12, 30, -40) });
    this.books(V(-12, 8, -62), V(-2.5, 14, -48), 7);
    this.books(V(2.5, 8, -62), V(12, 14, -48), 2);
    this.crateBarrier(V(-2.5, 8, -52), V(2.5, 12.5, -50.4), 'b1');
    this.crateBarrier(V(-2.5, 8, -57.6), V(2.5, 12.5, -56), 'b2');
    this.sign(V(3.3, 8, -46.5), ['¿Cajas agrietadas?', 'Golpe de suelo de Exe'], -0.3, 0.85);
    this.collectible(V(0, 9, -54));
    this.collectible(V(0, 9, -59.5));

    // ===== Sección 4: El Abismo del Ventilador
    this.checkpoint(V(0, 8, -59.5), Math.PI, { min: V(-2.5, 7.9, -62), max: V(2.5, 30, -57.7) });
    this.buildFan(V(0, -6, -71));
    this.updrafts.push({ min: V(-3.4, -8, -74.4), max: V(3.4, 15, -67.6) });
    this.books(V(-8, -6, -86), V(8, 8, -80), 3);
    this.bridge = this.box(V(-0.6, 7.4, -80), V(0.6, 8, -79.9), new THREE.MeshStandardMaterial({ color: '#ffcc33', roughness: 0.5 }), { tag: 'move' });
    this.bridgeLen = 18;
    this.buildPencilBridge();
    this.lever2 = this.lever(V(4, 8, -83), Math.PI, 'L2', 'el puente');
    this.sign(V(-3, 8, -59), ['Mile: planeá sobre', 'el viento del ventilador'], 0.2, 0.8);
    this.collectible(V(0, 13, -71));

    // ===== Sección 5: El Tocadiscos
    this.checkpoint(V(0, 8, -82), Math.PI, { min: V(-8, 7.9, -86), max: V(8, 30, -80) });
    this.movers = [];
    this.movers.push(this.mover(V(-1.6, 7.4, -90.5), V(3.2, 0.6, 3), 0, 5.5, 4.5, '#ff8fa8'));
    this.movers.push(this.mover(V(-1.6, 7.4, -96), V(3.2, 0.6, 3), Math.PI, 5.5, 4.5, '#7fd6c9'));
    this.buildTurntable(V(0, 8, -105), 6.2);
    this.collectible(V(4.5, 9.2, -105));
    this.collectible(V(-4.5, 9.2, -105));

    // ===== Sección 6: El Corazón del Jardín
    this.checkpoint(V(0, 8, -113.5), Math.PI, { min: V(-12, 7.9, -134), max: V(12, 30, -111.5) });
    this.box(V(-12, 6.8, -134), V(12, 8, -111.5), m.cloth);
    this.box(V(-12, -6, -134), V(12, 6.8, -111.5), m.woodDark, { collide: false });
    this.plateC = this.plate(V(-5, 8, -120), '#3f7fe0', 'pC');
    this.plateD = this.plate(V(5, 8, -120), '#ec5d93', 'pD');
    this.sign(V(0, 8, -116), ['Pisen las dos tapitas', '¡al mismo tiempo!'], 0, 0.9);
    this.buildBloom(V(0, 8, -127));
    this.collectible(V(-10, 9, -130));
    this.collectible(V(10, 9, -130));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.flower(V(Math.cos(a) * 10.5, 8, -122 + Math.sin(a) * 9), ['#ff7aa8', '#ffd94a', '#b07cff', '#ffffff'][i % 4], 1.5 + (i % 3) * 0.6, 1);
    }

    this.buildBackdrop();
    this.buildButterflies();
  }

  thread(points, color) {
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.05, 6, false), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    tube.receiveShadow = true;
    this.scene.add(tube);
  }

  spool(pos, color) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
    core.position.y = 1.25;
    core.castShadow = true;
    g.add(core);
    for (const y of [0.12, 2.38]) {
      const end = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 24), this.mats.wood);
      end.position.y = y;
      end.castShadow = end.receiveShadow = true;
      g.add(end);
    }
    this.scene.add(g);
    this.colliders.push(new Collider(V(pos.x - 1.2, 0, pos.z - 1.2), V(pos.x + 1.2, 2.5, pos.z + 1.2)));
  }

  yarn(pos, color) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 18), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    ball.position.set(pos.x, 1.2, pos.z);
    ball.castShadow = true;
    this.scene.add(ball);
    for (let i = 0; i < 5; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(1.21, 0.04, 6, 40), new THREE.MeshStandardMaterial({ color: '#3d6fc0' }));
      t.position.copy(ball.position);
      t.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      this.scene.add(t);
    }
    this.colliders.push(new Collider(V(pos.x - 0.9, 0, pos.z - 0.9), V(pos.x + 0.9, 2.2, pos.z + 0.9)));
  }

  buildCatapult(pivot) {
    // Una cuchara de madera gigante sobre un apoyo
    const g = new THREE.Group();
    g.position.copy(pivot);
    const fulcrum = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 3), this.mats.woodDark);
    fulcrum.rotation.z = Math.PI / 2;
    fulcrum.rotation.y = Math.PI / 2;
    fulcrum.position.y = 0.35;
    fulcrum.castShadow = true;
    g.add(fulcrum);
    const arm = new THREE.Group();
    arm.position.y = 0.75;
    g.add(arm);
    const handle = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.18, 7.5, 2, 0.08), this.mats.wood);
    handle.castShadow = true;
    arm.add(handle);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), this.mats.wood);
    bowl.position.set(0, 0.85, -3.5);
    bowl.scale.set(1, 0.6, 1.1);
    bowl.castShadow = true;
    arm.add(bowl);
    const padTop = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.2, 1.6, 2, 0.08), this.mats.woodDark);
    padTop.position.set(0, 0.15, 3.3);
    arm.add(padTop);
    this.scene.add(g);
    this.catapult = {
      arm,
      tilt: -0.1, // en reposo, la cuchara apoyada
      fireT: -1,
      launchZone: { min: V(pivot.x - 1.3, pivot.y - 0.5, pivot.z - 4.8), max: V(pivot.x + 1.3, pivot.y + 2.2, pivot.z - 2.4) },
      poundZone: { min: V(pivot.x - 1.2, pivot.y - 0.5, pivot.z + 2.2), max: V(pivot.x + 1.2, pivot.y + 3, pivot.z + 4.4) },
    };
    // superficies donde pararse (cuchara y mango)
    this.colliders.push(new Collider(V(pivot.x - 1.1, 0, pivot.z - 4.6), V(pivot.x + 1.1, 0.5, pivot.z - 2.4)));
    this.colliders.push(new Collider(V(pivot.x - 0.8, 0, pivot.z + 2.4), V(pivot.x + 0.8, 1.05, pivot.z + 4.2)));
    this.colliders.push(new Collider(V(pivot.x - 0.35, 0, pivot.z - 2.4), V(pivot.x + 0.35, 0.6, pivot.z + 2.4)));
  }

  fireCatapult() {
    this.catapult.fireT = 0;
  }

  elevatorSpool(mesh) {
    // decoración: el ascensor es un carretel; el hilo sube hasta la cornisa
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#ec5d93', roughness: 1 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), ropeMat);
    this.scene.add(rope);
    this.elevatorRope = rope;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 20), this.mats.woodDark);
    wheel.position.set(8, 10.6, -37.4);
    wheel.rotation.y = Math.PI / 2;
    this.scene.add(wheel);
    this.elevatorWheel = wheel;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 0.4), this.mats.woodDark);
    post.position.set(8, 9.7, -40.8);
    post.castShadow = true;
    this.scene.add(post);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.8), this.mats.woodDark);
    beam.position.set(8, 11.25, -39.05);
    beam.castShadow = true;
    this.scene.add(beam);
    this.colliders.push(new Collider(V(7.8, 8, -41), V(8.2, 11.4, -40.6)));
    const stripes = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.35, 24), new THREE.MeshStandardMaterial({ color: '#ec5d93', roughness: 1 }));
    stripes.position.y = -0.0;
    mesh.add(stripes);
  }

  buildFan(pos) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 6, 16), this.mats.metal);
    pillar.position.y = 3;
    g.add(pillar);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.9, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#e7ecf3', metalness: 0.5, roughness: 0.3, wireframe: true }));
    cage.position.y = 6.4;
    g.add(cage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 40), this.mats.metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 6.4;
    g.add(ring);
    const rotor = new THREE.Group();
    rotor.position.y = 6.3;
    g.add(rotor);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#7ec4e8', roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 6), bladeMat);
      blade.scale.set(1, 0.08, 0.45);
      blade.position.x = 1.4;
      const holder = new THREE.Group();
      holder.rotation.y = (i / 4) * Math.PI * 2;
      blade.rotation.x = 0.35;
      holder.add(blade);
      rotor.add(holder);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), this.mats.metal);
    rotor.add(hub);
    this.scene.add(g);
    this.animated.push((t, dt) => {
      rotor.rotation.y += dt * 18;
      if (this.effects && Math.random() < dt * 30) {
        this.effects.dust.spawn({
          x: pos.x + (Math.random() - 0.5) * 6, y: pos.y + 7, z: pos.z + (Math.random() - 0.5) * 6,
          vy: 9 + Math.random() * 4, life: 1.5, size: 0.12, grow: 3, color: '#eaf6ff', drag: 0.2, fade: 0.5,
        });
      }
    });
  }

  buildPencilBridge() {
    // lápiz hexagonal de largo 1 que se estira sobre Z (cara plana arriba, al ras de y = 8)
    this.scene.remove(this.bridge.mesh);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 6), new THREE.MeshStandardMaterial({ color: '#ffcc33', roughness: 0.5 }));
    body.rotation.order = 'XYZ';
    body.rotation.set(Math.PI / 2, Math.PI / 6, 0);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    this.scene.add(g);
    const tipGroup = new THREE.Group();
    const wood = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 6), new THREE.MeshStandardMaterial({ color: '#f1c99a', roughness: 0.8 }));
    wood.rotation.set(Math.PI / 2, Math.PI / 6, 0);
    wood.castShadow = true;
    tipGroup.add(wood);
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 6), this.mats.black);
    lead.position.y = 0.4;
    wood.add(lead);
    this.scene.add(tipGroup);
    this.bridgeVis = { body, tipGroup, group: g, extend: 0 };
  }

  mover(pos, size, phase, amp, period, color) {
    const min = pos.clone();
    const max = pos.clone().add(size);
    const { mesh, col } = this.box(min, max, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), { rounded: 0.25, tag: 'move' });
    // goma de borrar: banda de cartón
    const band = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.5, size.y + 0.02, size.z + 0.02), new THREE.MeshStandardMaterial({ color: '#3f7fe0', roughness: 0.8 }));
    mesh.add(band);
    return { mesh, col, base: min.clone(), phase, amp, period, size };
  }

  buildTurntable(center, radius) {
    const g = new THREE.Group();
    g.position.copy(center);
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(radius * 2 + 3, 1.6, radius * 2 + 3, 3, 0.3), this.mats.woodDark);
    plinth.position.y = -1.6;
    plinth.receiveShadow = true;
    g.add(plinth);
    const platter = new THREE.Group();
    g.add(platter);
    const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.4, 64), new THREE.MeshStandardMaterial({ color: '#1d1a22', roughness: 0.35, metalness: 0.2 }));
    vinyl.position.y = -0.2;
    vinyl.receiveShadow = true;
    platter.add(vinyl);
    for (let r = 1.8; r < radius - 0.2; r += 0.45) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(r, 0.015, 4, 64), new THREE.MeshStandardMaterial({ color: '#3a3542' }));
      groove.rotation.x = Math.PI / 2;
      groove.position.y = 0.01;
      platter.add(groove);
    }
    const label = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.02, 32), new THREE.MeshStandardMaterial({ map: T.signTexture(['♥ Exe & Mile ♥'], '#ffcc33') }));
    label.position.y = 0.01;
    platter.add(label);
    this.scene.add(g);

    const disc = { center: center.clone(), radius, top: center.y, angVel: 0.75, mesh: platter, angle: 0, delta: 0 };
    this.discs.push(disc);
    // plinto: el borde por donde se puede caminar
    this.colliders.push(new Collider(V(center.x - radius - 1.5, center.y - 2.4, center.z - radius - 1.5), V(center.x + radius + 1.5, center.y - 0.8, center.z + radius + 1.5)));

    // brazo del tocadiscos: obstáculo que barre a la altura de las rodillas
    const armPivot = new THREE.Group();
    armPivot.position.set(center.x, center.y, center.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16), this.mats.metal);
    post.position.y = 0.4;
    armPivot.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, radius - 0.4, 10), this.mats.metal);
    bar.rotation.z = Math.PI / 2;
    bar.position.set((radius - 0.4) / 2, 0.5, 0);
    bar.castShadow = true;
    armPivot.add(bar);
    const headShell = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.3, 0.45, 2, 0.08), this.mats.black);
    headShell.position.set(radius - 0.4, 0.45, 0);
    armPivot.add(headShell);
    this.scene.add(armPivot);
    this.sweepers.push({ center: center.clone(), length: radius - 0.2, y0: center.y, y1: center.y + 0.75, angVel: -1.25, angle: 0, mesh: armPivot });
  }

  buildBloom(pos) {
    const g = new THREE.Group();
    g.position.copy(pos);
    this.pot(pos, 2.6, 3, true);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4, 10), this.mats.stem);
    stem.position.y = 5;
    stem.castShadow = true;
    g.add(stem);
    const head = new THREE.Group();
    head.position.y = 7.2;
    g.add(head);
    const petals = [];
    const petalMat = new THREE.MeshStandardMaterial({ color: '#ff7aa8', roughness: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10, 0, Math.PI), petalMat);
      petal.scale.set(0.6, 1.4, 0.35);
      petal.position.y = 1.2;
      const hinge = new THREE.Group();
      hinge.add(petal);
      holder.add(hinge);
      head.add(holder);
      petals.push(hinge);
    }
    // corazón brillante (portal de llegada)
    const shape = new THREE.Shape();
    shape.moveTo(0, -1);
    shape.bezierCurveTo(-1.6, 0, -1.2, 1.3, 0, 0.6);
    shape.bezierCurveTo(1.2, 1.3, 1.6, 0, 0, -1);
    const heartGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4 });
    heartGeo.center();
    const heart = new THREE.Mesh(heartGeo, new THREE.MeshStandardMaterial({ color: '#ff3d7f', emissive: '#ff2266', emissiveIntensity: 0.9, roughness: 0.3 }));
    heart.position.y = 1.4;
    heart.scale.setScalar(0.001);
    head.add(heart);
    const light = new THREE.PointLight('#ff6fa0', 0, 18, 1.5);
    light.position.y = 1.4;
    head.add(light);
    this.scene.add(g);
    this.bloom = { petals, heart, light, open: 0, head, goal: { center: V(pos.x, pos.y, pos.z + 4.2), radius: 2.2 } };
    // portal en el suelo
    const portal = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshBasicMaterial({ color: '#ff8fbf', transparent: true, opacity: 0 }));
    portal.rotation.x = -Math.PI / 2;
    portal.position.set(pos.x, pos.y + 0.03, pos.z + 4.2);
    this.scene.add(portal);
    this.bloom.portal = portal;
  }

  buildBackdrop() {
    // césped lejano, árboles gigantes, cerca y nubes
    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 48), this.mats.grass);
    this.mats.grass.map.repeat.set(60, 60);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -42, -60);
    ground.receiveShadow = false;
    this.scene.add(ground);

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 1 });
    const crownMats = ['#4f9f45', '#5cb84a', '#3f8a3a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const trees = [[-70, -40], [80, -20], [-90, -130], [95, -150], [-40, -200], [50, -210], [-120, 20], [120, 40]];
    trees.forEach(([x, z], i) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 120, 12), trunkMat);
      trunk.position.set(x, 18, z);
      this.scene.add(trunk);
      const crowns = new THREE.Group();
      crowns.position.set(x, 80, z);
      for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(26 + (k % 2) * 8, 1), crownMats[(i + k) % 3]);
        c.position.set(Math.cos(k * 1.3) * 20, (k % 3) * 10, Math.sin(k * 1.3) * 20);
        crowns.add(c);
      }
      this.scene.add(crowns);
      const off = i;
      this.animated.push((t) => (crowns.rotation.z = Math.sin(t * 0.4 + off) * 0.015));
    });

    // cerca de madera
    const fenceMat = new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.9 });
    for (let i = -14; i <= 14; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 60, 2), fenceMat);
      plank.position.set(i * 11, -12, -260);
      this.scene.add(plank);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(7, 6, 4), fenceMat);
      tip.position.set(i * 11, 21, -260);
      tip.rotation.y = Math.PI / 4;
      this.scene.add(tip);
    }

    // nubes
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
    this.clouds = [];
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(8 + Math.random() * 6, 12, 10), cloudMat);
        puff.position.set(k * 9 - 18, Math.random() * 4, Math.random() * 6);
        puff.scale.y = 0.7;
        c.add(puff);
      }
      c.position.set((Math.random() - 0.5) * 500, 90 + Math.random() * 50, -100 + (Math.random() - 0.5) * 400);
      this.scene.add(c);
      this.clouds.push(c);
    }
    this.animated.push((t, dt) => {
      for (const c of this.clouds) {
        c.position.x += dt * 2;
        if (c.position.x > 260) c.position.x = -260;
      }
    });

    // hierba alta alrededor de la mesa (instanciada, se mece con el viento)
    const bladeGeo = new THREE.ConeGeometry(0.6, 9, 3);
    bladeGeo.translate(0, 4.5, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#5fae47', roughness: 0.9 });
    bladeMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      bladeMat.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float h = position.y / 9.0;
         vec4 wp = instanceMatrix * vec4(position, 1.0);
         transformed.x += sin(uTime * 1.6 + wp.x * 0.15 + wp.z * 0.1) * h * h * 1.6;
         transformed.z += cos(uTime * 1.3 + wp.x * 0.1) * h * h * 0.8;`
      );
    };
    const count = isTouch ? 500 : 1600;
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 120;
      dummy.position.set(Math.cos(a) * r, -42, -60 + Math.sin(a) * r * 1.3);
      dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      dummy.scale.setScalar(0.6 + Math.random() * 1.2);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(grass);
    this.animated.push((t) => {
      if (bladeMat.userData.shader) bladeMat.userData.shader.uniforms.uTime.value = t;
    });

    // flores gigantes en el césped
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.flower(V(Math.cos(a) * 45, -42, -60 + Math.sin(a) * 70), ['#ff7aa8', '#ffd94a', '#ffffff', '#b07cff'][i % 4], 13, 3.5);
    }
  }

  buildButterflies() {
    this.butterflies = [];
    const colors = ['#ff9f43', '#5d97f0', '#ff6fa0', '#ffd94a'];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % 4], side: THREE.DoubleSide, roughness: 0.6 });
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), mat);
        w.scale.set(1, 0.75, 1);
        w.position.x = s * 0.3;
        const hinge = new THREE.Group();
        hinge.add(w);
        hinge.userData.s = s;
        g.add(hinge);
        wings.push(hinge);
      }
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 6), this.mats.black);
      body.rotation.x = Math.PI / 2;
      g.add(body);
      this.scene.add(g);
      const zc = [0, -15, -30, -55, -85, -105, -122][i];
      this.butterflies.push({ g, wings, cx: (Math.random() - 0.5) * 12, cy: (zc < -40 ? 10 : 2.5) + Math.random() * 2, cz: zc, r: 3 + Math.random() * 3, sp: 0.3 + Math.random() * 0.3, off: Math.random() * 10 });
    }
    this.animated.push((t) => {
      for (const b of this.butterflies) {
        const a = t * b.sp + b.off;
        const x = b.cx + Math.cos(a) * b.r;
        const z = b.cz + Math.sin(a * 1.3) * b.r;
        const y = b.cy + Math.sin(a * 2.7) * 0.7;
        b.g.lookAt(x + -Math.sin(a) * 1, y, z + Math.cos(a * 1.3) * 1.3);
        b.g.position.set(x, y, z);
        const flap = Math.sin(t * 22 + b.off) * 1.1;
        for (const w of b.wings) {
          w.rotation.z = 0;
          w.rotation.y = w.userData.s * flap;
        }
        b.g.rotateX(Math.PI / 2);
      }
    });
  }

  // ---------------------------------------------------------------- estado y lógica

  applyEvent(key, value, fromNetwork = true) {
    if (this.state[key] === value) return false;
    this.state[key] = value;
    if (key.startsWith('c')) {
      const c = this.collectibles.find((x) => x.id === key);
      if (c && !c.taken) {
        c.taken = true;
        if (this.effects) this.effects.sparkle(c.pos, '#ffd94a', 22);
        if (this.sfx) this.sfx.collect();
      }
    } else if (key.startsWith('b')) {
      const b = this.breakables.find((x) => x.id === key);
      if (b && !b.broken) {
        b.broken = true;
        b.col.enabled = false;
        this.scene.remove(b.mesh);
        if (this.effects) this.effects.splinters(b.center, 2.5);
        if (this.sfx) this.sfx.breakCrate();
      }
    } else if (key === 'L1' || key === 'L2') {
      if (this.sfx) this.sfx.lever();
    } else if (key === 'bloom') {
      if (this.sfx) this.sfx.victory();
    }
    if (!fromNetwork && this.onLocalEvent) this.onLocalEvent(key, value);
    return true;
  }

  loadState(state) {
    for (const k in state) this.applyEvent(k, state[k], true);
  }

  get collectedCount() {
    return this.collectibles.filter((c) => c.taken).length;
  }

  /**
   * @param {number} dt
   * @param {number} time tiempo sincronizado (s)
   * @param {{pos: THREE.Vector3}[]} actors posiciones de ambos jugadores
   */
  update(dt, time, actors) {
    for (const f of this.animated) f(time, dt);
    for (const c of this.colliders) c.delta.set(0, 0, 0);

    // Tapitas
    for (const p of this.plates) {
      const was = p.pressed;
      p.pressed = actors.some((a) => Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < p.radius + 0.2 && a.pos.y > p.pos.y - 0.3 && a.pos.y < p.pos.y + 0.9);
      p.amount += ((p.pressed ? 1 : 0) - p.amount) * (1 - Math.exp(-14 * dt));
      p.cap.position.y = 0.25 - p.amount * 0.14;
      p.capMat.emissiveIntensity = 0.05 + p.amount * 0.9;
      p.ring.material.opacity = p.amount * (0.6 + Math.sin(time * 8) * 0.2);
      if (was !== p.pressed && this.sfx) this.sfx.plate(p.pressed);
    }

    // Puerta: se abre si cualquiera de las dos tapitas está apretada
    const wantOpen = this.plateA.pressed || this.plateB.pressed;
    const prevOpen = this.door.open;
    this.door.open = Math.max(0, Math.min(1, this.door.open + (wantOpen ? 2.2 : -0.9) * dt));
    if (this.sfx && ((prevOpen === 0 && this.door.open > 0) || (prevOpen === 1 && this.door.open < 1))) this.sfx.door();
    const doorY = smooth(this.door.open) * 3.15;
    this.door.mesh.position.y = 1.6 + doorY;
    this.door.col.moveTo(-1.5, doorY, -21.7);

    // Catapulta
    const cat = this.catapult;
    if (cat.fireT >= 0) {
      cat.fireT += dt;
      const f = cat.fireT;
      cat.tilt = f < 0.12 ? -0.1 + (f / 0.12) * 0.6 : 0.5 - Math.min(1, (f - 0.12) / 0.9) * 0.6 + Math.sin(f * 18) * Math.exp(-f * 4) * 0.12;
      if (f > 1.2) {
        cat.fireT = -1;
        cat.tilt = -0.1;
      }
    }
    cat.arm.rotation.x = cat.tilt;

    // Ascensor (activado por la palanca L1): sube y baja cada 8 s
    const l1 = !!this.state.L1;
    let ey = -0.4;
    if (l1) {
      const c = (time % 8) / 8;
      const u = c < 0.25 ? 0 : c < 0.5 ? smooth((c - 0.25) / 0.25) : c < 0.75 ? 1 : 1 - smooth((c - 0.75) / 0.25);
      ey = -0.4 + u * 8.4;
    }
    this.elevator.col.moveTo(6.5, ey, -38.9);
    this.elevator.mesh.position.y = ey + 0.35;
    this.elevatorRope.scale.y = Math.max(0.01, 10.6 - (ey + 0.7));
    this.elevatorRope.position.set(8, (10.6 + ey + 0.7) / 2, -37.4);
    this.elevatorWheel.rotation.x = ey * 1.5;

    // Puente de lápiz (palanca L2)
    const bv = this.bridgeVis;
    bv.extend = Math.max(0, Math.min(1, bv.extend + (this.state.L2 ? 0.5 : -1) * dt));
    const len = Math.max(0.1, smooth(bv.extend) * this.bridgeLen);
    this.bridge.col.min.set(-0.6, 7.4, -80);
    this.bridge.col.max.set(0.6, 8, -80 + len);
    this.bridge.col.enabled = len > 0.5;
    bv.group.position.set(0, 7.48, -80 + len / 2);
    bv.body.scale.y = len;
    bv.tipGroup.position.set(0, 7.48, -80 + len + 0.6);
    bv.tipGroup.visible = bv.extend > 0.02;
    bv.group.visible = bv.extend > 0.02;

    // Gomas móviles
    for (const mv of this.movers) {
      const x = mv.base.x + Math.sin((time / mv.period) * Math.PI * 2 + mv.phase) * mv.amp;
      mv.col.moveTo(x, mv.base.y, mv.base.z);
      mv.mesh.position.set(x + mv.size.x / 2, mv.base.y + mv.size.y / 2, mv.base.z + mv.size.z / 2);
    }

    // Tocadiscos y brazo
    for (const d of this.discs) {
      const a = time * d.angVel;
      d.delta = a - d.angle;
      if (Math.abs(d.delta) > 1) d.delta = d.angVel * dt;
      d.angle = a;
      d.mesh.rotation.y = a;
    }
    for (const s of this.sweepers) {
      s.angle = time * s.angVel;
      s.mesh.rotation.y = s.angle;
    }

    // Botones coleccionables
    for (const c of this.collectibles) {
      if (c.taken) {
        if (c.mesh.visible) {
          c.mesh.scale.multiplyScalar(Math.exp(-dt * 10));
          c.mesh.position.y += dt * 4;
          if (c.mesh.scale.x < 0.05) c.mesh.visible = false;
        }
        continue;
      }
      c.t += dt;
      c.mesh.rotation.y = c.t * 2.2;
      c.mesh.position.y = c.pos.y + Math.sin(c.t * 2.5) * 0.15;
      if (this.effects && Math.random() < dt * 2) this.effects.trail(V(c.pos.x + (Math.random() - 0.5) * 0.6, c.pos.y + (Math.random() - 0.5) * 0.6, c.pos.z), '#ffe48a');
    }

    // Palancas
    for (const l of this.levers) {
      const on = !!this.state[l.id];
      l.angle += ((on ? 0.6 : -0.6) - l.angle) * (1 - Math.exp(-10 * dt));
      l.pivot.rotation.x = l.angle;
      l.lamp.material.color.set(on ? '#55ff77' : '#ff5555');
      l.lamp.material.emissive.set(on ? '#22ff55' : '#ff2222');
    }

    // Flor final
    if (this.plateC.pressed && this.plateD.pressed && !this.state.bloom) this.applyEvent('bloom', true, false);
    const b = this.bloom;
    b.open = Math.min(1, b.open + (this.state.bloom ? dt * 0.6 : 0));
    const o = smooth(b.open);
    b.petals.forEach((p, i) => {
      p.rotation.x = -(0.15 + o * 1.25) + Math.sin(time * 2 + i) * 0.03 * o;
    });
    b.heart.scale.setScalar(Math.max(0.001, o * (1 + Math.sin(time * 4) * 0.08)));
    b.heart.rotation.y = time * 1.2;
    b.light.intensity = o * 30;
    b.portal.material.opacity = o * (0.45 + Math.sin(time * 5) * 0.15);
    b.head.rotation.y = time * 0.2;
    if (o > 0.5 && this.effects && Math.random() < dt * 8) {
      this.effects.hearts.spawn({ x: b.goal.center.x + (Math.random() - 0.5) * 3, y: b.goal.center.y + 0.2, z: b.goal.center.z + (Math.random() - 0.5) * 3, vy: 1.5, life: 2, size: 0.4, gravity: -0.3, drag: 0.5 });
    }
  }

  isGoal(pos) {
    if (!this.state.bloom || this.bloom.open < 0.7) return false;
    const g = this.bloom.goal;
    return Math.hypot(pos.x - g.center.x, pos.z - g.center.z) < g.radius && Math.abs(pos.y - g.center.y) < 1.5;
  }

  sectionName(pos) {
    let name = SECTIONS[0].name;
    for (const s of SECTIONS) if (pos.z < s.z) name = s.name;
    return name;
  }
}
