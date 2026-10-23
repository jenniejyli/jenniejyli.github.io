import * as THREE from "three";
import { STATIONS } from "./data.js";
import { terrainHeight } from "./world.js";
import { lerp, mat, facadeMaterial, textPlane, labelSprite, shadowed, glowsAtNight } from "./util.js";

// 每个建筑都朝 +z 方向（停靠点那边）搭，原点在地面中心。
// 返回：group 模型；colliders 不能穿过的圆；clear 不种树的范围；trees 特别的树；height 高度；front 正门离原点多远。

const WHITE = mat("#f4f2ee");
const ROOF = mat("#e3e5e6");
const GLASS = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#a8cadb", roughness: 0.25, metalness: 0.1, emissive: "#ffd79a", emissiveIntensity: 0 }), 0.35);
const RED = mat("#de5a52", { roughness: 0.55 });

function part(group, geo, material, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  group.add(m);
  return m;
}

const box = (g, w, h, d, m, x, y, z, ry = 0) => part(g, new THREE.BoxGeometry(w, h, d), m, x, y, z, ry);

function line(x0, x1, z, r) {
  const n = Math.max(1, Math.ceil((x1 - x0) / (r * 1.3)));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: lerp(x0, x1, i / n), z, r }));
}

// 港科大的"红鸟"雕塑（广州校区也是同一件）：一个又高又细的弯月往上长，
// 加一个碗形的弯月，两个在底部相交、错开一个角度，像一只展翅的鸟。
function crescentShape(points) {
  const s = new THREE.Shape();
  s.moveTo(...points[0]);
  s.quadraticCurveTo(...points[1], ...points[2]);
  s.quadraticCurveTo(...points[3], ...points[4]);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 24 });
}

function redBird() {
  const g = new THREE.Group();
  const tall = crescentShape([
    [0, 0],
    [-0.95, 2.0],
    [-0.15, 4.1],
    [-0.35, 2.0],
    [0.28, 0.12],
  ]);
  tall.translate(0, 0, -0.08);
  const bowl = crescentShape([
    [0, 0],
    [1.65, -0.05],
    [1.95, 2.15],
    [1.2, 0.55],
    [0.26, 0.14],
  ]);
  bowl.translate(0, 0, -0.08);
  const a = new THREE.Mesh(tall, RED);
  const b = new THREE.Mesh(bowl, RED);
  b.rotation.y = -0.9;
  g.add(a, b);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.35, 16), mat("#cfc6b8"));
  base.position.y = -0.15;
  g.add(base);
  return g;
}

function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(w, d, h, r) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: h, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function dish() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(0.08, 0.12, 1.3, 8), mat("#8b939c"), 0, 0.65, 0);
  const bowlGeo = new THREE.SphereGeometry(0.95, 20, 8, 0, Math.PI * 2, 0, 0.8);
  bowlGeo.translate(0, -0.8, 0);
  const bowl = part(g, bowlGeo, mat("#f5f5f2", { side: THREE.DoubleSide }), 0, 1.45, 0);
  bowl.rotation.x = Math.PI + 0.65;
  part(g, new THREE.SphereGeometry(0.08, 8, 6), mat("#8b939c"), 0, 1.75, 0.45);
  return g;
}

function car(color) {
  const g = new THREE.Group();
  const bodyGeo = new THREE.CapsuleGeometry(0.45, 1.5, 6, 14);
  bodyGeo.rotateZ(Math.PI / 2);
  bodyGeo.scale(1, 0.62, 0.95);
  part(g, bodyGeo, mat(color, { roughness: 0.35 }), 0, 0.5, 0);
  const cabin = part(g, new THREE.SphereGeometry(0.55, 16, 10), GLASS, -0.1, 0.72, 0);
  cabin.scale.set(1.35, 0.6, 0.75);
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 14);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [x, z] of [
    [0.75, 0.42],
    [-0.75, 0.42],
    [0.75, -0.42],
    [-0.75, -0.42],
  ]) {
    part(g, wheelGeo, mat("#4d535c"), x, 0.24, z);
  }
  return g;
}

// ===== 1 广外：红砂岩墙 + 白色门框 + 木棉 =====
function gdufs() {
  const g = new THREE.Group();
  const stone = mat("#d29a80");
  const stoneDark = mat("#c0866d");
  const colliders = [];
  for (const side of [-1, 1]) {
    const cx = side * 5.6;
    box(g, 6.2, 1.1, 1.6, stone, cx, 0.55, 0);
    box(g, 5.6, 0.9, 1.45, stoneDark, cx + side * 0.3, 1.55, -0.05);
    box(g, 6.0, 0.7, 1.5, stone, cx - side * 0.15, 2.3, 0.02);
    box(g, 4.2, 0.5, 1.3, stoneDark, cx + side * 0.6, 2.9, -0.05);
    colliders.push(...line(cx - 3, cx + 3, 0, 0.9));
  }
  box(g, 0.7, 3.8, 1.9, WHITE, -2.3, 1.9, 0);
  box(g, 0.7, 3.8, 1.9, WHITE, 2.3, 1.9, 0);
  box(g, 5.3, 0.8, 2.0, WHITE, 0, 4.1, 0);
  colliders.push({ x: -2.3, z: 0, r: 0.55 }, { x: 2.3, z: 0, r: 0.55 });
  const name = textPlane("GUANGDONG UNIVERSITY OF FOREIGN STUDIES", { width: 5.2, color: "#fff8ec", font: "700 58px" });
  name.position.set(-5.5, 1.6, 0.74);
  g.add(name);
  const name2 = textPlane("广东外语外贸大学", { width: 4.2, color: "#fff8ec", font: "700 80px" });
  name2.position.set(5.6, 1.6, 0.74);
  g.add(name2);

  // 门后的教学楼
  const facade = facadeMaterial({ wall: "#dca88f", glass: "#8fb4c8", cols: 8, rows: 3, seed: 3 });
  box(g, 11, 4.2, 3.4, facade, 0, 2.1, -6.2);
  box(g, 11.2, 0.25, 3.6, ROOF, 0, 4.3, -6.2);
  colliders.push(...line(-5.5, 5.5, -6.2, 1.8));

  return {
    group: g,
    colliders,
    clear: [[0, -2.5, 8.5]],
    trees: [
      { type: "kapok", x: -6.4, z: -2.8, s: 1.1 },
      { type: "kapok", x: 6.4, z: -2.8, s: 1.1 },
      { type: "kapok", x: 9.2, z: 1.6, s: 0.9 },
    ],
    height: 5.2,
    front: 1.0,
  };
}

// ===== 2 广东广播电视台：砖红色塔楼 + 卫星天线 =====
function gdrtv() {
  const g = new THREE.Group();
  const colliders = [];
  const podium = facadeMaterial({ wall: "#efe8de", glass: "#a9c2cf", cols: 8, rows: 2, bands: true, seed: 5 });
  box(g, 7.5, 2.4, 4.5, podium, 0, 1.2, -1.2);
  box(g, 7.7, 0.2, 4.7, ROOF, 0, 2.5, -1.2);
  colliders.push(...line(-2.8, 2.8, -1.2, 2.2));

  const tower = facadeMaterial({ wall: "#c98466", glass: "#f3e3cd", cols: 4, rows: 6, seed: 6 });
  box(g, 3.4, 5.6, 3.4, tower, 0, 2.8 + 2.4, -1.6);
  for (const [x, z] of [
    [-1.7, -1.6 - 1.7],
    [1.7, -1.6 - 1.7],
    [-1.7, -1.6 + 1.7],
    [1.7, -1.6 + 1.7],
  ]) {
    box(g, 0.32, 5.9, 0.32, WHITE, x, 2.95 + 2.4, z);
  }
  part(g, new THREE.CylinderGeometry(1.5, 1.9, 0.9, 20), WHITE, 0, 8.45, -1.6);
  part(g, new THREE.CylinderGeometry(2.3, 2.3, 0.3, 24), mat("#e9e6df"), 0, 9.05, -1.6);
  const drum = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#cfe2ec", emissive: "#ffd79a", emissiveIntensity: 0, roughness: 0.3 }), 1.2);
  part(g, new THREE.CylinderGeometry(1.0, 1.1, 1.3, 20), drum, 0, 9.85, -1.6);
  part(g, new THREE.ConeGeometry(0.2, 1.8, 8), WHITE, 0, 11.4, -1.6);

  const d1 = dish();
  d1.position.set(-2.7, 0, 2.5);
  d1.rotation.y = 0.5;
  const d2 = dish();
  d2.position.set(2.8, 0, 2.2);
  d2.rotation.y = -0.4;
  d2.scale.setScalar(0.8);
  g.add(d1, d2);
  colliders.push({ x: -2.7, z: 2.5, r: 0.9 }, { x: 2.8, z: 2.2, r: 0.8 });

  return { group: g, colliders, clear: [[0, -1, 6]], trees: [], height: 12.3, front: 1.05 };
}

// ===== 3 广汽研究院：斜顶玻璃楼 + 概念车 =====
function gac() {
  const g = new THREE.Group();
  const colliders = [];
  const podium = facadeMaterial({ wall: "#f4f4f2", glass: "#9cc3d8", cols: 6, rows: 1, bands: true, seed: 7 });
  box(g, 14, 1.2, 7.4, podium, 0, 0.6, -1.2);

  const shape = new THREE.Shape();
  shape.moveTo(-6, 0);
  shape.lineTo(6, 0);
  shape.lineTo(6, 6.8);
  shape.lineTo(-6, 4.6);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 4.6, bevelEnabled: false });
  bodyGeo.translate(0, 0, -4.1);
  const glass = facadeMaterial({ wall: "#e9eff3", glass: "#93bdd4", cols: 1, rows: 1, bands: true, lit: 0.7, seed: 8, repeat: [0.25, 1 / 1.1] });
  part(g, bodyGeo, glass, 0, 1.2, 0);
  for (const y of [2.9, 4.1, 5.3]) box(g, 12.3, 0.12, 0.55, WHITE, 0, y, 0.7);

  box(g, 4.2, 0.18, 2.4, WHITE, 0, 2.15, 1.9);
  for (const x of [-1.9, 1.9]) part(g, new THREE.CylinderGeometry(0.08, 0.08, 2.1, 8), WHITE, x, 1.05, 2.9);
  colliders.push({ x: -1.9, z: 2.9, r: 0.2 }, { x: 1.9, z: 2.9, r: 0.2 });

  const sign = textPlane("GAC R&D CENTER", { width: 3.4, color: "#d0453c", font: "800 92px" });
  sign.position.set(-4.0, 0.62, 2.52);
  g.add(sign);

  const c = car("#8dbfe0");
  c.position.set(4.3, 0, 3.6);
  c.rotation.y = 0.5;
  g.add(c);
  colliders.push({ x: 4.3, z: 3.6, r: 1.3 });
  colliders.push(...line(-6, 6, -1.6, 2.6));

  return { group: g, colliders, clear: [[0, -1, 8]], trees: [], height: 8, front: 3.1 };
}

// ===== 4 港科大：半圆形大楼 + 红色帆船雕塑 =====
function hkust() {
  const g = new THREE.Group();
  const colliders = [];
  const R = 6.6;
  const segs = 13;
  const a0 = Math.PI * 1.05;
  const a1 = Math.PI * 1.95;
  const facade = facadeMaterial({ wall: "#f4f3ef", glass: "#8fa9bb", cols: 4, rows: 4, seed: 4 });
  const step = (a1 - a0) / segs;
  const chord = 2 * R * Math.sin(step / 2) + 0.06;
  for (let i = 0; i < segs; i++) {
    const a = a0 + (i + 0.5) * step;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    const ry = Math.atan2(-Math.cos(a), -Math.sin(a));
    box(g, chord, 4.4, 1.8, facade, x, 2.2, z, ry);
    box(g, chord + 0.02, 0.25, 2.0, ROOF, x, 4.5, z, ry);
    colliders.push({ x, z, r: 1.15 });
  }
  const plaza = part(g, new THREE.CircleGeometry(R - 1.1, 48), mat("#ebe6dc", { roughness: 0.95 }), 0, 0.06, 0);
  plaza.rotation.x = -Math.PI / 2;
  for (const rr of [2.2, 3.6]) {
    const ring = part(g, new THREE.RingGeometry(rr, rr + 0.12, 48), mat("#d6d0c4"), 0, 0.07, 0);
    ring.rotation.x = -Math.PI / 2;
  }

  // 后面的楼和玻璃穹顶
  const back = facadeMaterial({ wall: "#f1f0ec", glass: "#9fbfd2", cols: 5, rows: 3, seed: 9 });
  box(g, 6, 4.8, 3.6, back, 0, 2.4, -R - 2.4);
  const dome = part(g, new THREE.SphereGeometry(2.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, 0, 4.8, -R - 2.4);
  dome.scale.y = 0.8;
  colliders.push({ x: -1.8, z: -R - 2.4, r: 2 }, { x: 1.8, z: -R - 2.4, r: 2 });

  const bird = redBird();
  bird.position.set(0, 0.32, 1.2);
  bird.rotation.y = 0.35;
  g.add(bird);
  colliders.push({ x: 0, z: 1.2, r: 0.8 });

  return {
    group: g,
    colliders,
    clear: [[0, -1.5, 9.5]],
    trees: [
      { type: "palm", x: -5.2, z: 2.8, s: 1 },
      { type: "palm", x: 5.2, z: 2.8, s: 1.1 },
    ],
    height: 5.5,
    front: 5.4,
  };
}

// ===== 5 港科大（广州）：退台式弧形楼 + 空中连廊 + 粉色花树 =====
function hkustgz() {
  const g = new THREE.Group();
  const colliders = [];
  const R = 6.2;
  const lower = facadeMaterial({ wall: "#f5f5f2", glass: "#a7c6d6", cols: 3, rows: 3, bands: true, seed: 10 });
  const upper = facadeMaterial({ wall: "#f0f1ef", glass: "#9cc0d2", cols: 3, rows: 2, bands: true, seed: 11 });
  const roofGreen = mat("#a9d39a", { flatShading: true });
  const wing = (from, to) => {
    const n = 5;
    const step = (to - from) / n;
    for (let i = 0; i < n; i++) {
      const a = from + (i + 0.5) * step;
      const ry = Math.atan2(-Math.cos(a), -Math.sin(a));
      const at = (rr) => [Math.cos(a) * rr, Math.sin(a) * rr];
      const chord = 2 * R * Math.sin(Math.abs(step) / 2) + 0.08;
      const [x0, z0] = at(R);
      box(g, chord, 3.2, 2.6, lower, x0, 1.6, z0, ry);
      const [x1, z1] = at(R + 0.4);
      box(g, chord * 1.02, 1.8, 1.8, upper, x1, 4.1, z1, ry);
      box(g, chord * 1.04, 0.15, 2.0, ROOF, x1, 5.05, z1, ry);
      const [x2, z2] = at(R - 0.95);
      box(g, chord, 0.3, 0.6, roofGreen, x2, 3.35, z2, ry);
      colliders.push({ x: x0, z: z0, r: 1.35 });
    }
  };
  wing(Math.PI * 0.98, Math.PI * 1.38);
  wing(Math.PI * 1.62, Math.PI * 2.02);

  // 两翼之间的空中连廊（下面可以走过去）
  const bridgeLen = 2 * R * Math.sin(Math.PI * 0.12) + 1.4;
  const bridge = facadeMaterial({ wall: "#f3f4f2", glass: "#8fb7cc", cols: 2, rows: 1, bands: true, lit: 0.9, seed: 12 });
  box(g, bridgeLen, 1.7, 2.0, bridge, 0, 4.2, -R * Math.cos(Math.PI * 0.12));
  box(g, bridgeLen + 0.1, 0.15, 2.2, ROOF, 0, 5.1, -R * Math.cos(Math.PI * 0.12));

  const garden = part(g, new THREE.CircleGeometry(2.8, 40), mat("#b9dca6", { roughness: 1 }), 0, 0.06, 0);
  garden.rotation.x = -Math.PI / 2;
  const edge = part(g, new THREE.RingGeometry(2.7, 3.0, 40), mat("#e2dccd"), 0, 0.07, 0);
  edge.rotation.x = -Math.PI / 2;
  const bird = redBird();
  bird.position.set(0, 0.32, 0);
  bird.rotation.y = 0.35;
  g.add(bird);
  colliders.push({ x: 0, z: 0, r: 0.8 });

  return {
    group: g,
    colliders,
    clear: [[0, -2, 8.5]],
    trees: [
      { type: "blossom", x: -3.7, z: 2.9, s: 1 },
      { type: "blossom", x: 3.7, z: 2.9, s: 1 },
      { type: "blossom", x: -7.4, z: 2.4, s: 1.15 },
      { type: "blossom", x: 7.4, z: 2.4, s: 1.15 },
      { type: "blossom", x: 0, z: -3.2, s: 0.9 },
    ],
    height: 5.5,
    front: 2.9,
  };
}

// ===== 6 理大：红砖楼 + 圆柱塔 + 白色流线型创新楼 =====
function polyu() {
  const g = new THREE.Group();
  const colliders = [];
  const brick = facadeMaterial({ wall: "#b56f5d", glass: "#8fa9b8", cols: 6, rows: 4, seed: 13 });
  box(g, 6.4, 4.2, 3.6, brick, -3.6, 2.1, -1.6);
  box(g, 6.6, 0.25, 3.8, mat("#9c5c4d"), -3.6, 4.3, -1.6);
  const brick2 = facadeMaterial({ wall: "#b46e5c", glass: "#8fa9b8", cols: 4, rows: 2, seed: 14 });
  box(g, 4.2, 2.6, 3, brick2, 0.6, 1.3, -3.4);
  colliders.push(...line(-6.4, -0.8, -1.6, 1.8), { x: 0.6, z: -3.4, r: 1.8 });

  const towerMat = facadeMaterial({ wall: "#b06a58", glass: "#9fb9c9", cols: 1, rows: 7, bands: true, seed: 15, repeat: [3, 1] });
  part(g, new THREE.CylinderGeometry(1.7, 1.7, 8, 28), towerMat, 1.4, 4, -0.9);
  part(g, new THREE.CylinderGeometry(1.84, 1.84, 0.35, 28), mat("#9c5c4d"), 1.4, 8.15, -0.9);
  const plate = textPlane("PolyU", { width: 1.5, color: "#b8322a", bg: "#f6efe6", font: "800 110px" });
  plate.position.set(1.4, 6.7, -0.9 + 1.72);
  g.add(plate);
  colliders.push({ x: 1.4, z: -0.9, r: 1.85 });

  // 赛马会创新楼：一层层白色圆角板往前倾
  const whiteSlab = slab(3.6, 2.7, 0.5, 0.9);
  const glassSlab = slab(3.3, 2.4, 0.45, 0.8);
  for (let i = 0; i < 8; i++) {
    const x = 5.4 + i * 0.09;
    const z = -1.8 + i * 0.17;
    part(g, whiteSlab, WHITE, x, i * 0.95, z);
    part(g, glassSlab, GLASS, x, i * 0.95 + 0.5, z);
  }
  part(g, whiteSlab, WHITE, 5.4 + 8 * 0.09, 8 * 0.95, -1.8 + 8 * 0.17);
  colliders.push({ x: 5.6, z: -1.3, r: 2.0 });

  return {
    group: g,
    colliders,
    clear: [[0, -1.5, 9]],
    trees: [
      { type: "round", x: -7.6, z: 1.6, s: 1 },
      { type: "round", x: -4.4, z: 1.9, s: 0.85 },
    ],
    height: 9,
    front: 0.9,
  };
}

const BUILDERS = { gdufs, gdrtv, gac, hkust, hkustgz, polyu };
const BUILDING_SCALE = 0.8; // 建筑整体缩小一点，楼和楼之间空一些

export function buildLandmarks(scene, world) {
  const pickables = [];
  const specialTrees = [];
  STATIONS.forEach((s, index) => {
    const b = BUILDERS[s.id]();
    const [x, z] = s.pos;
    const [sx, sz] = s.stop;
    const rotY = Math.atan2(sx - x, sz - z);
    const y = terrainHeight(x, z) - 0.05;
    const S = BUILDING_SCALE;
    b.group.position.set(x, y, z);
    b.group.rotation.y = rotY;
    b.group.scale.setScalar(S);
    b.group.userData.station = index;
    scene.add(shadowed(b.group));
    pickables.push(b.group);

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const toWorld = (lx, lz) => [x + (lx * cos + lz * sin) * S, z + (-lx * sin + lz * cos) * S];
    for (const c of b.colliders) {
      const [wx, wz] = toWorld(c.x, c.z);
      world.colliders.push({ x: wx, z: wz, r: c.r * S });
    }
    for (const [cx, cz, cr] of b.clear) {
      const [wx, wz] = toWorld(cx, cz);
      world.reserved.push([wx, wz, cr * S]);
    }
    for (const t of b.trees) {
      const [wx, wz] = toWorld(t.x, t.z);
      specialTrees.push({ type: t.type, x: wx, z: wz, s: t.s });
    }

    // 从停靠点到正门的小路
    const dir = new THREE.Vector3(x - sx, 0, z - sz);
    const dist = dir.length();
    dir.normalize();
    if (dist - b.front * S > 2.6) {
      const a = new THREE.Vector3(sx, 0, sz).addScaledVector(dir, 2.2);
      const e = new THREE.Vector3(sx, 0, sz).addScaledVector(dir, dist - b.front * S);
      world.addPathStrip(a, e, 1.8);
    }

    const label = labelSprite(`${String(index + 1).padStart(2, "0")} · ${s.short}`, `${s.city} · ${s.period}`);
    label.position.set(x, y + b.height * S + 2, z);
    scene.add(label);
  });
  return { pickables, specialTrees };
}
