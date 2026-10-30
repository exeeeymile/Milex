// Partículas: polvo al correr/aterrizar, ondas del golpe de suelo, astillas, corazones, confeti, destellos.
import * as THREE from 'three';
import { softCircleTexture, heartTexture } from './textures.js';

const MAX = 1400;

class ParticlePool {
  constructor(scene, texture, blending = THREE.NormalBlending) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, scale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying float vA; varying vec3 vC;
        uniform float scale;
        void main() {
          vA = alpha; vC = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying float vA; varying vec3 vC;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vC * t.rgb, t.a * vA);
          if (gl_FragColor.a < 0.01) discard;
        }`,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.parts = [];
  }

  spawn(o) {
    if (this.parts.length >= MAX) this.parts.shift();
    this.parts.push({
      x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life || 1, max: o.life || 1,
      size: o.size || 0.3, grow: o.grow ?? 0.5,
      color: new THREE.Color(o.color || '#ffffff'),
      gravity: o.gravity ?? 0,
      drag: o.drag ?? 1.5,
      fade: o.fade ?? 1,
    });
  }

  update(dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    const n = ps.length;
    for (let i = 0; i < n; i++) {
      const p = ps[i];
      const k = p.life / p.max;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.color.r; this.col[i * 3 + 1] = p.color.g; this.col[i * 3 + 2] = p.color.b;
      this.size[i] = p.size * (1 + (1 - k) * p.grow);
      this.alpha[i] = Math.min(1, k * 2.5) * p.fade;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.dust = new ParticlePool(scene, softCircleTexture());
    this.glow = new ParticlePool(scene, softCircleTexture(), THREE.AdditiveBlending);
    this.hearts = new ParticlePool(scene, heartTexture());
    this.rings = [];
    this.debris = [];
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  dustPuff(pos, count = 6, spread = 1, color = '#f3e6d0') {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.6 + Math.random()) * spread;
      this.dust.spawn({
        x: pos.x + Math.cos(a) * 0.2, y: pos.y + 0.05, z: pos.z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * s, vy: 0.5 + Math.random() * 0.8, vz: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.4, size: 0.25 + Math.random() * 0.2, grow: 1.5,
        color, drag: 4, fade: 0.8,
      });
    }
  }

  shockwave(pos, color = '#fff2c4') {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(this.ringGeo, mat);
    ring.position.copy(pos);
    ring.position.y += 0.06;
    this.scene.add(ring);
    this.rings.push({ mesh: ring, t: 0 });
    this.dustPuff(pos, 22, 4.5);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      this.glow.spawn({
        x: pos.x, y: pos.y + 0.2, z: pos.z,
        vx: Math.cos(a) * 6, vy: 2 + Math.random() * 3, vz: Math.sin(a) * 6,
        life: 0.5, size: 0.18, color: '#ffe48a', gravity: 12, drag: 2,
      });
    }
  }

  splinters(pos, size = 1) {
    const geo = new THREE.BoxGeometry(0.12, 0.08, 0.4);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: i % 3 ? '#d9a35f' : '#8f5a26' }));
      m.position.set(pos.x + (Math.random() - 0.5) * size, pos.y + Math.random() * size, pos.z + (Math.random() - 0.5) * size);
      m.castShadow = true;
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 5;
      this.debris.push({
        mesh: m, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 6, vz: Math.sin(a) * sp,
        rx: (Math.random() - 0.5) * 20, rz: (Math.random() - 0.5) * 20, life: 1.6,
      });
      this.scene.add(m);
    }
    this.dustPuff(pos, 26, 3.5, '#e8cfa5');
  }

  sparkle(pos, color = '#ffe066', count = 16) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * Math.PI;
      const sp = 2 + Math.random() * 3;
      this.glow.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 2, vz: Math.sin(a) * Math.cos(e) * sp,
        life: 0.6 + Math.random() * 0.4, size: 0.22, grow: -0.6, color, gravity: 4, drag: 3,
      });
    }
  }

  heartBurst(pos, count = 10) {
    for (let i = 0; i < count; i++) {
      this.hearts.spawn({
        x: pos.x + (Math.random() - 0.5) * 0.8, y: pos.y + Math.random() * 0.5, z: pos.z + (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * 1.2, vy: 1.2 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.2,
        life: 1.4 + Math.random() * 0.8, size: 0.35 + Math.random() * 0.25, grow: 0.4, gravity: -0.3, drag: 1.2,
      });
    }
  }

  confetti(pos, count = 160) {
    const colors = ['#ff5c8f', '#ffd94a', '#5d97f0', '#59b84a', '#ffffff', '#b07cff'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      this.glow.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * sp, vy: 6 + Math.random() * 9, vz: Math.sin(a) * sp,
        life: 2.5 + Math.random() * 1.5, size: 0.25, grow: 0, color: colors[i % colors.length], gravity: 6, drag: 1.4,
      });
    }
  }

  trail(pos, color) {
    this.glow.spawn({ x: pos.x, y: pos.y, z: pos.z, vy: 0.2, life: 0.4, size: 0.2, grow: -0.8, color, drag: 2 });
  }

  update(dt) {
    this.dust.update(dt);
    this.glow.update(dt);
    this.hearts.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const s = 0.3 + r.t * 9;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = Math.max(0, 0.9 - r.t * 2.2);
      if (r.t > 0.45) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vy -= 25 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.z += d.rz * dt;
      if (d.life < 0.4) d.mesh.scale.setScalar(Math.max(0.01, d.life / 0.4));
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        d.mesh.material.dispose();
        this.debris.splice(i, 1);
      }
    }
  }
}
