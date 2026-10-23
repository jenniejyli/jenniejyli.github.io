import * as THREE from "three";
import { rng, mat, blob, mergeShaded, between, m4, clamp } from "./util.js";

// ===== 植物：树、灌木、花、草、落叶、蘑菇、石头 =====
// 每棵树都是"树干 + 树枝 + 小枝 + 十几团树叶"，树叶下暗上亮；冬天叶子没了，树枝上积雪。
// 季节：春天樱花，夏天绿树 + 沙滩椰树，秋天银杏 + 枫叶，冬天光秃秃的树 + 雪松。

const BARK = new THREE.Color("#6f5444");
const SNOW = "#f6f9fb";
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const LOOK = {
  spring: { green: ["#a9d08b", "#9cc884", "#b6d897"], cherry: ["#f6bfd0", "#fbd9e4", "#f2a8c0"], cherryShare: 0.55, bush: "#97c27f", tuft: "#94bb79", pine: "#5f8a68", flowers: 1, litter: false, mushrooms: true },
  summer: { green: ["#79ae67", "#88b973", "#6c9f5f"], cherryShare: 0, bush: "#7aaa68", tuft: "#7fa86b", pine: "#567f60", flowers: 1, litter: false, mushrooms: true, palms: true },
  autumn: { green: ["#f2c34f", "#e6773f", "#d9552f", "#f0a63b", "#e8b84a"], cherryShare: 0, bush: "#b9a660", tuft: "#c3a967", pine: "#5d7b5d", flowers: 0.35, litter: true, mushrooms: true },
  winter: { green: [], cherryShare: 0, bush: "#eef3f6", tuft: "#e4ecf0", pine: "#4f6f5c", flowers: 0, litter: false, mushrooms: false, bare: true },
};
const SPECIAL = {
  kapok: { spring: "#e9765f", summer: "#7cb46a", autumn: "#d9b45a" },
  blossom: { spring: "#f6bccd", summer: "#f3abc2", autumn: "#ea9c7c" },
};

const shadeBy = (y0, y1, lo = 0.56, hi = 1.0) => (x, y, z, nx, ny) => {
  const s = lo + (hi - lo) * clamp((y - y0) / (y1 - y0), 0, 1) + 0.08 * ny;
  return [s, s, s];
};
const barkShade = (h) => (x, y) => {
  const s = 0.72 + 0.28 * clamp(y / h, 0, 1);
  return [BARK.r * s, BARK.g * s, BARK.b * s];
};

function limb(a, b, r0, r1, seg = 6) {
  const { matrix, len } = between(a, b);
  return { geo: new THREE.CylinderGeometry(r1, r0, len, seg, 1), matrix };
}

// ---------- 树的样子（每种做几个变体，再用 InstancedMesh 摆很多棵）

function makeDeciduous(seed, detail) {
  const r = rng(seed);
  const wood = [];
  const leaves = [];
  const snow = [];
  const h = 1.4 + r() * 0.5;
  const top = v3(0, h, 0);
  wood.push({ ...limb(v3(0, -0.15, 0), top, 0.2, 0.12, 8), color: barkShade(h + 1) });
  const tips = [];
  const n = 4 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r() * 0.7;
    const y0 = h * (0.62 + r() * 0.35);
    const L = 0.8 + r() * 0.5;
    const tilt = 0.55 + r() * 0.35;
    const start = v3(0, y0, 0);
    const end = v3(Math.sin(tilt) * Math.cos(a) * L, y0 + Math.cos(tilt) * L, Math.sin(tilt) * Math.sin(a) * L);
    wood.push({ ...limb(start, end, 0.075, 0.035), color: barkShade(h + 1) });
    snow.push({ ...limb(start.clone().add(v3(0, 0.055, 0)), end.clone().add(v3(0, 0.045, 0)), 0.045, 0.022, 5), color: SNOW });
    for (let t = 0; t < 2; t++) {
      const mid = start.clone().lerp(end, 0.5 + t * 0.25);
      const tw = mid.clone().add(v3((r() - 0.5) * 0.5, 0.32 + r() * 0.3, (r() - 0.5) * 0.5));
      wood.push({ ...limb(mid, tw, 0.03, 0.012, 4), color: barkShade(h + 1) });
    }
    tips.push(end);
  }
  tips.push(top.clone().add(v3(0, 0.35, 0)));
  snow.push({ geo: blob(0.17, seed, { detail: 0 }), matrix: m4(0, h + 0.03, 0, 0, 0, 0, 1, 0.45, 1), color: SNOW });
  const cy = h + 0.55;
  const R = 1.35;
  const shade = shadeBy(cy - R, cy + R);
  let k = 0;
  for (const tip of tips) {
    for (let c = 0; c < 2; c++) {
      const rad = 0.42 + r() * 0.24;
      leaves.push({ geo: blob(rad, seed * 7 + k++, { detail }), matrix: m4(tip.x + (r() - 0.5) * 0.4, tip.y + 0.1 + (r() - 0.3) * 0.3, tip.z + (r() - 0.5) * 0.4), color: shade });
    }
  }
  for (let c = 0; c < 4; c++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.7;
    leaves.push({ geo: blob(0.5 + r() * 0.2, seed * 7 + k++, { detail }), matrix: m4(Math.cos(a) * d, cy + (r() - 0.2) * 0.5, Math.sin(a) * d), color: shade });
  }
  return { wood: mergeShaded(wood), leaves: mergeShaded(leaves), snow: mergeShaded(snow) };
}

function ruffle(geo, rad, seed, amt = 0.1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    if (Math.hypot(x, z) < rad * 0.3) continue;
    const a = Math.atan2(z, x);
    const w = Math.sin(a * 5 + seed);
    p.setXYZ(i, x * (1 + amt * w), p.getY(i) - amt * 0.6 * Math.abs(w), z * (1 + amt * w));
  }
  geo.computeVertexNormals();
  return geo;
}

function makePine(seed) {
  const r = rng(seed);
  const wood = [{ ...limb(v3(0, -0.15, 0), v3(0, 1.1, 0), 0.17, 0.1, 7), color: barkShade(1.2) }];
  const leaves = [];
  const snow = [];
  for (let t = 0; t < 4; t++) {
    const rad = 1.25 - t * 0.27 + (r() - 0.5) * 0.1;
    const hgt = 1.15 - t * 0.08;
    const y = 0.75 + t * 0.72;
    leaves.push({ geo: ruffle(new THREE.ConeGeometry(rad, hgt, 12, 3), rad, seed + t), matrix: m4(0, y + hgt / 2, 0, 0, r() * 6, 0), color: shadeBy(y, y + hgt, 0.5, 1.0) });
    snow.push({ geo: ruffle(new THREE.ConeGeometry(rad * 0.92, hgt * 0.68, 12, 2), rad * 0.92, seed + t + 50, 0.07), matrix: m4(0, y + hgt * 0.64 + 0.04, 0), color: SNOW });
  }
  return { wood: mergeShaded(wood), leaves: mergeShaded(leaves), snow: mergeShaded(snow) };
}

function frond(L, W, droop) {
  const pos = [];
  const idx = [];
  const segs = 8;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const x = t * L;
    const y = 0.3 * t - droop * t * t;
    const w = W * Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.95));
    const f = 0.18 * w;
    pos.push(x, y, 0, x, y - f, -w / 2, x, y - f, w / 2);
  }
  for (let s = 0; s < segs; s++) {
    const a = s * 3;
    const b = a + 3;
    idx.push(a, a + 1, b, a + 1, b + 1, b, a, b, a + 2, a + 2, b, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makePalm(seed) {
  const r = rng(seed);
  const wood = [];
  const leaves = [];
  let p = v3(0, -0.1, 0);
  const lean = r() * Math.PI * 2;
  for (let k = 0; k < 7; k++) {
    const q = p.clone().add(v3(Math.cos(lean) * (0.04 + k * 0.025), 0.55, Math.sin(lean) * (0.04 + k * 0.025)));
    wood.push({ ...limb(p, q, 0.17 - k * 0.008, 0.15 - k * 0.008, 8), color: k % 2 ? "#b08a66" : "#9c7a59" });
    p = q;
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r() * 0.3;
    const g = frond(1.7 + r() * 0.4, 0.5, 0.9 + r() * 0.4);
    leaves.push({ geo: g, matrix: m4(p.x, p.y, p.z, 0, -a, -0.15 + r() * 0.2), color: (x, y, z, nx, ny) => (k % 2 ? [0.5, 0.74, 0.45] : [0.45, 0.68, 0.42]).map((c) => c * (0.85 + 0.15 * Math.abs(ny))) });
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    wood.push({ geo: new THREE.SphereGeometry(0.12, 10, 8), matrix: m4(p.x + Math.cos(a) * 0.14, p.y - 0.12, p.z + Math.sin(a) * 0.14), color: "#7b5a3d" });
  }
  return { wood: mergeShaded(wood), leaves: mergeShaded(leaves) };
}

function makeBush(seed, detail) {
  const r = rng(seed);
  const parts = [];
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2;
    const d = k === 0 ? 0 : 0.35 + r() * 0.3;
    const rad = k === 0 ? 0.55 : 0.32 + r() * 0.22;
    parts.push({ geo: blob(rad, seed + k, { detail }), matrix: m4(Math.cos(a) * d, rad * 0.75, Math.sin(a) * d), color: shadeBy(0, 1.0, 0.6, 1.0) });
  }
  return mergeShaded(parts);
}

// ---------- 花：四种花头 + 共用的绿茎

const FLOWER_TYPES = {
  daisy: { stem: 0.26, colors: ["#ffffff", "#fff4d6", "#ffe0ea"] },
  tulip: { stem: 0.3, colors: ["#f06e6e", "#f7a8c0", "#ffd36a", "#ff9a6b", "#ffffff"] },
  lavender: { stem: 0.3, colors: ["#a990da", "#8f86d6", "#c6a8e6"] },
  puff: { stem: 0.36, colors: ["#f6a5c0", "#ffd6e3", "#fff1a8", "#cdb8f2", "#ffffff"] },
};

function flowerHead(type) {
  const parts = [];
  if (type === "daisy") {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      parts.push({ geo: new THREE.SphereGeometry(0.05, 8, 6), matrix: m4(Math.cos(a) * 0.065, 0, Math.sin(a) * 0.065, 0, -a, 0, 1, 0.3, 0.5), color: "#ffffff" });
    }
    parts.push({ geo: new THREE.SphereGeometry(0.035, 8, 6), matrix: m4(0, 0.015, 0, 0, 0, 0, 1, 0.6, 1), color: "#f2c230" });
  } else if (type === "tulip") {
    const pts = [v3(0, 0, 0), v3(0.05, 0.015, 0), v3(0.075, 0.07, 0), v3(0.07, 0.13, 0), v3(0.045, 0.16, 0)].map((p) => new THREE.Vector2(p.x, p.y));
    parts.push({ geo: new THREE.LatheGeometry(pts, 10), matrix: m4(0, -0.02, 0), color: "#ffffff" });
  } else if (type === "lavender") {
    for (let k = 0; k < 8; k++) parts.push({ geo: new THREE.SphereGeometry(0.03 - k * 0.002, 6, 5), matrix: m4(0, k * 0.032, 0), color: "#ffffff" });
  } else {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      parts.push({ geo: new THREE.SphereGeometry(0.045, 8, 6), matrix: m4(Math.cos(a) * 0.04, 0.02 + (k % 2) * 0.02, Math.sin(a) * 0.04), color: "#ffffff" });
    }
    parts.push({ geo: new THREE.SphereGeometry(0.05, 8, 6), matrix: m4(0, 0.05, 0), color: "#ffffff" });
  }
  return mergeShaded(parts);
}

// ===== 摆放 =====
// trees: [{ x, z, s, kind: "normal" | "kapok" | "blossom", place: "inland" | "beach" | "pine" }]

export function createNature(scene, { terrainHeight, islandRadius, free, colliders, specials, flowerSpots = [], lowPower = false }) {
  const r = rng(7);
  const detail = lowPower ? 0 : 1;
  const dummy = new THREE.Object3D();
  const place = (mesh, i, x, y, z, sx, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  const meshes = [];
  const instanced = (geo, material, count, { shadow = true } = {}) => {
    const m = new THREE.InstancedMesh(geo, material, Math.max(count, 1));
    m.count = count;
    m.castShadow = shadow;
    m.receiveShadow = true;
    meshes.push(m);
    scene.add(m);
    return m;
  };

  // --- 树位
  const trees = [];
  for (const s of specials) {
    const kind = s.type === "kapok" || s.type === "blossom" ? s.type : "normal";
    trees.push({ x: s.x, z: s.z, s: s.s ?? 1, kind, place: s.type === "palm" ? "beach" : "inland" });
    colliders.push({ x: s.x, z: s.z, r: 0.45 });
  }
  for (let tries = 0; tries < 2000 && trees.length < 125; tries++) {
    const a = r() * Math.PI * 2;
    const rad = 16 + r() * 14;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (rad > islandRadius(a) - 7.2 || !free(x, z, 1.5)) continue;
    const s = 0.8 + r() * 0.5;
    trees.push({ x, z, s, kind: "normal", place: r() < 0.16 ? "pine" : "inland" });
    colliders.push({ x, z, r: 0.42 * s });
  }
  for (let tries = 0; tries < 700 && trees.filter((t) => t.place === "beach").length < 22; tries++) {
    const a = r() * Math.PI * 2;
    const rad = islandRadius(a) - 4.6 + r() * 2.8;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if ((Math.abs(x) < 6 && z > 18) || !free(x, z, 1.2)) continue;
    trees.push({ x, z, s: 0.85 + r() * 0.3, kind: "normal", place: "beach" });
    colliders.push({ x, z, r: 0.35 });
  }
  for (const t of trees) {
    t.y = terrainHeight(t.x, t.z) - 0.05;
    t.ry = r() * Math.PI * 2;
    t.rand = r();
  }

  // --- 落叶树（每个变体一组：树干、树叶、积雪）；内陆的排在前面，夏天只画内陆的
  const DECID_VARIANTS = 4;
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const snowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const decid = trees.filter((t) => t.place !== "pine");
  decid.sort((a, b) => (a.place === "beach") - (b.place === "beach"));
  const decidGroups = [];
  for (let v = 0; v < DECID_VARIANTS; v++) {
    const list = decid.filter((_, i) => i % DECID_VARIANTS === v);
    const geo = makeDeciduous(100 + v * 17, detail);
    const g = {
      list,
      inland: list.filter((t) => t.place === "inland").length,
      wood: instanced(geo.wood, woodMat, list.length),
      leaves: instanced(geo.leaves, leafMat, list.length),
      snow: instanced(geo.snow, snowMat, list.length, { shadow: false }),
    };
    list.forEach((t, i) => {
      for (const m of [g.wood, g.leaves, g.snow]) place(m, i, t.x, t.y, t.z, t.s, t.s, t.s, t.ry);
    });
    g.leaves.setColorAt(0, new THREE.Color());
    decidGroups.push(g);
  }

  // --- 松树
  const pineList = trees.filter((t) => t.place === "pine");
  const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, color: "#5f8a68" });
  const pineGroups = [];
  for (let v = 0; v < 2; v++) {
    const list = pineList.filter((_, i) => i % 2 === v);
    const geo = makePine(300 + v * 23);
    const g = { wood: instanced(geo.wood, woodMat, list.length), leaves: instanced(geo.leaves, pineMat, list.length), snow: instanced(geo.snow, snowMat, list.length, { shadow: false }) };
    list.forEach((t, i) => {
      for (const m of [g.wood, g.leaves, g.snow]) place(m, i, t.x, t.y, t.z, t.s, t.s * 1.1, t.s, t.ry);
    });
    pineGroups.push(g);
  }

  // --- 椰子树（夏天的沙滩）
  const palmList = trees.filter((t) => t.place === "beach");
  const palmLeafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const palmGroups = [];
  for (let v = 0; v < 2; v++) {
    const list = palmList.filter((_, i) => i % 2 === v);
    const geo = makePalm(500 + v * 31);
    const g = { wood: instanced(geo.wood, woodMat, list.length), leaves: instanced(geo.leaves, palmLeafMat, list.length) };
    list.forEach((t, i) => {
      for (const m of [g.wood, g.leaves]) place(m, i, t.x, t.y, t.z, t.s, t.s, t.s, t.ry);
    });
    palmGroups.push(g);
  }

  // --- 灌木
  const bushSpots = [];
  for (let tries = 0; tries < 1600 && bushSpots.length < 130; tries++) {
    const a = r() * Math.PI * 2;
    const rad = 5 + Math.sqrt(r()) * 25;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (rad > islandRadius(a) - 6.6 || !free(x, z, 0.5)) continue;
    bushSpots.push([x, z, 0.45 + r() * 0.45]);
  }
  const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, color: "#97c27f" });
  const bushGroups = [];
  for (let v = 0; v < 3; v++) {
    const list = bushSpots.filter((_, i) => i % 3 === v);
    const m = instanced(makeBush(700 + v * 13, detail), bushMat, list.length);
    list.forEach(([x, z, s], i) => place(m, i, x, terrainHeight(x, z) - 0.05, z, s, s * 0.85, s, r() * 6));
    bushGroups.push(m);
  }

  // --- 草丛
  const blades = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    blades.push({ geo: new THREE.ConeGeometry(0.028, 0.32 + (k % 2) * 0.08, 3), matrix: m4(Math.cos(a) * 0.04, 0.16, Math.sin(a) * 0.04, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35), color: shadeBy(0, 0.35, 0.65, 1.0) });
  }
  const tuftMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, color: "#94bb79" });
  const tuftSpots = [];
  for (let tries = 0; tries < 5000 && tuftSpots.length < (lowPower ? 900 : 1800); tries++) {
    const x = (r() - 0.5) * 66;
    const z = (r() - 0.5) * 66;
    if (terrainHeight(x, z) < 0.62 || !free(x, z, 0.05)) continue;
    tuftSpots.push([x, z, 0.7 + r() * 0.7]);
  }
  const tufts = instanced(mergeShaded(blades), tuftMat, tuftSpots.length, { shadow: false });
  tuftSpots.forEach(([x, z, s], i) => place(tufts, i, x, terrainHeight(x, z) - 0.02, z, s, s, s, r() * 6));

  // --- 花：花坛（外面传进来的） + 草地上一丛一丛的
  const spots = [...flowerSpots];
  const types = Object.keys(FLOWER_TYPES);
  for (let c = 0; c < 55; c++) {
    const a = r() * Math.PI * 2;
    const rad = 6 + Math.sqrt(r()) * 23;
    const cx = Math.cos(a) * rad;
    const cz = Math.sin(a) * rad;
    if (rad > islandRadius(a) - 7) continue;
    const type = types[Math.floor(r() * types.length)];
    const color = Math.floor(r() * 10);
    for (let k = 0; k < 16; k++) {
      const x = cx + (r() - 0.5) * 3.2;
      const z = cz + (r() - 0.5) * 3.2;
      if (free(x, z, 0.12)) spots.push([x, z, type, color]);
    }
  }
  for (let k = spots.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [spots[k], spots[j]] = [spots[j], spots[k]];
  }
  const stemMat = mat("#6f9b5a", { roughness: 0.9 });
  const stems = instanced(new THREE.CylinderGeometry(0.012, 0.016, 1, 4).translate(0, 0.5, 0), stemMat, spots.length, { shadow: false });
  const headMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const heads = {};
  const headCount = {};
  for (const t of types) {
    headCount[t] = spots.filter((s) => s[2] === t).length;
    heads[t] = instanced(flowerHead(t), headMat, headCount[t], { shadow: false });
    heads[t].count = 0;
  }
  const col = new THREE.Color();
  spots.forEach(([x, z, type, ci], i) => {
    const y = terrainHeight(x, z) - 0.02;
    const T = FLOWER_TYPES[type];
    const hgt = T.stem * (0.8 + r() * 0.5);
    place(stems, i, x, y, z, 1, hgt, 1);
    const m = heads[type];
    const j = m.count++;
    place(m, j, x, y + hgt, z, 0.9 + r() * 0.4, 0.9 + r() * 0.4, 0.9 + r() * 0.4, r() * 6, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3);
    m.setColorAt(j, col.set(T.colors[ci % T.colors.length]));
  });
  // 只显示前 n 朵花时，每种花头要显示几个（和花茎一一对应）
  const headsWithin = (n) => {
    const out = Object.fromEntries(types.map((t) => [t, 0]));
    for (let i = 0; i < n; i++) out[spots[i][2]]++;
    return out;
  };

  // --- 秋天的落叶
  const litterSpots = [];
  for (const t of trees) {
    if (t.place === "pine") continue;
    for (let k = 0; k < 7; k++) litterSpots.push([t.x + (r() - 0.5) * 3, t.z + (r() - 0.5) * 3]);
  }
  const litter = instanced(new THREE.CircleGeometry(0.09, 5).rotateX(-Math.PI / 2), mat("#ffffff", { roughness: 1 }), litterSpots.length, { shadow: false });
  const litterColors = ["#e8a03a", "#d9552f", "#f2c34f", "#c96a35"].map((c) => new THREE.Color(c));
  litterSpots.forEach(([x, z], i) => {
    place(litter, i, x, terrainHeight(x, z) + 0.03, z, 0.8 + r() * 0.8, 1, 0.8 + r() * 0.8, r() * 6);
    litter.setColorAt(i, litterColors[i % litterColors.length]);
  });

  // --- 小蘑菇
  const mushParts = [
    { geo: new THREE.CylinderGeometry(0.035, 0.045, 0.12, 8), matrix: m4(0, 0.06, 0), color: "#f6efe2" },
    { geo: new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), matrix: m4(0, 0.11, 0, 0, 0, 0, 1, 0.7, 1), color: "#e0574a" },
  ];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    mushParts.push({ geo: new THREE.SphereGeometry(0.014, 6, 4), matrix: m4(Math.cos(a) * 0.05, 0.165, Math.sin(a) * 0.05), color: "#ffffff" });
  }
  const mushSpots = trees.filter((t) => t.place === "inland").slice(0, 30);
  const mushrooms = instanced(mergeShaded(mushParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), mushSpots.length, { shadow: false });
  mushSpots.forEach((t, i) => {
    const a = r() * 6;
    const x = t.x + Math.cos(a) * 0.7;
    const z = t.z + Math.sin(a) * 0.7;
    place(mushrooms, i, x, terrainHeight(x, z), z, 0.8 + r() * 0.6);
  });

  // --- 石头（顶上一点青苔）
  const rockSpots = [];
  for (let k = 0; k < 70; k++) {
    const a = r() * Math.PI * 2;
    const rad = islandRadius(a) - 1 + r() * 6;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (Math.abs(x) < 4.5 && z > 22) continue;
    rockSpots.push([x, z, 0.25 + r() * 0.5]);
  }
  for (let tries = 0; tries < 300 && rockSpots.length < 100; tries++) {
    const a = r() * Math.PI * 2;
    const rad = 6 + r() * 24;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (rad > islandRadius(a) - 7 || !free(x, z, 0.4)) continue;
    rockSpots.push([x, z, 0.18 + r() * 0.25]);
  }
  const rockGeo = mergeShaded([
    {
      geo: blob(1, 3, { detail: 1, lump: 0.22, smooth: false }),
      color: (x, y, z, nx, ny) => (ny > 0.55 ? [0.62, 0.72, 0.52] : [0.8, 0.78, 0.74].map((c) => c * (0.85 + 0.15 * ny))),
    },
  ]);
  const rocks = instanced(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), rockSpots.length);
  rockSpots.forEach(([x, z, s], i) => place(rocks, i, x, terrainHeight(x, z) + s * 0.15, z, s, s * 0.6, s, r() * 6));

  for (const m of meshes) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  // ===== 换季 =====
  function setSeason(name) {
    const L = LOOK[name];
    const tmp = new THREE.Color();
    for (const g of decidGroups) {
      g.list.forEach((t, i) => {
        let c;
        if (t.kind !== "normal") c = SPECIAL[t.kind][name] || "#ffffff";
        else if (L.cherryShare && t.rand < L.cherryShare) c = L.cherry[Math.floor(t.rand * 97) % L.cherry.length];
        else if (L.green.length) c = L.green[Math.floor(t.rand * 89) % L.green.length];
        else c = "#ffffff";
        g.leaves.setColorAt(i, tmp.set(c).multiplyScalar(0.92 + (t.rand * 13) % 0.16));
      });
      g.leaves.instanceColor.needsUpdate = true;
      const n = L.palms ? g.inland : g.list.length;
      g.wood.count = g.snow.count = n;
      g.leaves.count = L.bare ? 0 : n;
      g.snow.visible = !!L.bare;
    }
    for (const g of pineGroups) g.snow.visible = !!L.bare;
    pineMat.color.set(L.pine);
    for (const g of palmGroups) g.wood.visible = g.leaves.visible = !!L.palms;
    bushMat.color.set(L.bush);
    tuftMat.color.set(L.tuft);
    stems.count = Math.round(spots.length * L.flowers);
    const shown = headsWithin(stems.count);
    for (const t of types) heads[t].count = shown[t];
    litter.visible = L.litter;
    mushrooms.visible = L.mushrooms;
  }

  return { setSeason };
}
