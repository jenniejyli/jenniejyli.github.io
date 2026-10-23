import * as THREE from "three";
import { mergeShaded, m4, blob, between } from "./util.js";

// ===== 花房里的盆栽、盆景，还有夏天花房外面的绣球和向日葵 =====
// 每一盆都合成一个带顶点颜色的几何体，一盆只占一次绘制。

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const plantMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });

const SOIL = "#5a4334";
const LEAF = "#4f9150";

// 先绕 X 轴往外倒 tilt，再绕 Y 轴转到 yaw 方向（叶子、花瓣用）
function yawTilt(x, y, z, yaw, tilt, s = 1, sy = s) {
  return new THREE.Matrix4()
    .makeTranslation(x, y, z)
    .multiply(new THREE.Matrix4().makeRotationY(yaw))
    .multiply(new THREE.Matrix4().makeRotationX(tilt))
    .multiply(new THREE.Matrix4().makeScale(s, sy, s));
}

// 一片叶子：底在原点，尖朝 +Y
function leafGeo(w, l) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w, l * 0.35, 0, l);
  s.quadraticCurveTo(-w, l * 0.35, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}

// 叶子从根到尖由深变浅
const leafShade = (base, l) => {
  const c = new THREE.Color(base);
  return (x, y) => {
    const k = 0.8 + 0.35 * Math.min(1, Math.max(0, y / l));
    return [c.r * k, c.g * k, c.b * k];
  };
};

function pot(r, h, color, square = false) {
  if (square) {
    return [
      { geo: new THREE.BoxGeometry(r * 2, h, r * 1.4), matrix: m4(0, h / 2, 0), color },
      { geo: new THREE.BoxGeometry(r * 1.86, 0.02, r * 1.26), matrix: m4(0, h, 0), color: SOIL },
    ];
  }
  return [
    { geo: new THREE.CylinderGeometry(r, r * 0.75, h, 16), matrix: m4(0, h / 2, 0), color },
    { geo: new THREE.CylinderGeometry(r * 1.08, r * 1.08, h * 0.16, 16), matrix: m4(0, h * 0.92, 0), color },
    { geo: new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.02, 16), matrix: m4(0, h + 0.003, 0), color: SOIL },
  ];
}

function stick(a, b, r, color) {
  const { matrix, len } = between(a, b);
  return { geo: new THREE.CylinderGeometry(r * 0.8, r, len, 6), matrix, color };
}

const mesh = (parts) => new THREE.Mesh(mergeShaded(parts), plantMaterial);

// 盆景：浅浅的蓝釉方盆，弯弯的树干，三片"云朵"一样修剪过的树冠
export function bonsai(seed = 1) {
  const parts = pot(0.3, 0.12, "#4f7fa6", true);
  const pts = [v3(0, 0.12, 0), v3(0.08, 0.3, 0.02), v3(-0.06, 0.48, -0.02), v3(0.04, 0.62, 0)];
  for (let k = 0; k < pts.length - 1; k++) parts.push(stick(pts[k], pts[k + 1], 0.05 - k * 0.012, "#6b5040"));
  const pads = [
    [v3(0.04, 0.68, 0), 0.2],
    [v3(-0.24, 0.5, 0.04), 0.15],
    [v3(0.24, 0.42, -0.02), 0.14],
  ];
  for (const [p, r] of pads) {
    parts.push(stick(pts[2], p, 0.018, "#6b5040"));
    parts.push({
      geo: blob(r, seed + r * 10, { detail: 1, lump: 0.18 }),
      matrix: m4(p.x, p.y + 0.03, p.z, 0, 0, 0, 1, 0.42, 1),
      color: (x, y, z, nx, ny) => [0.32 + 0.14 * ny, 0.56 + 0.16 * ny, 0.3 + 0.08 * ny],
    });
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.2, 0.015, 12), matrix: m4(0.08, 0.13, 0, 0, 0, 0, 1.3, 1, 0.9), color: "#7fae5e" });
  return mesh(parts);
}

// 龟背竹：大花盆 + 一片片大叶子
export function monstera(seed = 1) {
  const parts = pot(0.26, 0.4, "#f1ebe1");
  for (let k = 0; k < 8; k++) {
    const yaw = (k / 8) * Math.PI * 2 + seed;
    const tilt = 0.5 + (k % 3) * 0.25;
    const h = 0.6 + (k % 4) * 0.12;
    const tip = v3(Math.sin(yaw) * Math.sin(tilt) * h * 0.6, 0.4 + Math.cos(tilt) * h, Math.cos(yaw) * Math.sin(tilt) * h * 0.6);
    parts.push(stick(v3(0, 0.38, 0), tip, 0.012, "#5d8c4b"));
    parts.push({ geo: leafGeo(0.2, 0.34), matrix: yawTilt(tip.x, tip.y, tip.z, yaw, tilt + 0.6), color: leafShade("#3f8a4f", 0.34) });
  }
  return mesh(parts);
}

// 多肉：一圈圈胖胖的叶子，叶尖带一点粉
export function succulent(color = "#8fbf9a", seed = 0) {
  const parts = pot(0.11, 0.12, ["#e9a07a", "#f4efe6", "#c9d7e4"][seed % 3]);
  const c = new THREE.Color(color);
  for (let ring = 0; ring < 3; ring++) {
    const n = 7 - ring;
    for (let k = 0; k < n; k++) {
      const yaw = (k / n) * Math.PI * 2 + ring * 0.4;
      const tilt = 1.1 - ring * 0.35;
      parts.push({
        geo: new THREE.SphereGeometry(0.03, 8, 6),
        matrix: yawTilt(Math.sin(yaw) * 0.03 * (3 - ring), 0.15 + ring * 0.02, Math.cos(yaw) * 0.03 * (3 - ring), yaw, tilt, 1, 2.2),
        color: (x, y) => (y > 0.18 + ring * 0.02 ? [0.95, 0.66, 0.72] : [c.r, c.g, c.b]),
      });
    }
  }
  return mesh(parts);
}

// 仙人掌：一根主干两只手，顶上一朵小粉花
export function cactus() {
  const parts = pot(0.12, 0.14, "#d98a6a");
  const green = (x, y, z, nx) => [0.36 + 0.08 * nx, 0.6 + 0.06 * nx, 0.38];
  parts.push({ geo: new THREE.CapsuleGeometry(0.07, 0.32, 6, 10), matrix: m4(0, 0.38, 0), color: green });
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.CapsuleGeometry(0.04, 0.08, 4, 8), matrix: m4(s * 0.1, 0.36, 0, 0, 0, s * 1.4), color: green });
    parts.push({ geo: new THREE.CapsuleGeometry(0.04, 0.1, 4, 8), matrix: m4(s * 0.15, 0.45, 0), color: green });
  }
  parts.push({ geo: new THREE.SphereGeometry(0.035, 8, 6), matrix: m4(0, 0.63, 0), color: "#f48fb1" });
  return mesh(parts);
}

// 蕨类：细长的叶子往四周垂下来
export function fern(seed = 0) {
  const parts = pot(0.16, 0.2, "#c98a6a");
  for (let k = 0; k < 14; k++) {
    const yaw = (k / 14) * Math.PI * 2 + seed;
    parts.push({ geo: leafGeo(0.045, 0.36), matrix: yawTilt(0, 0.2, 0, yaw, 0.7 + (k % 3) * 0.25), color: leafShade("#5fa35a", 0.36) });
  }
  return mesh(parts);
}

// 小柠檬树：圆圆的树冠挂着黄色柠檬
export function lemonTree(seed = 0) {
  const parts = pot(0.2, 0.26, "#f1ebe1");
  parts.push(stick(v3(0, 0.26, 0), v3(0, 0.7, 0), 0.025, "#7a5a44"));
  parts.push({ geo: blob(0.28, seed + 3, { lump: 0.12 }), matrix: m4(0, 0.85, 0), color: (x, y, z, nx, ny) => [0.3 + 0.1 * ny, 0.55 + 0.12 * ny, 0.28] });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    parts.push({ geo: new THREE.SphereGeometry(0.045, 8, 6), matrix: m4(Math.cos(a) * 0.26, 0.78 + (k % 3) * 0.08, Math.sin(a) * 0.26, 0, 0, 0, 1, 1.25, 1), color: "#f5d44a" });
  }
  return mesh(parts);
}

// 开花的小盆栽（天竺葵那种）
export function flowerPot(colors, seed = 0) {
  const parts = pot(0.13, 0.15, ["#e9a07a", "#f4efe6", "#9cc0d8"][seed % 3]);
  parts.push({ geo: blob(0.14, seed, { lump: 0.15 }), matrix: m4(0, 0.22, 0, 0, 0, 0, 1, 0.7, 1), color: (x, y, z, nx, ny) => [0.33, 0.58 + 0.1 * ny, 0.32] });
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4 + seed;
    const d = 0.04 + (k % 3) * 0.035;
    parts.push({ geo: new THREE.IcosahedronGeometry(0.04, 0), matrix: m4(Math.cos(a) * d, 0.3 - d * 0.4, Math.sin(a) * d), color: colors[k % colors.length] });
  }
  return mesh(parts);
}

// 吊兰：挂在花房顶上，藤垂下来
export function hangingPlant(seed = 0) {
  const parts = [
    { geo: new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matrix: m4(0, 0, 0), color: "#e9dcc6" },
    { geo: new THREE.CylinderGeometry(0.13, 0.13, 0.015, 12), matrix: m4(0, -0.01, 0), color: SOIL },
  ];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    parts.push(stick(v3(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13), v3(0, 0.55, 0), 0.004, "#cdbb9a"));
  }
  for (let v = 0; v < 6; v++) {
    const a = (v / 6) * Math.PI * 2 + seed;
    const len = 4 + ((v + seed) % 3);
    for (let k = 0; k < len; k++) {
      const p = v3(Math.cos(a) * (0.13 + k * 0.012), -0.02 - k * 0.07, Math.sin(a) * (0.13 + k * 0.012));
      parts.push({ geo: leafGeo(0.03, 0.07), matrix: yawTilt(p.x, p.y, p.z, a + k, 2.2), color: k % 2 ? "#5fa35a" : "#7cbb6a" });
    }
  }
  return mesh(parts);
}

// 绣球花：绿色的底 + 一团团蓝紫粉的小花
export function hydrangea(seed = 0) {
  const parts = [{ geo: blob(0.42, seed, { lump: 0.15 }), matrix: m4(0, 0.36, 0, 0, 0, 0, 1, 0.8, 1), color: (x, y, z, nx, ny) => [0.3, 0.52 + 0.12 * ny, 0.3] }];
  const sets = [
    ["#8fb5ea", "#a9c4f2", "#c4b2ec"],
    ["#f3a6c8", "#f7c3da", "#e58cb5"],
    ["#b49ae6", "#cbb6f0", "#9fb7ee"],
  ];
  const cols = sets[seed % 3];
  for (let b = 0; b < 5; b++) {
    const a = b * 1.26 + seed;
    const cx = Math.cos(a) * 0.25;
    const cz = Math.sin(a) * 0.25;
    const cy = 0.55 + (b % 2) * 0.1;
    for (let k = 0; k < 14; k++) {
      const u = k * 2.399;
      const d = 0.05 + 0.09 * Math.sqrt(k / 14);
      parts.push({ geo: new THREE.IcosahedronGeometry(0.045, 0), matrix: m4(cx + Math.cos(u) * d, cy + 0.08 - d * 0.5, cz + Math.sin(u) * d), color: cols[k % cols.length] });
    }
  }
  return mesh(parts);
}

// 向日葵：高高的，花盘朝前
export function sunflower(seed = 0) {
  const h = 1.0 + (seed % 3) * 0.15;
  const parts = [stick(v3(0, 0, 0), v3(0.04, h, 0.02), 0.025, "#5f8f45")];
  for (const s of [-1, 1]) parts.push({ geo: leafGeo(0.1, 0.22), matrix: yawTilt(0.01, h * 0.45 + s * 0.08, 0, s * 1.6, 1.0), color: leafShade("#5f9a48", 0.22) });
  const head = new THREE.Matrix4().makeTranslation(0.04, h, 0.04).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.35));
  parts.push({ geo: new THREE.CylinderGeometry(0.11, 0.11, 0.05, 18), matrix: head.clone(), color: "#6b4426" });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const m = head.clone().multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.1)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    parts.push({ geo: leafGeo(0.05, 0.13), matrix: m, color: k % 2 ? "#f6c534" : "#f9d65a" });
  }
  return mesh(parts);
}
