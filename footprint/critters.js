import * as THREE from "three";
import { islandRadius, terrainHeight, PIER } from "./world.js";
import { rng, mergeShaded, m4, between, canvasTexture } from "./util.js";

// ===== 小岛上和海里的小动物 =====
// 海里：海星、贝壳、珊瑚、水母、章鱼、海龟、沙滩上横着走的小螃蟹（像潮汐之庭那样，一圈都有）
// 岛上：一只黑猫、一只橘猫到处溜达（点一下会"喵"）；冬天海边有企鹅摇摇摆摆地走
// 夏天：沙滩上的遮阳伞、毛巾、沙堡、沙滩球

const critterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// 小岛一圈上的某个角度（避开码头那一段）
const nearPier = (a) => Math.abs(((a - Math.PI / 2 + Math.PI * 3) % TAU) - Math.PI) < 0.14;
const ringPoint = (a, offset) => {
  const r = islandRadius(a) + offset;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

function stick(a, b, r, color, seg = 6) {
  const { matrix, len } = between(a, b);
  return { geo: new THREE.CylinderGeometry(r * 0.8, r, len, seg), matrix, color };
}

// ---------- 模型（每只都合成一个几何体）

function starGeo() {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + Math.PI / 2;
    const rr = k % 2 ? 0.07 : 0.2;
    if (k === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function shellGeo() {
  const pts = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.09 * (1 - t * 0.3), t * 0.12));
  }
  const g = new THREE.LatheGeometry(pts, 10, 0, Math.PI);
  g.rotateX(-Math.PI / 2);
  return g;
}

function coralGeo(seed) {
  const r = rng(seed);
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + r();
    const base = v3(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    const mid = base.clone().add(v3(Math.cos(a) * 0.15, 0.35 + r() * 0.2, Math.sin(a) * 0.15));
    const tip = mid.clone().add(v3(Math.cos(a + 0.6) * 0.12, 0.2 + r() * 0.2, Math.sin(a + 0.6) * 0.12));
    parts.push(stick(base, mid, 0.05, "#ffffff"), stick(mid, tip, 0.035, "#ffffff"));
    parts.push({ geo: new THREE.SphereGeometry(0.045, 8, 6), matrix: m4(tip.x, tip.y, tip.z), color: "#ffffff" });
  }
  return mergeShaded(parts);
}

function crabGeo() {
  const red = "#e8673f";
  const parts = [{ geo: new THREE.SphereGeometry(0.16, 16, 10), matrix: m4(0, 0.1, 0, 0, 0, 0, 1, 0.55, 0.8), color: red }];
  for (const s of [-1, 1]) {
    parts.push(stick(v3(s * 0.05, 0.14, 0.08), v3(s * 0.06, 0.24, 0.1), 0.012, red));
    parts.push({ geo: new THREE.SphereGeometry(0.03, 8, 6), matrix: m4(s * 0.06, 0.26, 0.1), color: "#ffffff" });
    parts.push({ geo: new THREE.SphereGeometry(0.016, 6, 4), matrix: m4(s * 0.06, 0.265, 0.125), color: "#1f1a1d" });
    parts.push(stick(v3(s * 0.13, 0.1, 0.06), v3(s * 0.2, 0.14, 0.16), 0.025, red));
    parts.push({ geo: new THREE.SphereGeometry(0.06, 10, 8), matrix: m4(s * 0.21, 0.15, 0.2, 0, 0, 0, 0.8, 0.7, 1.1), color: "#f07a50" });
    for (let k = 0; k < 3; k++) parts.push(stick(v3(s * 0.12, 0.08, -0.05 + k * 0.05), v3(s * 0.24, 0.0, -0.08 + k * 0.06), 0.012, red));
  }
  return mergeShaded(parts);
}

function jellyGeo(color) {
  const parts = [
    { geo: new THREE.SphereGeometry(0.28, 20, 10, 0, TAU, 0, Math.PI / 2), matrix: m4(0, 0, 0, 0, 0, 0, 1, 0.75, 1), color },
    { geo: new THREE.CircleGeometry(0.28, 20).rotateX(Math.PI / 2), matrix: m4(0, 0, 0), color: "#ffffff" },
  ];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    const pts = [0, 1, 2, 3].map((j) => v3(Math.cos(a) * (0.16 - j * 0.02) + Math.sin(j * 1.7 + k) * 0.03, -j * 0.14, Math.sin(a) * (0.16 - j * 0.02)));
    for (let j = 0; j < 3; j++) parts.push(stick(pts[j], pts[j + 1], 0.018 - j * 0.004, "#fbe9f4", 5));
  }
  return mergeShaded(parts);
}

function octopusGeo() {
  const pink = "#f27aa4";
  const parts = [{ geo: new THREE.SphereGeometry(0.32, 20, 14), matrix: m4(0, 0.32, 0, 0, 0, 0, 1, 1.1, 0.95), color: pink }];
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.SphereGeometry(0.07, 10, 8), matrix: m4(s * 0.12, 0.3, 0.27), color: "#ffffff" });
    parts.push({ geo: new THREE.SphereGeometry(0.04, 8, 6), matrix: m4(s * 0.12, 0.3, 0.33), color: "#2a1d24" });
    parts.push({ geo: new THREE.SphereGeometry(0.05, 8, 6), matrix: m4(s * 0.2, 0.2, 0.25, 0, 0, 0, 1, 0.6, 0.5), color: "#ff9db8" });
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const pts = [0, 1, 2, 3].map((j) => v3(Math.cos(a) * (0.2 + j * 0.13), 0.1 - j * 0.04 + (j === 3 ? 0.08 : 0), Math.sin(a) * (0.2 + j * 0.13)));
    for (let j = 0; j < 3; j++) parts.push(stick(pts[j], pts[j + 1], 0.07 - j * 0.018, pink, 7));
  }
  return mergeShaded(parts);
}

function turtleGeo() {
  const parts = [
    {
      geo: new THREE.SphereGeometry(0.45, 20, 12, 0, TAU, 0, Math.PI / 2),
      matrix: m4(0, 0, 0, 0, 0, 0, 1, 0.5, 1.2),
      color: (x, y, z) => ((Math.floor(x * 9 + 20) + Math.floor(z * 7 + 20)) % 2 ? [0.42, 0.55, 0.36] : [0.52, 0.64, 0.42]),
    },
    { geo: new THREE.SphereGeometry(0.42, 18, 6, 0, TAU, Math.PI / 2, Math.PI / 2), matrix: m4(0, 0.01, 0, 0, 0, 0, 1, 0.15, 1.15), color: "#e8dcb0" },
    { geo: new THREE.SphereGeometry(0.13, 12, 10), matrix: m4(0, 0.03, 0.6, 0, 0, 0, 1, 0.85, 1.2), color: "#8db58a" },
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.SphereGeometry(0.025, 6, 4), matrix: m4(s * 0.07, 0.08, 0.7), color: "#1f1a1d" });
    parts.push({ geo: new THREE.SphereGeometry(0.2, 10, 6), matrix: m4(s * 0.45, 0, 0.25, 0, s * -0.6, 0, 1.2, 0.18, 0.5), color: "#8db58a" });
    parts.push({ geo: new THREE.SphereGeometry(0.12, 8, 6), matrix: m4(s * 0.32, 0, -0.42, 0, s * 0.5, 0, 1, 0.2, 0.6), color: "#8db58a" });
  }
  return mergeShaded(parts);
}

function penguinGeo() {
  const parts = [
    { geo: new THREE.CapsuleGeometry(0.22, 0.28, 8, 16), matrix: m4(0, 0.42, 0), color: (x, y, z) => (z > 0.07 && y < 0.7 ? [0.97, 0.97, 0.96] : [0.16, 0.18, 0.24]) },
    { geo: new THREE.SphereGeometry(0.19, 16, 12), matrix: m4(0, 0.8, 0.02), color: (x, y, z) => (z > 0.1 && y < 0.82 ? [0.97, 0.97, 0.96] : [0.16, 0.18, 0.24]) },
    { geo: new THREE.ConeGeometry(0.05, 0.13, 8), matrix: m4(0, 0.78, 0.22, Math.PI / 2, 0, 0), color: "#f2a33a" },
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.SphereGeometry(0.03, 8, 6), matrix: m4(s * 0.07, 0.85, 0.17), color: "#ffffff" });
    parts.push({ geo: new THREE.SphereGeometry(0.016, 6, 4), matrix: m4(s * 0.07, 0.85, 0.195), color: "#111111" });
    parts.push({ geo: new THREE.SphereGeometry(0.04, 8, 6), matrix: m4(s * 0.12, 0.74, 0.14, 0, 0, 0, 1, 0.6, 0.6), color: "#f6a9b8" });
    parts.push({ geo: new THREE.SphereGeometry(0.1, 10, 8), matrix: m4(s * 0.24, 0.45, 0, 0, 0, s * 0.25, 0.35, 1, 0.7), color: "#1f2330" });
    parts.push({ geo: new THREE.SphereGeometry(0.07, 8, 6), matrix: m4(s * 0.09, 0.03, 0.08, 0, 0, 0, 1, 0.35, 1.5), color: "#f2a33a" });
  }
  return mergeShaded(parts);
}

// 猫：身体、头、耳朵、尾巴是一个几何体，四条腿单独做（走路时会动）
function catParts(fur, belly, eye) {
  // 顶点颜色函数要返回 [r, g, b]（以前直接返回了颜色字符串，晚上会变成一闪一闪的彩色）
  const F = new THREE.Color(fur).toArray();
  const B = new THREE.Color(belly).toArray();
  const parts = [
    { geo: new THREE.CapsuleGeometry(0.14, 0.32, 6, 14), matrix: m4(0, 0.32, 0, Math.PI / 2, 0, 0), color: (x, y) => (y < 0.25 ? B : F) },
    { geo: new THREE.SphereGeometry(0.15, 16, 12), matrix: m4(0, 0.5, 0.3, 0, 0, 0, 1.08, 0.95, 1), color: (x, y, z) => (z > 0.4 && y < 0.5 ? B : F) },
    { geo: new THREE.SphereGeometry(0.018, 6, 4), matrix: m4(0, 0.49, 0.45), color: "#f29aaa" },
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.ConeGeometry(0.06, 0.11, 4), matrix: m4(s * 0.08, 0.66, 0.28, -0.1, Math.PI / 4, s * -0.25), color: fur });
    parts.push({ geo: new THREE.SphereGeometry(0.03, 10, 8), matrix: m4(s * 0.06, 0.54, 0.42, 0, 0, 0, 1, 1.2, 0.6), color: eye });
    parts.push({ geo: new THREE.SphereGeometry(0.014, 6, 4), matrix: m4(s * 0.06, 0.54, 0.445, 0, 0, 0, 0.6, 1.4, 0.6), color: "#151515" });
  }
  const tail = [v3(0, 0.36, -0.28), v3(0, 0.5, -0.42), v3(0.04, 0.68, -0.44), v3(0.1, 0.76, -0.36)];
  for (let k = 0; k < 3; k++) parts.push(stick(tail[k], tail[k + 1], 0.035 - k * 0.006, fur));
  return parts;
}

function makeCat(fur, belly, eye) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(mergeShaded(catParts(fur, belly, eye)), critterMat);
  root.add(body);
  const legs = [];
  const legGeo = mergeShaded([
    { geo: new THREE.CylinderGeometry(0.035, 0.03, 0.24, 8), matrix: m4(0, -0.12, 0), color: fur },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), matrix: m4(0, -0.24, 0.01, 0, 0, 0, 1, 0.6, 1.2), color: belly },
  ]);
  for (const [x, z] of [
    [-0.08, 0.17],
    [0.08, 0.17],
    [-0.08, -0.17],
    [0.08, -0.17],
  ]) {
    const leg = new THREE.Mesh(legGeo, critterMat);
    leg.position.set(x, 0.25, z);
    body.add(leg);
    legs.push(leg);
  }
  root.traverse((o) => o.isMesh && (o.castShadow = true));
  return { root, body, legs };
}

// ---------- 夏天的沙滩道具
function stripes(a, b, n = 8) {
  const t = canvasTexture(128, 32, (g, W, H) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.fillRect((i * W) / n, 0, W / n, H);
    }
  });
  return t;
}
const UMBRELLAS = [
  ["#ffffff", "#f07c8e"],
  ["#ffffff", "#5aa6dc"],
  ["#fff6d8", "#f2b544"],
  ["#ffffff", "#6cc2a4"],
];
function beachSet(k) {
  const g = new THREE.Group();
  const [a, b] = UMBRELLAS[k % UMBRELLAS.length];
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.45, 16, 1, true), new THREE.MeshStandardMaterial({ map: stripes(a, b, 16), side: THREE.DoubleSide, roughness: 0.8 }));
  canopy.position.y = 2.05;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), new THREE.MeshStandardMaterial({ color: "#f4f1ea" }));
  pole.position.y = 1.0;
  pole.rotation.z = 0.08;
  const towel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.02, 1.5), new THREE.MeshStandardMaterial({ map: stripes(b, a, 6), roughness: 1 }));
  towel.position.set(0.6, 0.02, 0.4);
  towel.rotation.y = 0.3;
  g.add(canopy, pole, towel);
  if (k % 3 === 0) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 12),
      new THREE.MeshStandardMaterial({ map: stripes("#ffffff", ["#f05a5a", "#4f9de0", "#f6c445"][k % 3], 6), roughness: 0.5 }),
    );
    ball.position.set(-0.7, 0.17, 0.8);
    g.add(ball);
  } else if (k % 3 === 1) {
    const sand = new THREE.MeshStandardMaterial({ color: "#ecd6a6", roughness: 1 });
    for (const [x, z, h, rr] of [
      [-0.9, 0.5, 0.3, 0.22],
      [-1.25, 0.5, 0.22, 0.15],
      [-0.9, 0.85, 0.2, 0.14],
    ]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.85, rr, h, 10), sand);
      t.position.set(x, h / 2, z);
      g.add(t);
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshStandardMaterial({ color: "#f05a5a", side: THREE.DoubleSide }));
    flag.position.set(-0.84, 0.46, 0.5);
    g.add(flag);
  } else {
    // 躺椅
    const wood = new THREE.MeshStandardMaterial({ color: "#d9b88f", roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 1.0), wood);
    seat.position.set(-0.8, 0.25, 0.2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.6), wood);
    back.position.set(-0.8, 0.45, 0.82);
    back.rotation.x = 0.8;
    g.add(seat, back);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return g;
}

export function createCritters(scene, world) {
  const r = rng(77);
  const group = new THREE.Group();
  scene.add(group);
  const dummy = new THREE.Object3D();

  // --- 海星、贝壳、珊瑚（不会动，用 InstancedMesh）
  const STAR_COLORS = ["#f28a5b", "#f6b04a", "#f27aa4", "#b98ce0", "#f2c94c"];
  const stars = new THREE.InstancedMesh(starGeo(), new THREE.MeshStandardMaterial({ roughness: 0.7 }), 16);
  const shells = new THREE.InstancedMesh(shellGeo(), new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide }), 14);
  const corals = new THREE.InstancedMesh(coralGeo(5), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 12);
  const col = new THREE.Color();
  const put = (mesh, i, x, y, z, s, ry = r() * TAU) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  for (let i = 0; i < stars.count; i++) {
    let a;
    do a = r() * TAU;
    while (nearPier(a));
    const [x, z] = ringPoint(a, i < 5 ? -0.6 - r() * 0.8 : 0.6 + r() * 4.5);
    put(stars, i, x, terrainHeight(x, z) + 0.03, z, 0.8 + r() * 0.7);
    stars.setColorAt(i, col.set(STAR_COLORS[i % STAR_COLORS.length]));
  }
  for (let i = 0; i < shells.count; i++) {
    let a;
    do a = r() * TAU;
    while (nearPier(a));
    const [x, z] = ringPoint(a, -0.4 - r() * 2.4);
    put(shells, i, x, terrainHeight(x, z) + 0.01, z, 0.8 + r() * 0.8);
    shells.setColorAt(i, col.set(["#ffffff", "#fbe0e6", "#f6e6cf", "#e8d8f2"][i % 4]));
  }
  const CORAL = ["#f27aa4", "#f6a06a", "#b98ce0", "#f2c94c", "#7fd1c4"];
  for (let i = 0; i < corals.count; i++) {
    let a;
    do a = r() * TAU;
    while (nearPier(a));
    const [x, z] = ringPoint(a, 2.5 + r() * 6);
    put(corals, i, x, terrainHeight(x, z) - 0.02, z, 0.9 + r() * 0.9);
    corals.setColorAt(i, col.set(CORAL[i % CORAL.length]));
  }
  for (const m of [stars, shells, corals]) {
    m.instanceColor.needsUpdate = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // --- 会动的：螃蟹、水母、章鱼、海龟、企鹅
  const movers = [];
  const add = (geo, s) => {
    const m = new THREE.Mesh(geo, critterMat);
    m.scale.setScalar(s);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const crabG = crabGeo();
  const crabs = [];
  for (let i = 0; i < 4; i++) {
    let a;
    do a = r() * TAU;
    while (nearPier(a));
    const m = add(crabG, 1.1 + r() * 0.4);
    crabs.push({ m, a, off: -0.9 + r() * 1.4, dir: r() < 0.5 ? -1 : 1, pause: r() * 3, phase: r() * 10 });
  }
  const JELLY = ["#f6b7d6", "#c9b4f2", "#a8d8f0", "#f9cfa8"];
  const jellies = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + r() * 0.3;
    const m = add(jellyGeo(JELLY[i % JELLY.length]), 0.8 + r() * 0.5);
    jellies.push({ m, a, off: 3.5 + r() * 7, phase: r() * 10, drift: (r() - 0.5) * 0.02 });
  }
  const octoG = octopusGeo();
  const octos = [40, 255].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const [x, z] = ringPoint(a, 2.2);
    const m = add(octoG, 1.1);
    m.position.set(x, -0.42, z);
    m.rotation.y = Math.atan2(-x, -z);
    return { m, phase: deg };
  });
  const turtleG = turtleGeo();
  const turtles = [0].map((k) => ({ m: add(turtleG, 1.2), a: k * 2.1, off: 7 + k * 1.5, speed: 0.025 + k * 0.006, phase: k * 3 }));
  const penguinG = penguinGeo();
  const penguins = [62, 72, 118, 200, 290, 300].map((deg, k) => {
    const a = (deg * Math.PI) / 180;
    return { m: add(penguinG, 0.95 + (k % 3) * 0.12), a, dir: k % 2 ? 1 : -1, pause: k, phase: k * 1.7, home: a };
  });

  // --- 猫：黑猫和橘猫，在岛上到处走
  const cats = [
    { ...makeCat("#2b2a30", "#3b3a42", "#e8d14f"), name: "Black cat" },
    { ...makeCat("#f0a050", "#fbe3c4", "#7cc46a"), name: "Ginger cat" },
  ].map((c, k) => {
    // 出生点：从这里往外找一个能站的地方
    let [x, z] = [k ? 6 : -9, k ? -9 : 12];
    for (let d = 0; d < 6 && !world.walkable(x, z, 0.4); d += 0.5) x += 0.5;
    c.root.position.set(x, terrainHeight(x, z), z);
    c.root.userData.kind = "cat";
    c.root.userData.cat = k;
    group.add(c.root);
    return { ...c, target: null, wait: 1 + k * 2, phase: 0, sit: 0, hop: 0 };
  });
  function newCatTarget(c) {
    const p = c.root.position;
    for (let tries = 0; tries < 20; tries++) {
      const a = r() * TAU;
      const d = 3 + r() * 7;
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      const R = islandRadius(Math.atan2(z, x));
      if (Math.hypot(x, z) < R - 6 && world.walkable(x, z, 0.3)) return { x, z };
    }
    return null;
  }

  // --- 夏天的沙滩道具
  const beach = new THREE.Group();
  let placed = 0;
  for (let k = 0; k < 40 && placed < 9; k++) {
    const a = (k / 40) * TAU * 3.7 + 0.2;
    if (nearPier(a)) continue;
    const [x, z] = ringPoint(a, -3.0);
    if (!world.free(x, z, 1.4)) continue;
    const set = beachSet(placed++);
    set.position.set(x, terrainHeight(x, z), z);
    set.rotation.y = Math.atan2(x, z) + Math.PI;
    beach.add(set);
  }
  group.add(beach);

  const tmp = new THREE.Vector3();
  function update(dt, t) {
    for (const c of crabs) {
      // 沿着岸边横着走，走一会儿停一会儿
      c.pause -= dt;
      if (c.pause < -3) {
        c.pause = 1 + r() * 2;
        if (r() < 0.5) c.dir *= -1;
      }
      if (c.pause < 0) c.a += (c.dir * 0.45 * dt) / islandRadius(c.a);
      if (nearPier(c.a)) {
        c.dir *= -1;
        c.a += c.dir * 0.03;
      }
      const [x, z] = ringPoint(c.a, c.off);
      c.m.position.set(x, Math.max(terrainHeight(x, z), -0.12) + (c.pause < 0 ? Math.abs(Math.sin(t * 18 + c.phase)) * 0.02 : 0), z);
      c.m.rotation.y = Math.atan2(x, z);
    }
    for (const j of jellies) {
      j.a += j.drift * dt;
      const [x, z] = ringPoint(j.a, j.off + Math.sin(t * 0.2 + j.phase) * 0.8);
      const pulse = Math.sin(t * 2.2 + j.phase);
      j.m.position.set(x, -0.42 + pulse * 0.06, z);
      j.m.scale.set(j.m.scale.x, j.m.scale.x * (1 + pulse * 0.08), j.m.scale.x);
    }
    for (const o of octos) {
      o.m.position.y = -0.42 + Math.sin(t * 1.3 + o.phase) * 0.05;
      o.m.rotation.z = Math.sin(t * 0.9 + o.phase) * 0.08;
    }
    for (const tu of turtles) {
      tu.a += tu.speed * dt;
      const [x, z] = ringPoint(tu.a, tu.off + Math.sin(t * 0.15 + tu.phase) * 1.5);
      tmp.set(x, -0.5 + Math.sin(t * 0.8 + tu.phase) * 0.05, z);
      tu.m.lookAt(tmp.x + (tmp.x - tu.m.position.x) * 50, tmp.y, tmp.z + (tmp.z - tu.m.position.z) * 50);
      tu.m.position.copy(tmp);
      tu.m.rotation.z += Math.sin(t * 2 + tu.phase) * 0.06;
    }
    if (penguins[0].m.visible) {
      for (const p of penguins) {
        p.pause -= dt;
        if (p.pause < -4) p.pause = 2 + (p.phase % 3), (p.dir *= -1);
        const walking = p.pause < 0;
        if (walking) p.a += (p.dir * 0.4 * dt) / islandRadius(p.a);
        if (Math.abs(p.a - p.home) > 0.25 || nearPier(p.a)) p.dir = p.a > p.home ? -1 : 1;
        const [x, z] = ringPoint(p.a, -2.2);
        p.m.position.set(x, terrainHeight(x, z), z);
        const face = Math.atan2(-Math.sin(p.a) * p.dir, Math.cos(p.a) * p.dir);
        p.m.rotation.set(0, walking ? face : face + 1.2, walking ? Math.sin(t * 9 + p.phase) * 0.14 : 0);
      }
    }
    for (const c of cats) {
      const p = c.root.position;
      c.hop = Math.max(0, c.hop - dt * 2.5);
      if (c.target) {
        tmp.set(c.target.x - p.x, 0, c.target.z - p.z);
        const d = tmp.length();
        const step = Math.min(1.3 * dt, d);
        const nx = p.x + (tmp.x / d) * step;
        const nz = p.z + (tmp.z / d) * step;
        if (d < 0.1 || !world.walkable(nx, nz, 0.3)) {
          c.target = null;
          c.wait = 2 + r() * 5;
        } else {
          p.x = nx;
          p.z = nz;
          c.root.rotation.y = Math.atan2(tmp.x, tmp.z);
          c.phase += dt * 10;
        }
        c.sit = Math.max(0, c.sit - dt * 3);
      } else {
        c.wait -= dt;
        c.sit = Math.min(1, c.sit + dt * 2);
        if (c.wait < 0) c.target = newCatTarget(c);
      }
      p.y = terrainHeight(p.x, p.z) + Math.sin(c.hop * Math.PI) * 0.35;
      const swing = c.target ? Math.sin(c.phase) * 0.6 : 0;
      c.legs.forEach((leg, i) => (leg.rotation.x = (i === 1 || i === 2 ? swing : -swing) - (i >= 2 ? c.sit * 1.2 : 0)));
      c.body.rotation.x = -c.sit * 0.35;
      c.body.position.y = -c.sit * 0.06;
    }
  }

  function setSeason(name) {
    for (const c of crabs) c.m.visible = name !== "winter";
    for (const p of penguins) p.m.visible = name === "winter";
    for (const tu of turtles) tu.m.visible = name !== "winter";
    beach.visible = name === "summer";
  }

  // 点到猫：跳一下
  function poke(k) {
    cats[k].hop = 1;
    return cats[k];
  }

  return { update, setSeason, poke, pickables: cats.map((c) => c.root) };
}
