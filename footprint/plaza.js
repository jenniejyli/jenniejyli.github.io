import * as THREE from "three";
import { terrainHeight, POND } from "./world.js";
import { mat, glowsAtNight, textPlane, canvasTexture, stoneTexture, shadowed, blob, rng, m4 } from "./util.js";

// ===== 小岛中间的广场 =====
// 玻璃花房（送花 + 送花排行）、喷泉、咖啡店、抽签小摊、池塘和小木桥。

const WOOD = mat("#a87a55");
const WOOD_DARK = mat("#7c5a40");
const STONE = mat("#efebe3", { roughness: 0.9 });
const FRAME = mat("#2f3d37", { roughness: 0.45, metalness: 0.25 });

function part(parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}
const box = (p, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => part(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);

function glassMat(opacity = 0.26) {
  return glowsAtNight(
    new THREE.MeshStandardMaterial({
      color: "#dff2ee",
      transparent: true,
      opacity,
      roughness: 0.08,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: "#ffd79a",
      emissiveIntensity: 0,
    }),
    0.55,
  );
}

function lanternLight(parent, x, y, z, color = "#fff1cf") {
  const m = glowsAtNight(new THREE.MeshStandardMaterial({ color, emissive: "#ffcf7a", emissiveIntensity: 0, roughness: 0.4 }), 2.2);
  return part(parent, new THREE.SphereGeometry(0.13, 12, 10), m, x, y, z);
}

// ---------- 玻璃花房
function flowerHouse() {
  const g = new THREE.Group();
  const glass = glassMat();
  const R = 3.0;
  part(g, new THREE.CylinderGeometry(R + 0.3, R + 0.4, 0.4, 12), STONE, 0, 0.2);
  part(g, new THREE.CylinderGeometry(R, R, 2.3, 12, 1, true), glass, 0, 1.55);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    box(g, 0.07, 2.3, 0.07, FRAME, Math.cos(a) * R, 1.55, Math.sin(a) * R);
  }
  for (const y of [0.45, 1.55, 2.7]) part(g, new THREE.TorusGeometry(R, 0.04, 6, 48), FRAME, 0, y, 0, Math.PI / 2);
  const dome = part(g, new THREE.SphereGeometry(R, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 2.7);
  dome.scale.y = 0.8;
  for (let k = 0; k < 12; k++) {
    const rib = part(g, new THREE.TorusGeometry(R, 0.035, 6, 24, Math.PI / 2), FRAME, 0, 2.7, 0, 0, (k / 12) * Math.PI * 2, 0);
    rib.scale.y = 0.8;
  }
  part(g, new THREE.TorusGeometry(R * 0.6, 0.03, 6, 36), FRAME, 0, 2.7 + R * 0.8 * 0.8, 0, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.45, 0.45, 0.45, 12, 1, true), glass, 0, 5.3);
  part(g, new THREE.ConeGeometry(0.55, 0.5, 12), FRAME, 0, 5.75);
  part(g, new THREE.SphereGeometry(0.09, 10, 8), mat("#e8c46a", { roughness: 0.4, metalness: 0.4 }), 0, 6.05);
  // 门廊
  const porch = new THREE.Group();
  porch.position.set(0, 0, R + 0.35);
  box(porch, 1.8, 2.1, 1.3, glass, 0, 1.45, 0);
  for (const [x, z] of [
    [-0.9, -0.65],
    [0.9, -0.65],
    [-0.9, 0.65],
    [0.9, 0.65],
  ]) {
    box(porch, 0.07, 2.1, 0.07, FRAME, x, 1.45, z);
  }
  for (const s of [-1, 1]) box(porch, 1.05, 0.06, 1.4, glass, s * 0.45, 2.75, 0, 0, 0, s * -0.5);
  box(porch, 0.06, 0.06, 1.4, FRAME, 0, 2.98, 0);
  box(porch, 1.9, 0.06, 0.06, FRAME, 0, 2.5, 0.65);
  box(porch, 2.0, 0.15, 0.6, STONE, 0, 0.08, 0.95);
  g.add(porch);
  // 里面：植物、花架、吊灯
  const leaf = mat("#7fae6d", { roughness: 0.85 });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.4;
    part(g, blob(0.45 + (k % 3) * 0.12, k + 3), leaf, Math.cos(a) * 2.1, 0.85 + (k % 2) * 0.25, Math.sin(a) * 2.1);
  }
  part(g, new THREE.CylinderGeometry(0.75, 0.75, 0.08, 20), WOOD, 0, 1.0);
  part(g, new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8), WOOD, 0, 0.7);
  const potColors = ["#f6a5c0", "#ffd66e", "#ffffff", "#c9b6f2", "#ff9f8a"];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    part(g, new THREE.CylinderGeometry(0.1, 0.08, 0.14, 10), mat("#c98a6a"), Math.cos(a) * 0.55, 1.11, Math.sin(a) * 0.55);
    part(g, blob(0.12, k), mat(potColors[k % potColors.length], { roughness: 0.7 }), Math.cos(a) * 0.55, 1.26, Math.sin(a) * 0.55);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.8;
    lanternLight(g, Math.cos(a) * 1.4, 2.5, Math.sin(a) * 1.4);
  }
  const sign = textPlane("FLOWER HOUSE", { width: 1.7, color: "#2f3d37", bg: "rgba(246,241,230,0.95)", font: "700 88px" });
  sign.position.set(0, 2.55, R + 1.02);
  g.add(sign);
  return g;
}

// ---------- 喷泉
function fountain() {
  const g = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ color: "#8fd6e0", transparent: true, opacity: 0.75, roughness: 0.1 });
  part(g, new THREE.CylinderGeometry(1.35, 1.45, 0.45, 36), STONE, 0, 0.22);
  part(g, new THREE.CylinderGeometry(1.2, 1.2, 0.04, 36), water, 0, 0.42);
  part(g, new THREE.CylinderGeometry(0.16, 0.26, 0.95, 16), STONE, 0, 0.85);
  part(g, new THREE.CylinderGeometry(0.62, 0.3, 0.22, 24), STONE, 0, 1.32);
  part(g, new THREE.CylinderGeometry(0.54, 0.54, 0.03, 24), water, 0, 1.43);
  part(g, new THREE.CylinderGeometry(0.08, 0.12, 0.4, 12), STONE, 0, 1.6);
  part(g, new THREE.SphereGeometry(0.13, 12, 10), STONE, 0, 1.86);
  const fall = new THREE.MeshStandardMaterial({ color: "#e6f6fa", transparent: true, opacity: 0.32, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const curtain = part(g, new THREE.CylinderGeometry(0.62, 0.78, 0.95, 28, 1, true), fall, 0, 0.93);
  return { group: g, water, fall, curtain };
}

// ---------- 咖啡店
function cafe() {
  const g = new THREE.Group();
  const cream = mat("#f1e6d0");
  const trim = mat("#fbf7ef");
  part(g, new THREE.BoxGeometry(3.0, 4.1, 2.4), cream, 0, 2.05, 0);
  box(g, 3.12, 0.16, 2.52, trim, 0, 2.2, 0);
  box(g, 3.2, 0.2, 2.6, mat("#6d5a52"), 0, 4.2, 0);
  // 一楼店面：木框 + 大窗户 + 门
  box(g, 3.02, 1.95, 0.08, WOOD_DARK, 0, 0.98, 1.2);
  const shopGlass = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#bcd6de", emissive: "#ffcf86", emissiveIntensity: 0, roughness: 0.15 }), 1.6);
  box(g, 1.55, 1.05, 0.04, shopGlass, -0.55, 1.15, 1.25);
  box(g, 0.62, 1.55, 0.05, mat("#5c4033"), 0.95, 0.8, 1.26);
  part(g, new THREE.SphereGeometry(0.035, 8, 6), mat("#e8c46a", { metalness: 0.5, roughness: 0.3 }), 0.75, 0.85, 1.3);
  // 二楼的窗户和花箱
  for (const x of [-0.75, 0.75]) {
    box(g, 0.7, 0.9, 0.05, shopGlass, x, 3.05, 1.22);
    box(g, 0.82, 0.08, 0.1, trim, x, 2.58, 1.25);
    box(g, 0.78, 0.18, 0.22, WOOD, x, 2.5, 1.32);
    for (let k = 0; k < 3; k++) part(g, blob(0.1, k), mat(["#f6a5c0", "#ffffff", "#ffd66e"][k], { roughness: 0.7 }), x - 0.22 + k * 0.22, 2.66, 1.33);
  }
  // 条纹遮阳篷
  const stripes = canvasTexture(256, 64, (c, W, H) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "#f6efe2" : "#d9604f";
      c.fillRect((i * W) / 8, 0, W / 8, H);
    }
  });
  box(g, 3.25, 0.06, 1.0, new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8 }), 0, 2.02, 1.68, 0.38);
  for (let k = 0; k < 8; k++) part(g, new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(k % 2 ? "#f6efe2" : "#d9604f"), -1.42 + k * 0.405, 1.84, 2.14);
  const sign = textPlane("ISLAND CAFÉ", { width: 2.2, color: "#5c4033", bg: "rgba(251,247,239,0.97)", font: "700 96px" });
  sign.position.set(0, 3.75, 1.23);
  g.add(sign);
  // 侧面挂的咖啡杯招牌
  box(g, 0.05, 0.05, 0.5, WOOD_DARK, 1.55, 3.0, 0.95);
  part(g, new THREE.CylinderGeometry(0.15, 0.12, 0.22, 16), trim, 1.55, 2.82, 1.15);
  part(g, new THREE.TorusGeometry(0.07, 0.02, 6, 12), trim, 1.55, 2.82, 1.0, 0, Math.PI / 2);
  // 屋顶的小盆栽
  for (const x of [-1.1, 0, 1.1]) {
    part(g, new THREE.CylinderGeometry(0.16, 0.12, 0.25, 10), mat("#c98a6a"), x, 4.42, 0.7);
    part(g, blob(0.24, x + 5), mat("#7fae6d"), x, 4.65, 0.7);
  }
  // 门口的桌椅、遮阳伞、小黑板
  const tableTop = mat("#fbf7ef");
  for (const x of [-0.95, 0.95]) {
    part(g, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20), tableTop, x, 0.72, 2.75);
    part(g, new THREE.CylinderGeometry(0.04, 0.05, 0.7, 8), mat("#4a4a4a"), x, 0.36, 2.75);
    for (const dz of [-0.48, 0.48]) {
      box(g, 0.32, 0.05, 0.32, WOOD, x + dz * 0.2, 0.45, 2.75 + dz);
      box(g, 0.32, 0.38, 0.05, WOOD, x + dz * 0.2, 0.66, 2.75 + dz * 1.45);
    }
    part(g, new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), tableTop, x + 0.1, 0.8, 2.72);
  }
  part(g, new THREE.CylinderGeometry(0.025, 0.025, 2.0, 6), mat("#4a4a4a"), -0.95, 1.4, 2.75);
  part(g, new THREE.ConeGeometry(1.0, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ map: stripes, side: THREE.DoubleSide, roughness: 0.8 }), -0.95, 2.35, 2.75);
  const board = textPlane("COFFEE · TEA · CAKE", { width: 0.75, color: "#ffffff", bg: "#3b3a38", font: "700 64px", height: 0.55 });
  board.position.set(1.9, 0.55, 2.2);
  board.rotation.set(-0.15, -0.4, 0);
  g.add(board);
  for (const x of [-1.35, 1.35]) {
    part(g, new THREE.CylinderGeometry(0.2, 0.15, 0.35, 12), mat("#c98a6a"), x, 0.17, 1.45);
    part(g, blob(0.3, x), mat("#7fae6d"), x, 0.55, 1.45);
  }
  lanternLight(g, -1.55, 2.4, 1.3);
  return g;
}

// ---------- 抽签小摊
function luckyStall() {
  const g = new THREE.Group();
  const red = mat("#d9604f");
  box(g, 1.9, 0.95, 0.75, WOOD, 0, 0.48, 0);
  box(g, 2.0, 0.07, 0.85, WOOD_DARK, 0, 0.97, 0);
  for (const x of [-0.92, 0.92]) box(g, 0.1, 2.3, 0.1, WOOD_DARK, x, 1.15, -0.3);
  for (const s of [-1, 1]) box(g, 1.25, 0.08, 1.2, red, s * 0.55, 2.42, -0.15, 0, 0, s * -0.42);
  box(g, 0.1, 0.1, 1.25, WOOD_DARK, 0, 2.66, -0.15);
  const sign = textPlane("LUCKY DRAW", { width: 1.5, color: "#ffffff", bg: "#c4473b", font: "800 92px" });
  sign.position.set(0, 1.95, -0.24);
  g.add(sign);
  // 签筒
  part(g, new THREE.CylinderGeometry(0.17, 0.17, 0.42, 6), red, -0.4, 1.22, 0.05);
  part(g, new THREE.CylinderGeometry(0.175, 0.175, 0.06, 6), mat("#e8c46a", { metalness: 0.4, roughness: 0.35 }), -0.4, 1.3, 0.05);
  for (let k = 0; k < 5; k++) box(g, 0.025, 0.25, 0.012, mat("#f2e2c4"), -0.46 + k * 0.03, 1.5, 0.05, 0, 0, (k - 2) * 0.08);
  // 纸签小盒子
  box(g, 0.5, 0.12, 0.3, mat("#fbf7ef"), 0.45, 1.06, 0.05);
  // 旁边挂满签的绳架
  const rack = new THREE.Group();
  rack.position.set(1.65, 0, 0.1);
  for (const x of [-0.45, 0.45]) box(rack, 0.07, 1.6, 0.07, WOOD_DARK, x, 0.8, 0);
  const paper = mat("#fbf7ef", { roughness: 1 });
  const pink = mat("#f7c1d6", { roughness: 1 });
  for (const y of [1.0, 1.35]) {
    box(rack, 0.95, 0.025, 0.025, WOOD_DARK, 0, y, 0);
    for (let k = 0; k < 7; k++) box(rack, 0.05, 0.13, 0.01, k % 3 ? paper : pink, -0.38 + k * 0.125, y - 0.08, 0.02, 0, 0, (k % 2 ? 1 : -1) * 0.15);
  }
  g.add(rack);
  // 红灯笼
  for (const x of [-0.75, 0.75]) {
    part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), WOOD_DARK, x, 2.12, 0.35);
    lanternLight(g, x, 1.95, 0.35, "#ff8a72").scale.set(1.2, 1.5, 1.2);
  }
  return g;
}

// ---------- 池塘和小木桥
function pond() {
  const g = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ color: "#6fc6c0", transparent: true, opacity: 0.85, roughness: 0.1 });
  const surface = part(g, new THREE.CircleGeometry(POND.r - 0.05, 48), water, 0, 0, 0, -Math.PI / 2);
  const pads = new THREE.Group();
  const padMat = mat("#6fa35f", { roughness: 0.8 });
  const r = rng(41);
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2;
    const d = 0.6 + r() * (POND.r - 1.1);
    const pad = part(pads, new THREE.CircleGeometry(0.2 + r() * 0.1, 14, 0.3, Math.PI * 2 - 0.6), padMat, Math.cos(a) * d, 0.02, Math.sin(a) * d, -Math.PI / 2, 0, r() * 6);
    pad.receiveShadow = true;
    if (k % 3 === 0) part(pads, blob(0.07, k), mat("#f6b4c8", { roughness: 0.6 }), Math.cos(a) * d, 0.07, Math.sin(a) * d);
  }
  g.add(pads);
  const stoneMat = mat("#cfc7bb", { roughness: 0.95 });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + r() * 0.2;
    if (Math.abs(Math.cos(a)) > 0.93) continue;
    const s = 0.22 + r() * 0.2;
    const st = part(g, blob(s, k, { detail: 0, smooth: false }), stoneMat, Math.cos(a) * (POND.r + 0.05), 0.12, Math.sin(a) * (POND.r + 0.05));
    st.scale.y = 0.7;
  }
  // 拱桥（沿 x 方向横跨）
  const span = POND.r * 2 + 0.6;
  const arc = (t) => Math.sin(Math.PI * t) * 0.65 + 0.25;
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const x = -span / 2 + t * span;
    const slope = Math.cos(Math.PI * t) * 0.65 * Math.PI / span;
    box(g, span / 12 + 0.02, 0.06, 0.95, WOOD, x, arc(t), 0, 0, 0, Math.atan(slope));
  }
  for (const z of [-0.47, 0.47]) {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push(new THREE.Vector3(-span / 2 + t * span, arc(t) + 0.55, z));
      if (k % 3 === 0) box(g, 0.06, 0.55, 0.06, WOOD_DARK, -span / 2 + t * span, arc(t) + 0.28, z);
    }
    part(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 6), WOOD_DARK);
  }
  return { group: g, water, pads, surface };
}

function bench(parent, x, z, faceX, faceZ) {
  const g = new THREE.Group();
  box(g, 1.5, 0.08, 0.48, WOOD, 0, 0.46, 0);
  box(g, 1.5, 0.38, 0.06, WOOD, 0, 0.75, -0.22, -0.12);
  for (const sx of [-0.65, 0.65]) box(g, 0.07, 0.46, 0.44, mat("#4a4f55"), sx, 0.23, 0);
  g.position.set(x, terrainHeight(x, z), z);
  g.rotation.y = Math.atan2(faceX - x, faceZ - z);
  parent.add(g);
}

function lampPost(parent, x, z) {
  const g = new THREE.Group();
  const iron = mat("#3f4547", { roughness: 0.5 });
  part(g, new THREE.CylinderGeometry(0.05, 0.08, 2.2, 8), iron, 0, 1.1);
  box(g, 0.28, 0.32, 0.28, glassMat(0.5), 0, 2.36);
  part(g, new THREE.ConeGeometry(0.24, 0.18, 4), iron, 0, 2.6, 0, 0, Math.PI / 4);
  lanternLight(g, 0, 2.36, 0);
  g.position.set(x, terrainHeight(x, z), z);
  parent.add(g);
}

export function createPlaza(scene, world) {
  const root = new THREE.Group();
  scene.add(root);
  const flowerSpots = [];
  const r = rng(91);
  const at = (x, z) => [x, terrainHeight(x, z), z];
  const onGround = (obj, x, z, faceX = 0, faceZ = 0) => {
    obj.position.set(...at(x, z));
    obj.rotation.y = Math.atan2(faceX - x, faceZ - z);
    root.add(shadowed(obj));
    return obj;
  };
  const paved = (x, z, radius) => {
    const tex = stoneTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(radius / 1.4, radius / 1.4);
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, terrainHeight(x, z) + 0.05, z);
    m.receiveShadow = true;
    root.add(m);
    return m.material;
  };
  const ringBed = (cx, cz, r0, r1, n, gapFrom = null, gapTo = null) => {
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      if (gapFrom !== null && a > gapFrom && a < gapTo) continue;
      const d = r0 + r() * (r1 - r0);
      flowerSpots.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d, ["tulip", "lavender", "puff", "daisy"][Math.floor((a / (Math.PI * 2)) * 8) % 4], Math.floor(r() * 10)]);
    }
  };
  const soil = (cx, cz, r0, r1) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), mat("#7a5a44", { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, terrainHeight(cx, cz) + 0.04, cz);
    m.receiveShadow = true;
    root.add(m);
  };

  // 花房在正中间，门朝南（码头那边）
  const stoneMats = [paved(0, 0, 5.3)];
  const house = onGround(flowerHouse(), 0, 0, 0, 10);
  house.userData.kind = "flowerhouse";
  world.colliders.push({ x: 0, z: 0, r: 3.45 }, { x: -0.7, z: 3.4, r: 0.35 }, { x: 0.7, z: 3.4, r: 0.35 });
  soil(0, 0, 3.55, 4.35);
  ringBed(0, 0, 3.6, 4.3, 170, Math.PI * 0.38, Math.PI * 0.62);
  world.colliders.push(...Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2;
    return Math.abs(a - Math.PI / 2) < 0.45 ? null : { x: Math.cos(a) * 3.95, z: Math.sin(a) * 3.95, r: 0.42 };
  }).filter(Boolean));

  // 喷泉在南边的小广场
  const F = { x: 0, z: 8.1 };
  stoneMats.push(paved(F.x, F.z, 3.2));
  const fnt = fountain();
  onGround(fnt.group, F.x, F.z);
  soil(F.x, F.z, 1.55, 2.35);
  ringBed(F.x, F.z, 1.6, 2.3, 110);
  world.colliders.push({ x: F.x, z: F.z, r: 2.3 });
  bench(root, -2.9, 10.3, F.x, F.z);
  bench(root, 2.9, 10.3, F.x, F.z);
  world.colliders.push({ x: -2.9, z: 10.3, r: 0.7 }, { x: 2.9, z: 10.3, r: 0.7 });

  // 咖啡店（东南）和抽签小摊（西南），都朝向喷泉
  const cafePos = { x: 7.1, z: 5.6 };
  const cafeObj = onGround(cafe(), cafePos.x, cafePos.z, F.x, F.z);
  cafeObj.userData.kind = "cafe";
  const toward = (p, d) => {
    const a = Math.atan2(F.z - p.z, F.x - p.x);
    return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
  };
  for (const d of [-0.5, 0.6]) {
    const c = toward(cafePos, d);
    world.colliders.push({ x: c.x, z: c.z, r: 1.55 });
  }
  const cafeTables = toward(cafePos, 2.75);
  world.colliders.push({ x: cafeTables.x, z: cafeTables.z, r: 0.5 });
  world.reserved.push([cafePos.x, cafePos.z, 3.6]);

  const luckPos = { x: -6.9, z: 5.5 };
  const stall = onGround(luckyStall(), luckPos.x, luckPos.z, F.x, F.z);
  stall.userData.kind = "luck";
  world.colliders.push({ x: luckPos.x, z: luckPos.z, r: 1.1 });
  const rackW = new THREE.Vector3(1.65, 0, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), stall.rotation.y).add(stall.position);
  world.colliders.push({ x: rackW.x, z: rackW.z, r: 0.55 });
  world.reserved.push([luckPos.x, luckPos.z, 3]);

  // 池塘在北边
  const pd = pond();
  pd.group.position.set(POND.x, POND.y, POND.z);
  pd.group.rotation.y = 0.5;
  root.add(shadowed(pd.group, true, true));
  pd.surface.castShadow = false;
  world.colliders.push({ x: POND.x, z: POND.z, r: POND.r + 0.2 });
  world.reserved.push([POND.x, POND.z, POND.r + 1.2]);
  bench(root, POND.x + 2.6, POND.z + 2.0, POND.x, POND.z);
  world.colliders.push({ x: POND.x + 2.6, z: POND.z + 2.0, r: 0.7 });

  // 路灯
  for (const [x, z] of [
    [3.9, 6.6],
    [-3.9, 6.6],
    [4.6, -2.8],
    [-4.6, -2.8],
  ]) {
    lampPost(root, x, z);
    world.colliders.push({ x, z, r: 0.25 });
  }
  shadowed(root, true, true);
  world.reserved.push([0, 0, 5.6], [F.x, F.z, 3.4]);

  // 花园里的几棵小树（避开站点和镜头的方向）
  const specials = [
    [160, "round"],
    [197, "blossom"],
    [294, "blossom"],
    [341, "round"],
  ].map(([deg, type]) => {
    const a = (deg * Math.PI) / 180;
    return { type, x: Math.cos(a) * 9.6, z: Math.sin(a) * 9.6, s: 0.72 };
  });

  // 互动点：站到这里会出现按钮
  const front = (obj, d) => new THREE.Vector3(0, 0, d).applyAxisAngle(new THREE.Vector3(0, 1, 0), obj.rotation.y).add(obj.position);
  const cafeFront = front(cafeObj, 3.5);
  const luckFront = front(stall, 1.6);
  const interactions = [
    { kind: "flowerhouse", x: 0, z: 4.9, r: 2.2, label: "Enter the Flower House" },
    { kind: "cafe", x: cafeFront.x, z: cafeFront.z, r: 2.4, label: "Order a drink" },
    { kind: "luck", x: luckFront.x, z: luckFront.z, r: 2.2, label: "Draw a lucky note" },
  ];

  function setSeason(name) {
    const winter = name === "winter";
    pd.water.color.set(winter ? "#e4f1f6" : "#6fc6c0");
    pd.water.opacity = winter ? 0.95 : 0.85;
    pd.pads.visible = !winter;
    fnt.water.color.set(winter ? "#e4f1f6" : "#8fd6e0");
    fnt.curtain.visible = !winter;
    for (const m of stoneMats) {
      m.emissive.set("#ffffff");
      m.emissiveIntensity = winter ? 0.12 : 0;
    }
  }

  function update(t) {
    fnt.fall.opacity = 0.26 + Math.sin(t * 6) * 0.06;
    fnt.curtain.rotation.y = t * 0.6;
  }

  return { flowerSpots, specials, interactions, pickables: [house, cafeObj, stall], setSeason, update };
}
