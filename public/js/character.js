// Modelos de Exe y Mile, armados con primitivas y animados de forma procedural
// (caminar, correr, saltar, doble salto, planear, golpe de suelo, saludar, bailar, abrazar...).
import * as THREE from 'three';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

let toonGradient = null;
function gradientMap() {
  if (toonGradient) return toonGradient;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  toonGradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  toonGradient.minFilter = THREE.NearestFilter;
  toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.needsUpdate = true;
  return toonGradient;
}

const matCache = new Map();
function toon(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() }));
  return matCache.get(color);
}

// Contorno estilo dibujo animado: casco invertido empujado sobre las normales.
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 0.022 }, color: { value: new THREE.Color('#2a1d33') } },
  vertexShader: `
    uniform float thickness;
    void main() {
      vec3 p = position + normal * thickness;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});

function part(geo, color, { outline = true, shadow = true } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, toon(color));
  m.castShadow = shadow;
  g.add(m);
  if (outline) {
    const o = new THREE.Mesh(geo, outlineMat);
    g.add(o);
  }
  g.userData.mesh = m;
  return g;
}

const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
const sphere = (r, w = 20, h = 16) => new THREE.SphereGeometry(r, w, h);

function lathe(points, segments = 24) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

const PALETTES = {
  exe: {
    skin: '#f1c99a',
    hair: '#6b3f1d',
    shirt: '#ffd25e',
    overall: '#3f7fe0',
    overallDark: '#2c5fb3',
    shoe: '#a2452c',
    button: '#ffd94a',
  },
  mile: {
    skin: '#ffd8c2',
    hair: '#c4552c',
    dress: '#ec5d93',
    dressDark: '#c43f74',
    sock: '#ffffff',
    shoe: '#7a2a52',
    bow: '#ffe066',
    leaf: '#59b84a',
  },
};

export class CharacterModel {
  constructor(kind) {
    this.kind = kind;
    this.root = new THREE.Group(); // posición en los pies, rotación de orientación
    this.body = new THREE.Group(); // squash & stretch, giros acrobáticos
    this.root.add(this.body);
    this.hips = new THREE.Group();
    this.hips.position.y = 0.46;
    this.body.add(this.hips);

    this.t = 0;
    this.phase = 0;
    this.blinkTimer = 2 + Math.random() * 2;
    this.blink = 0;
    this.squash = 0;
    this.spin = 0; // giro de doble salto
    this.umbrella = 0;
    this.pose = {};

    if (kind === 'exe') this.buildExe();
    else this.buildMile();

    this.root.traverse((o) => {
      if (o.isMesh) o.frustumCulled = true;
    });
  }

  // ---------------------------------------------------------------- construcción

  buildLegs(pantsColor, sockColor, shoeColor, thick = 0.085) {
    const legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, 0, 0);
      const thigh = part(capsule(thick, 0.12), pantsColor);
      thigh.position.y = -0.1;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.21;
      hip.add(knee);
      const shin = part(capsule(thick * 0.9, 0.1), sockColor);
      shin.position.y = -0.08;
      knee.add(shin);
      const shoe = part(sphere(0.1, 16, 12), shoeColor);
      shoe.scale.set(0.95, 0.62, 1.35);
      shoe.position.set(0, -0.19, 0.04);
      knee.add(shoe);
      this.hips.add(hip);
      legs.push({ hip, knee });
    }
    this.legL = legs[1];
    this.legR = legs[0];
  }

  buildArms(sleeveColor, handColor, y, thick = 0.065) {
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.22, y, 0);
      const upper = part(capsule(thick, 0.1), sleeveColor);
      upper.position.y = -0.08;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.17;
      shoulder.add(elbow);
      const fore = part(capsule(thick * 0.85, 0.08), handColor);
      fore.position.y = -0.06;
      elbow.add(fore);
      const hand = part(sphere(0.068, 14, 10), handColor);
      hand.position.y = -0.15;
      elbow.add(hand);
      this.torso.add(shoulder);
      arms.push({ shoulder, elbow, side });
    }
    this.armR = arms[0];
    this.armL = arms[1];
  }

  buildFace(head, skin, eyeY, eyeX, cheeks) {
    const eyes = new THREE.Group();
    eyes.position.set(0, eyeY, 0.2);
    head.add(eyes);
    this.eyes = eyes;
    for (const side of [-1, 1]) {
      const white = new THREE.Mesh(sphere(0.062, 16, 12), toon('#ffffff'));
      white.scale.set(0.85, 1.15, 0.5);
      white.position.set(side * eyeX, 0, 0.03);
      eyes.add(white);
      const pupil = new THREE.Mesh(sphere(0.042, 14, 10), new THREE.MeshBasicMaterial({ color: '#241a2e' }));
      pupil.scale.set(0.9, 1.15, 0.5);
      pupil.position.set(side * eyeX, -0.005, 0.06);
      eyes.add(pupil);
      const shine = new THREE.Mesh(sphere(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      shine.position.set(side * eyeX + 0.014, 0.02, 0.083);
      eyes.add(shine);
      if (cheeks) {
        const cheek = new THREE.Mesh(sphere(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: 0.55 }));
        cheek.scale.set(1, 0.6, 0.3);
        cheek.position.set(side * (eyeX + 0.05), eyeY - 0.09, 0.2);
        head.add(cheek);
      }
    }
    // Boca: pequeña sonrisa
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.009, 6, 16, Math.PI),
      new THREE.MeshBasicMaterial({ color: '#5a2a2a' })
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, eyeY - 0.12, 0.235);
    head.add(smile);
    this.mouth = smile;
    const nose = part(sphere(0.03, 10, 8), skin, { outline: false });
    nose.position.set(0, eyeY - 0.06, 0.25);
    head.add(nose);
  }

  buildExe() {
    const c = PALETTES.exe;
    this.buildLegs(c.overall, c.overall, c.shoe, 0.09);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.02;
    this.hips.add(this.torso);
    const belly = part(
      lathe([[0.0, -0.05], [0.2, -0.04], [0.24, 0.06], [0.23, 0.2], [0.19, 0.32], [0.1, 0.37], [0.0, 0.38]]),
      c.overall
    );
    this.torso.add(belly);
    const shirt = part(sphere(0.19, 18, 12), c.shirt);
    shirt.scale.set(1.05, 0.55, 0.95);
    shirt.position.y = 0.33;
    this.torso.add(shirt);
    // tirantes y botones del overol
    for (const side of [-1, 1]) {
      const strap = part(new THREE.BoxGeometry(0.05, 0.2, 0.02), c.overallDark, { outline: false });
      strap.position.set(side * 0.1, 0.32, 0.17);
      strap.rotation.x = -0.35;
      this.torso.add(strap);
      const btn = part(sphere(0.03, 10, 8), c.button);
      btn.position.set(side * 0.1, 0.22, 0.22);
      this.torso.add(btn);
    }
    const pocket = part(new THREE.BoxGeometry(0.16, 0.1, 0.03), c.overallDark, { outline: false });
    pocket.position.set(0, 0.1, 0.235);
    this.torso.add(pocket);

    this.buildArms(c.shirt, c.skin, 0.33, 0.07);

    this.neck = new THREE.Group();
    this.neck.position.y = 0.42;
    this.torso.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.2;
    this.neck.add(this.head);
    const skull = part(sphere(0.26, 24, 18), c.skin);
    skull.scale.set(1, 0.95, 0.95);
    this.head.add(skull);
    for (const side of [-1, 1]) {
      const ear = part(sphere(0.06, 10, 8), c.skin);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(side * 0.255, 0, 0);
      this.head.add(ear);
    }
    // pelo: casquete + mechones
    const hairCap = part(new THREE.SphereGeometry(0.272, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), c.hair);
    hairCap.rotation.x = -0.25;
    hairCap.position.y = 0.02;
    this.head.add(hairCap);
    // mechón que asoma bajo la gorra
    const tuft = part(sphere(0.07, 12, 10), c.hair);
    tuft.position.set(0.04, 0.2, 0.21);
    tuft.scale.set(1.3, 0.8, 0.8);
    this.head.add(tuft);
    this.buildFace(this.head, c.skin, 0.0, 0.085, false);

    // Pequeña gorra hacia atrás
    const cap = part(new THREE.SphereGeometry(0.275, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), '#e04848');
    cap.position.y = 0.03;
    cap.rotation.x = -0.2;
    this.head.add(cap);
    const visor = part(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20, 1, false, 0, Math.PI), '#c03030');
    visor.position.set(0, 0.17, -0.22);
    visor.rotation.set(-0.15, Math.PI, 0);
    visor.scale.set(1, 1, 0.8);
    this.head.add(visor);
  }

  buildMile() {
    const c = PALETTES.mile;
    this.buildLegs(c.sock, c.sock, c.shoe, 0.07);
    // rayas de las medias
    for (const leg of [this.legL, this.legR]) {
      for (let i = 0; i < 2; i++) {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.016, 6, 16), toon(c.dress));
        stripe.rotation.x = Math.PI / 2;
        stripe.position.y = -0.03 - i * 0.07;
        leg.knee.add(stripe);
      }
    }

    this.torso = new THREE.Group();
    this.torso.position.y = 0.0;
    this.hips.add(this.torso);
    // vestido acampanado
    this.skirt = part(
      lathe([[0.0, -0.02], [0.3, -0.04], [0.29, 0.02], [0.22, 0.14], [0.16, 0.26], [0.15, 0.36], [0.08, 0.41], [0.0, 0.42]], 28),
      c.dress
    );
    this.torso.add(this.skirt);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.022, 8, 32), toon('#ffffff'));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -0.025;
    this.skirt.add(hem);
    const collar = part(new THREE.TorusGeometry(0.1, 0.03, 8, 20), '#ffffff', { outline: false });
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.4;
    this.torso.add(collar);
    const heart = part(sphere(0.04, 10, 8), c.bow, { outline: false });
    heart.scale.set(1.2, 1, 0.5);
    heart.position.set(0, 0.26, 0.17);
    this.torso.add(heart);

    this.buildArms(c.dress, c.skin, 0.34, 0.058);

    this.neck = new THREE.Group();
    this.neck.position.y = 0.42;
    this.torso.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.21;
    this.neck.add(this.head);
    const skull = part(sphere(0.25, 24, 18), c.skin);
    this.head.add(skull);
    // flequillo y pelo
    const hair = part(new THREE.SphereGeometry(0.265, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), c.hair);
    hair.rotation.x = -0.45;
    hair.position.set(0, 0.015, -0.015);
    this.head.add(hair);
    const back = part(sphere(0.24, 18, 14), c.hair);
    back.scale.set(1.02, 1.02, 0.9);
    back.position.set(0, -0.02, -0.06);
    this.head.add(back);
    this.pigtails = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.24, 0.06, -0.04);
      this.head.add(pivot);
      const tail = part(sphere(0.1, 14, 12), c.hair);
      tail.scale.set(0.9, 1.3, 0.9);
      tail.position.set(side * 0.07, -0.11, 0);
      pivot.add(tail);
      const bow = part(sphere(0.05, 10, 8), c.bow);
      bow.scale.set(1.6, 0.8, 0.8);
      bow.position.set(side * 0.02, 0.0, 0);
      pivot.add(bow);
      this.pigtails.push({ pivot, side });
    }
    // florcita en el pelo
    const flower = new THREE.Group();
    flower.position.set(0.12, 0.2, 0.1);
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(sphere(0.035, 8, 6), toon('#ffffff'));
      const a = (i / 5) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0);
      flower.add(petal);
    }
    const center = new THREE.Mesh(sphere(0.026, 8, 6), toon(c.bow));
    center.position.z = 0.015;
    flower.add(center);
    flower.rotation.set(-0.5, 0.4, 0);
    this.head.add(flower);
    this.buildFace(this.head, c.skin, -0.01, 0.08, true);
    // pestañas
    for (const side of [-1, 1]) {
      const lash = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.01), new THREE.MeshBasicMaterial({ color: '#241a2e' }));
      lash.position.set(side * 0.13, 0.065, 0.06);
      lash.rotation.z = side * -0.5;
      this.eyes.add(lash);
    }

    // Hoja-paraguas para planear
    this.umbrellaGroup = new THREE.Group();
    const canopy = part(new THREE.SphereGeometry(0.62, 26, 10, 0, Math.PI * 2, 0, Math.PI * 0.38), c.leaf);
    canopy.position.y = 0.35;
    canopy.userData.mesh.material = new THREE.MeshToonMaterial({ color: c.leaf, gradientMap: gradientMap(), side: THREE.DoubleSide });
    this.umbrellaGroup.add(canopy);
    const tip = part(sphere(0.05, 10, 8), '#3d8a33', { outline: false });
    tip.position.y = 0.97;
    this.umbrellaGroup.add(tip);
    const stem = part(capsule(0.018, 0.55), '#6b4a2a', { outline: false });
    stem.position.y = 0.3;
    this.umbrellaGroup.add(stem);
    this.umbrellaGroup.scale.setScalar(0.001);
    this.umbrellaGroup.visible = false;
    // el brazo apunta hacia arriba al planear, así que el soporte invierte el eje local
    const holder = new THREE.Group();
    holder.position.y = -0.15;
    holder.rotation.x = Math.PI;
    holder.add(this.umbrellaGroup);
    this.armR.elbow.add(holder);
  }

  // ---------------------------------------------------------------- animación

  /**
   * @param {number} dt
   * @param {object} s estado: { speed (0..1+), grounded, vy, action, actionT, landImpact, turnRate }
   */
  update(dt, s) {
    this.t += dt;
    const t = this.t;
    const k = 14;
    const speed = Math.min(s.speed, 1.6);
    const moving = s.grounded && speed > 0.05;

    // Avance del ciclo de pasos según la velocidad real
    if (moving) this.phase += dt * (6 + speed * 7.5);
    const ph = this.phase;
    const stride = Math.min(speed, 1.3);

    // Valores objetivo de la pose
    const P = {
      hipsY: 0.46,
      hipsRotX: 0,
      hipsRotZ: 0,
      hipsRotY: 0,
      torsoX: 0,
      torsoZ: 0,
      torsoY: 0,
      headX: 0,
      headZ: 0,
      headY: 0,
      legL: 0,
      legR: 0,
      kneeL: 0,
      kneeR: 0,
      legLZ: 0,
      legRZ: 0,
      armLX: 0,
      armRX: 0,
      armLZ: 0.12,
      armRZ: -0.12,
      elbowL: -0.15,
      elbowR: -0.15,
      umbrella: 0,
    };

    const action = s.action;
    if (action === 'hug') {
      P.armLX = -1.35; P.armRX = -1.35; P.armLZ = -0.55; P.armRZ = 0.55; P.elbowL = -0.7; P.elbowR = -0.7;
      P.torsoX = 0.15; P.headX = -0.1; P.hipsY = 0.46 + Math.sin(t * 3) * 0.01;
      P.torsoZ = Math.sin(t * 2.5) * 0.08;
    } else if (action === 'wave') {
      P.armRZ = -2.5 + Math.sin(t * 12) * 0.35; P.elbowR = -0.4; P.armRX = -0.2;
      P.headZ = 0.15; P.torsoZ = 0.06; P.hipsY = 0.46 + Math.abs(Math.sin(t * 6)) * 0.02;
    } else if (action === 'dance') {
      const b = t * 7;
      P.hipsY = 0.44 + Math.abs(Math.sin(b)) * 0.06;
      P.hipsRotZ = Math.sin(b) * 0.12;
      P.hipsRotY = Math.sin(b * 0.5) * 0.4;
      P.torsoZ = -Math.sin(b) * 0.15;
      P.armLZ = 1.6 + Math.sin(b) * 0.9; P.armRZ = -1.6 + Math.sin(b + Math.PI) * 0.9;
      P.elbowL = -0.8; P.elbowR = -0.8;
      P.legL = Math.max(0, Math.sin(b)) * -0.5; P.kneeL = Math.max(0, Math.sin(b)) * 0.9;
      P.legR = Math.max(0, -Math.sin(b)) * -0.5; P.kneeR = Math.max(0, -Math.sin(b)) * 0.9;
      P.headZ = Math.sin(b) * 0.2;
    } else if (action === 'lever') {
      const pull = Math.min(1, s.actionT * 3);
      P.armLX = -1.3 + pull * 0.6; P.armRX = -1.3 + pull * 0.6; P.armLZ = -0.2; P.armRZ = 0.2;
      P.elbowL = -0.3; P.elbowR = -0.3;
      P.torsoX = 0.2 - pull * 0.35; P.legL = -0.4; P.kneeL = 0.5; P.legR = 0.3; P.hipsY = 0.42;
    } else if (action === 'celebrate') {
      const b = t * 8;
      P.armLZ = 2.6 + Math.sin(b) * 0.3; P.armRZ = -2.6 - Math.sin(b) * 0.3; P.elbowL = -0.2; P.elbowR = -0.2;
      P.headX = -0.3; P.hipsY = 0.46 + Math.abs(Math.sin(b * 0.5)) * 0.12;
    } else if (action === 'pound') {
      if (s.actionT < 0.28) {
        // hecho bolita y girando
        P.legL = -1.6; P.legR = -1.6; P.kneeL = 2.2; P.kneeR = 2.2;
        P.armLX = -1.0; P.armRX = -1.0; P.elbowL = -1.6; P.elbowR = -1.6; P.armLZ = -0.3; P.armRZ = 0.3;
        P.torsoX = 0.5; P.headX = 0.3; P.hipsY = 0.62;
      } else {
        // en caída: estirado hacia abajo
        P.legL = 0.15; P.legR = -0.15; P.kneeL = 0.1; P.kneeR = 0.1;
        P.armLZ = 2.4; P.armRZ = -2.4; P.elbowL = -0.1; P.elbowR = -0.1; P.headX = 0.25;
      }
    } else if (action === 'glide') {
      P.armRZ = -2.8; P.armRX = 0; P.elbowR = 0; P.armLZ = 0.8 + Math.sin(t * 3) * 0.1; P.elbowL = -0.5;
      P.legL = -0.2 + Math.sin(t * 4) * 0.25; P.legR = -0.2 - Math.sin(t * 4) * 0.25;
      P.kneeL = 0.5; P.kneeR = 0.5; P.torsoX = 0.1; P.headX = -0.1;
      P.torsoZ = Math.sin(t * 2) * 0.06; P.umbrella = 1;
    } else if (!s.grounded) {
      if (s.vy > 1.5) {
        // subiendo: una pierna recogida, brazos arriba
        P.legL = -0.9; P.kneeL = 1.3; P.legR = 0.25; P.kneeR = 0.25;
        P.armLZ = 1.2; P.armRZ = -1.2; P.armLX = -0.5; P.armRX = 0.3; P.elbowL = -0.4; P.elbowR = -0.4;
        P.torsoX = 0.12; P.headX = -0.15;
      } else {
        // cayendo: agitando brazos
        const f = t * 14;
        P.legL = -0.4 + Math.sin(f) * 0.35; P.legR = -0.4 - Math.sin(f) * 0.35; P.kneeL = 0.7; P.kneeR = 0.7;
        P.armLZ = 1.9 + Math.sin(f) * 0.4; P.armRZ = -1.9 + Math.sin(f + 1) * 0.4; P.elbowL = -0.5; P.elbowR = -0.5;
        P.headX = 0.2;
      }
    } else if (moving) {
      const sw = Math.sin(ph);
      const run = Math.min(1, Math.max(0, (speed - 0.55) / 0.5));
      const amp = 0.45 + stride * 0.45;
      P.legL = -sw * amp;
      P.legR = sw * amp;
      P.kneeL = Math.max(0, Math.cos(ph)) * (0.6 + run * 0.8) + 0.1;
      P.kneeR = Math.max(0, -Math.cos(ph)) * (0.6 + run * 0.8) + 0.1;
      P.armLX = sw * (0.4 + run * 0.6);
      P.armRX = -sw * (0.4 + run * 0.6);
      P.elbowL = -0.3 - run * 0.9;
      P.elbowR = -0.3 - run * 0.9;
      P.armLZ = 0.15 + run * 0.1;
      P.armRZ = -0.15 - run * 0.1;
      P.hipsY = 0.46 + Math.abs(Math.cos(ph)) * (0.03 + run * 0.04) - run * 0.03;
      P.torsoX = 0.08 + run * 0.22;
      P.torsoY = sw * 0.12;
      P.hipsRotY = -sw * 0.1;
      P.torsoZ = -s.turnRate * 0.05;
      P.headX = -0.06 - run * 0.1;
    } else {
      // reposo: respiración y mirada
      const br = Math.sin(t * 2.2);
      P.hipsY = 0.46 + br * 0.006;
      P.torsoX = -0.02 + br * 0.02;
      P.armLZ = 0.14 + br * 0.03;
      P.armRZ = -0.14 - br * 0.03;
      P.headY = Math.sin(t * 0.6) * 0.25 * Math.max(0, Math.sin(t * 0.23));
      P.headZ = Math.sin(t * 0.9) * 0.04;
      P.kneeL = 0.05; P.kneeR = 0.05;
    }

    // Mezcla suave hacia la pose objetivo
    const fast = action === 'pound' || !s.grounded ? 20 : k;
    const p = this.pose;
    for (const key in P) p[key] = p[key] === undefined ? P[key] : damp(p[key], P[key], fast, dt);

    this.hips.position.y = p.hipsY;
    this.hips.rotation.set(p.hipsRotX, p.hipsRotY, p.hipsRotZ);
    this.torso.rotation.set(p.torsoX, p.torsoY, p.torsoZ);
    this.neck.rotation.set(p.headX, p.headY, p.headZ);
    this.legL.hip.rotation.set(p.legL, 0, p.legLZ);
    this.legR.hip.rotation.set(p.legR, 0, p.legRZ);
    this.legL.knee.rotation.x = p.kneeL;
    this.legR.knee.rotation.x = p.kneeR;
    this.armL.shoulder.rotation.set(p.armLX, 0, p.armLZ);
    this.armR.shoulder.rotation.set(p.armRX, 0, p.armRZ);
    this.armL.elbow.rotation.x = p.elbowL;
    this.armR.elbow.rotation.x = p.elbowR;

    // Squash & stretch
    if (s.landImpact > 0) {
      this.squash = Math.min(1, this.squash + s.landImpact);
    }
    this.squash = damp(this.squash, 0, 9, dt);
    let sy = 1 - this.squash * 0.28;
    let sxz = 1 + this.squash * 0.2;
    if (!s.grounded && action !== 'glide') {
      const st = Math.min(0.12, Math.abs(s.vy) * 0.008);
      sy += st;
      sxz -= st * 0.5;
    }
    this.body.scale.set(sxz, sy, sxz);

    // Giros acrobáticos (doble salto / golpe de suelo)
    if (s.flipT !== undefined && s.flipT >= 0 && s.flipT < 0.45) {
      const f = s.flipT / 0.45;
      const e = 1 - Math.pow(1 - f, 3);
      if (this.kind === 'mile') {
        this.body.rotation.x = e * Math.PI * 2;
        this.body.rotation.y = 0;
      } else {
        this.body.rotation.y = e * Math.PI * 2;
        this.body.rotation.x = 0;
      }
      this.body.position.y = Math.sin(f * Math.PI) * 0.35;
    } else if (action === 'pound' && s.actionT < 0.28) {
      this.body.rotation.x = (s.actionT / 0.28) * Math.PI * 2;
      this.body.position.y = 0.3;
    } else {
      this.body.rotation.x = damp(this.body.rotation.x % (Math.PI * 2), 0, 20, dt);
      this.body.rotation.y = damp(this.body.rotation.y % (Math.PI * 2), 0, 20, dt);
      this.body.position.y = damp(this.body.position.y, 0, 20, dt);
    }

    // Parpadeo
    this.blinkTimer -= dt;
    if (this.blinkTimer < 0) {
      this.blink = 1;
      this.blinkTimer = 2 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const closed = action === 'hug' || action === 'celebrate' ? 0.75 : Math.sin(this.blink * Math.PI);
    this.eyes.scale.y = 1 - closed * 0.9;
    this.mouth.scale.set(action === 'celebrate' || action === 'dance' ? 1.4 : 1, action === 'celebrate' ? 2 : 1, 1);

    // Coletas de Mile: se balancean con inercia
    if (this.pigtails) {
      const swing = moving ? Math.sin(ph * 2) * 0.25 * stride : 0;
      const air = !s.grounded ? Math.max(-0.8, Math.min(0.8, -s.vy * 0.06)) : 0;
      for (const pt of this.pigtails) {
        pt.pivot.rotation.z = damp(pt.pivot.rotation.z, pt.side * (0.2 + air * 0.5) + swing * pt.side, 10, dt);
        pt.pivot.rotation.x = damp(pt.pivot.rotation.x, moving ? 0.3 * stride : 0, 8, dt);
      }
      this.skirt.rotation.x = damp(this.skirt.rotation.x, moving ? -0.08 * stride : 0, 8, dt);
    }

    // Paraguas: aparece con un "pop" elástico
    if (this.umbrellaGroup) {
      const target = p.umbrella > 0.5 ? 1 : 0;
      this.umbrella = damp(this.umbrella, target, target ? 16 : 22, dt);
      const pop = target ? 1 + Math.sin(Math.min(1, this.umbrella) * Math.PI) * 0.25 : 1;
      this.umbrellaGroup.visible = this.umbrella > 0.02;
      this.umbrellaGroup.scale.setScalar(Math.max(0.001, this.umbrella * pop));
      this.umbrellaGroup.rotation.y = t * 1.5;
    }
  }
}
