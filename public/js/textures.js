// Texturas procedurales dibujadas en canvas (sin archivos externos).
import * as THREE from 'three';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function rand(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function woodTexture(base = '#c98e55', dark = '#9a6236', seed = 7) {
  const r = rand(seed);
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const planks = 4;
    for (let p = 0; p < planks; p++) {
      const y0 = (p * h) / planks;
      const tint = (r() - 0.5) * 30;
      g.fillStyle = `rgba(${tint > 0 ? 255 : 0},${tint > 0 ? 220 : 0},${tint > 0 ? 170 : 0},${Math.abs(tint) / 255})`;
      g.fillRect(0, y0, w, h / planks);
      // vetas
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = `rgba(110,60,25,${0.08 + r() * 0.14})`;
        g.lineWidth = 1 + r() * 2.5;
        g.beginPath();
        const yy = y0 + r() * (h / planks);
        g.moveTo(0, yy);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + i) * 3 + (r() - 0.5) * 2);
        g.stroke();
      }
      // nudos
      for (let k = 0; k < 2; k++) {
        const kx = r() * w;
        const ky = y0 + 20 + r() * (h / planks - 40);
        for (let ring = 6; ring > 0; ring--) {
          g.strokeStyle = `rgba(100,55,20,${0.15 + ring * 0.03})`;
          g.lineWidth = 1.5;
          g.beginPath();
          g.ellipse(kx, ky, ring * 4, ring * 2, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      g.fillStyle = dark;
      g.fillRect(0, y0, w, 4);
    }
  });
}

export function grassTexture() {
  const r = rand(3);
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#6dbb4f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(80,160,60,0.5)' : 'rgba(140,210,90,0.45)';
      g.fillRect(r() * w, r() * h, 2, 4 + r() * 4);
    }
  });
}

export function clothTexture(a = '#e85a5a', b = '#fff3e8') {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = b;
    g.fillRect(0, 0, w, h);
    g.fillStyle = a;
    g.globalAlpha = 0.55;
    for (let i = 0; i < 4; i++) {
      g.fillRect(i * 64, 0, 32, h);
      g.fillRect(0, i * 64, w, 32);
    }
    g.globalAlpha = 0.15;
    g.fillStyle = '#000';
    for (let i = 0; i < w; i += 3) g.fillRect(i, 0, 1, h);
  });
}

export function bookTexture(color, stripe = '#ffd94a') {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.fillStyle = stripe;
    g.fillRect(0, 30, w, 14);
    g.fillRect(0, h - 44, w, 14);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
}

export function pagesTexture() {
  return canvas(128, 128, (g, w, h) => {
    g.fillStyle = '#fbf3df';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,140,110,0.4)';
    for (let y = 0; y < h; y += 4) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  });
}

export function crateTexture(cracked) {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#d9a35f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8f5a26';
    g.lineWidth = 14;
    g.strokeRect(7, 7, w - 14, h - 14);
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(w - 10, h - 10);
    g.stroke();
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = 'rgba(120,70,30,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      const y = Math.random() * h;
      g.moveTo(0, y);
      g.lineTo(w, y + (Math.random() - 0.5) * 8);
      g.stroke();
    }
    if (cracked) {
      g.strokeStyle = '#3b2210';
      g.lineWidth = 4;
      const cracks = [[128, 128], [60, 90], [190, 70], [100, 200], [200, 190]];
      for (const [x, y] of cracks) {
        g.beginPath();
        g.moveTo(x, y);
        let cx = x, cy = y;
        for (let s = 0; s < 4; s++) {
          cx += (Math.random() - 0.5) * 60;
          cy += (Math.random() - 0.5) * 60;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
    }
  });
}

export function signTexture(lines, bg = '#fff7ea') {
  const tex = canvas(512, 256, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9a6236';
    g.lineWidth = 12;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#2c2340';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = lines.length > 2 ? 40 : 50;
    g.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
    lines.forEach((line, i) => g.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (size + 8)));
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function skyTexture() {
  const tex = canvas(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#4f9be6');
    grad.addColorStop(0.45, '#9fd2f5');
    grad.addColorStop(0.62, '#ffe7c4');
    grad.addColorStop(1, '#f7c99a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function softCircleTexture() {
  const tex = canvas(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function heartTexture() {
  const tex = canvas(64, 64, (g) => {
    g.fillStyle = '#ff5c8f';
    g.beginPath();
    g.moveTo(32, 56);
    g.bezierCurveTo(4, 36, 4, 10, 20, 10);
    g.bezierCurveTo(28, 10, 32, 18, 32, 22);
    g.bezierCurveTo(32, 18, 36, 10, 44, 10);
    g.bezierCurveTo(60, 10, 60, 36, 32, 56);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.ellipse(21, 20, 5, 3, -0.6, 0, Math.PI * 2);
    g.fill();
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
