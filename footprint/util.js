import * as THREE from "three";

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// 固定种子的随机数：每个访客看到的小岛都一样
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export const fbm2 = (x, y) => noise2(x, y) * 0.65 + noise2(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.35;

// 晚上会亮的材质（窗户、路灯）：由昼夜系统统一调亮度
export const nightGlow = [];
export function glowsAtNight(material, strength = 1) {
  nightGlow.push({ material, strength });
  return material;
}

export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });
}

export function canvasTexture(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 建筑立面：一格格窗户（或整条玻璃带），晚上部分窗户会亮
export function facadeMaterial({
  wall = "#f2f0eb",
  glass = "#9fc0d3",
  cols = 6,
  rows = 5,
  bands = false,
  accent = null,
  lit = 0.55,
  seed = 1,
  repeat = null,
} = {}) {
  const W = 256;
  const H = 256;
  const r = rng(seed);
  const mx = W * 0.05;
  const my = H * 0.06;
  const cw = (W - mx * 2) / cols;
  const ch = (H - my * 2) / rows;
  const cells = [];
  for (let j = 0; j < rows; j++) {
    if (bands) {
      cells.push([0, my + j * ch + ch * 0.25, W, ch * 0.5, r() < lit]);
      continue;
    }
    for (let i = 0; i < cols; i++) {
      cells.push([mx + i * cw + cw * 0.17, my + j * ch + ch * 0.2, cw * 0.66, ch * 0.58, r() < lit]);
    }
  }
  const map = canvasTexture(W, H, (g) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);
    g.fillStyle = glass;
    for (const [x, y, w, h] of cells) g.fillRect(x, y, w, h);
    if (accent) {
      g.fillStyle = accent;
      for (let i = 0; i <= cols; i += 2) g.fillRect(mx + i * cw - 4, 0, 8, H);
    }
  });
  const emissiveMap = canvasTexture(W, H, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff";
    for (const [x, y, w, h, on] of cells) if (on) g.fillRect(x, y, w, h);
  });
  if (repeat) {
    for (const t of [map, emissiveMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
  }
  const m = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: new THREE.Color("#ffcf8a"),
    emissiveIntensity: 0,
    roughness: 0.8,
  });
  return glowsAtNight(m, 1.3);
}

// 一块写着字的牌子（贴在建筑上）
export function textPlane(text, { width = 4, color = "#ffffff", bg = null, font = "600 64px", height = null } = {}) {
  const W = 1024;
  const H = 160;
  const tex = canvasTexture(W, H, (g) => {
    if (bg) {
      g.fillStyle = bg;
      roundRectPath(g, 0, 0, W, H, 28);
      g.fill();
    }
    g.fillStyle = color;
    g.font = `${font} -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, W / 2, H / 2 + 4, W - 40);
  });
  const h = height ?? (width * H) / W;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }),
  );
  return mesh;
}

// 飘在建筑上方的站牌（永远朝向镜头）
export function labelSprite(title, sub, scale = 1) {
  const W = 640;
  const H = 200;
  const tex = canvasTexture(W, H, (g) => {
    g.fillStyle = "rgba(255,255,255,0.92)";
    roundRectPath(g, 8, 8, W - 16, H - 16, 44);
    g.fill();
    g.fillStyle = "#1f2933";
    g.font = '700 62px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(title, W / 2, sub ? 78 : H / 2, W - 60);
    if (sub) {
      g.fillStyle = "#5b6672";
      g.font = '500 40px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
      g.fillText(sub, W / 2, 142, W - 60);
    }
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(4.4 * scale, ((4.4 * H) / W) * scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// 圆点贴图（粒子、光晕用）
export function dotTexture(soft = true) {
  return canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(soft ? 0.35 : 0.7, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

export function m4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

// 把几个简单形状合成一个带顶点颜色的几何体（道具少占绘制次数）
export function mergeParts(parts) {
  const pos = [];
  const nor = [];
  const col = [];
  const c = new THREE.Color();
  for (const { geo, color, matrix } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    c.set(color);
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) {
      pos.push(p[i]);
      nor.push(n[i]);
    }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}

export function shadowed(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast && !o.material.transparent;
      o.receiveShadow = receive;
    }
  });
  return obj;
}
