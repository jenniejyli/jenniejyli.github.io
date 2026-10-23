import * as THREE from "three";
import { terrainHeight, POND } from "./world.js";
import { mat, glowsAtNight, textPlane, canvasTexture, pathTexture, shadowed, blob, rng, dotTexture } from "./util.js";
import { bonsai, monstera, succulent, cactus, fern, lemonTree, flowerPot, hangingPlant, hydrangea, sunflower } from "./plants.js";

// ===== 小岛中间的广场 =====
// 玻璃花房（送花排行）、喷泉（果冻水 + 水花）、咖啡店、抽签小摊、池塘和小木桥、可以坐的长椅，
// 还有小树林里的许愿池。

const WOOD = mat("#a87a55");
const WOOD_DARK = mat("#7c5a40");
const STONE = mat("#efebe3", { roughness: 0.9 });
const FRAME = mat("#2f3d37", { roughness: 0.45, metalness: 0.25 });
export const WELL = { x: 11.2, z: 16.0 };

// ---------- 咖啡店、抽签小摊、许愿池的配色跟着季节变：春天浅浅的粉蓝，夏天白 + 蓝，秋冬深一点
const SHOP_COLORS = {
  spring: { wall: "#cfe6f3", trim: "#ffffff", roof: "#f3b8c5", door: "#f2b2bd", awnA: "#ffffff", awnB: "#8dbfe6", stall: "#f5b5c6", wellRoof: "#9fcfe9", wood: "#cfa987", woodDark: "#a88568" },
  summer: { wall: "#f8f5ef", trim: "#ffffff", roof: "#e2805a", door: "#2f63a8", awnA: "#ffffff", awnB: "#3f86cf", stall: "#3f8fd6", wellRoof: "#e2805a", wood: "#b88a62", woodDark: "#8a6648" },
  autumn: { wall: "#ecd2a6", trim: "#fbf3e3", roof: "#8e4a31", door: "#6b3a2a", awnA: "#f5e6c8", awnB: "#c4623a", stall: "#b6452f", wellRoof: "#8e4a31", wood: "#9c7050", woodDark: "#6f4f38" },
  winter: { wall: "#9a4a40", trim: "#f6f1e8", roof: "#43515a", door: "#2f4c3d", awnA: "#f6f1e8", awnB: "#2f5c47", stall: "#7d2e29", wellRoof: "#3f5a4b", wood: "#83603f", woodDark: "#5e4330" },
};
const SHOP = Object.fromEntries(["wall", "trim", "roof", "door", "awnA", "awnB", "stall", "wellRoof"].map((k) => [k, mat("#ffffff")]));
const awningTex = canvasTexture(256, 64, () => {});
function paintAwning(a, b) {
  const c = awningTex.image.getContext("2d");
  for (let i = 0; i < 8; i++) {
    c.fillStyle = i % 2 ? a : b;
    c.fillRect(i * 32, 0, 32, 64);
  }
  awningTex.needsUpdate = true;
}

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
    new THREE.MeshStandardMaterial({ color: "#dff2ee", transparent: true, opacity, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, emissive: "#ffd79a", emissiveIntensity: 0 }),
    0.55,
  );
}

function lanternLight(parent, x, y, z, color = "#fff1cf") {
  const m = glowsAtNight(new THREE.MeshStandardMaterial({ color, emissive: "#ffcf7a", emissiveIntensity: 0, roughness: 0.4 }), 2.2);
  return part(parent, new THREE.SphereGeometry(0.13, 12, 10), m, x, y, z);
}

// ---------- 果冻水（喷泉、池塘、许愿池共用）：会一圈圈荡开、轻轻晃
const jellyUniforms = { uTime: { value: 0 }, uFrozen: { value: 0 }, uNight: { value: 0 } };
const JELLY_VERT = /* glsl */ `
uniform float uTime;
uniform float uFrozen;
uniform float uR;
varying vec2 vP;
varying float vWave;
void main() {
  vec3 p = position;
  float r = length(p.xy) / uR;
  float w = sin(r * 14.0 - uTime * 3.2) * (1.0 - r) * 0.025 + sin(uTime * 2.1) * 0.008;
  w *= 1.0 - uFrozen;
  p.z += w;
  vWave = w;
  vP = p.xy / uR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const JELLY_FRAG = /* glsl */ `
uniform float uTime;
uniform float uFrozen;
uniform vec3 uColor;
uniform vec3 uDeep;
uniform float uNight;
varying vec2 vP;
varying float vWave;
void main() {
  float r = length(vP);
  vec3 col = mix(uDeep, uColor, smoothstep(0.0, 1.0, r));
  col += smoothstep(0.8, 1.0, sin(r * 22.0 - uTime * 4.0) * 0.5 + 0.5) * 0.12 * (1.0 - uFrozen);
  col += vWave * 3.0;
  col += smoothstep(0.86, 1.0, r) * 0.18;
  vec2 hp = vP - vec2(-0.32, 0.28);
  col += (1.0 - smoothstep(0.0, 0.22, length(hp * vec2(1.0, 1.8)))) * 0.35;
  col = mix(col, vec3(0.9, 0.95, 0.98), uFrozen * 0.85);
  col *= mix(vec3(1.0), vec3(0.32, 0.4, 0.62), uNight);
  gl_FragColor = vec4(col, mix(0.82, 0.96, uFrozen));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function jellyWater(radius, color = "#7fe0dc", deep = "#2a9fb8") {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.001, radius, 48, 10),
    new THREE.ShaderMaterial({
      uniforms: { ...jellyUniforms, uR: { value: radius }, uColor: { value: new THREE.Color(color) }, uDeep: { value: new THREE.Color(deep) } },
      vertexShader: JELLY_VERT,
      fragmentShader: JELLY_FRAG,
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
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
  // 里面：中间桌上一盆盆景，四周一圈多肉；靠墙是大盆栽和两层花架，顶上挂着吊兰
  part(g, new THREE.CylinderGeometry(0.75, 0.75, 0.08, 20), WOOD, 0, 1.0);
  part(g, new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8), WOOD, 0, 0.7);
  const at = (obj, a, d, y, s = 1) => {
    obj.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    obj.rotation.y = -a + Math.PI / 2;
    obj.scale.setScalar(s);
    g.add(obj);
    return obj;
  };
  at(bonsai(2), Math.PI / 2, 0, 1.04, 1.1).rotation.y = 0.3;
  ["#8fbf9a", "#a9c6a0", "#b9a6c9", "#9cc4b4"].forEach((c, k) => at(succulent(c, k), (k / 4) * Math.PI * 2 + 0.4, 0.55, 1.04, 0.9));
  const floor = [
    [150, monstera(1), 1.1],
    [195, fern(1), 1.2],
    [340, lemonTree(2), 1.1],
    [25, fern(3), 1.1],
    [130, cactus(), 1.4],
    [50, monstera(4), 0.95],
  ];
  for (const [deg, obj, sc] of floor) at(obj, (deg * Math.PI) / 180, 2.3, 0.4, sc);
  // 后面的两层木花架
  for (const [y, d] of [
    [0.62, 2.55],
    [1.05, 2.45],
  ]) {
    // 弧形木板：RingGeometry 的角度转到地面上是 -a，所以 55°~125° 正好是花房后面
    part(g, new THREE.RingGeometry(d - 0.2, d + 0.2, 20, 1, (55 * Math.PI) / 180, (70 * Math.PI) / 180), WOOD, 0, y, 0, -Math.PI / 2);
  }
  for (const deg of [235, 270, 305]) {
    const a = (deg * Math.PI) / 180;
    box(g, 0.06, 1.1, 0.06, WOOD_DARK, Math.cos(a) * 2.65, 0.55, Math.sin(a) * 2.65);
  }
  const shelf = [
    ["#f7b6c8", "#ffffff"],
    ["#ffd66e", "#ff9f8a"],
    ["#c9b6f2", "#ffffff"],
  ];
  for (let k = 0; k < 6; k++) {
    const a = ((236 + k * 14) * Math.PI) / 180;
    at(k % 2 ? succulent(["#8fbf9a", "#b9a6c9", "#9cc4b4"][k % 3], k) : flowerPot(shelf[k % 3], k), a, 2.55, 0.645, 0.9);
    const b = ((240 + k * 12) * Math.PI) / 180;
    at(k % 2 ? flowerPot(shelf[(k + 1) % 3], k + 1) : succulent("#a9c6a0", k + 1), b, 2.42, 1.075, 0.8);
  }
  for (const deg of [45, 135, 225, 315]) {
    const a = (deg * Math.PI) / 180;
    const h = hangingPlant(deg);
    h.position.set(Math.cos(a) * 1.9, 2.12, Math.sin(a) * 1.9);
    g.add(h);
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

// ---------- 喷泉：果冻水池 + 顶上往上喷的水柱 + 上层碗溢出来的水帘 + 池边六道弧形水线
const FLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FLOW_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDir;
uniform float uNight;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float wob = sin(vUv.x * 50.0 + uTime * 2.0) * 0.04;
  float s = fract(vUv.y * 3.0 + uTime * 1.4 * uDir + wob);
  float streak = smoothstep(0.0, 0.35, s) * (1.0 - smoothstep(0.55, 1.0, s));
  float lines = 0.5 + 0.5 * sin(vUv.x * 90.0 + vUv.y * 6.0);
  vec3 col = mix(uColor, vec3(1.0), streak * 0.5 + lines * 0.15);
  col *= mix(vec3(1.0), vec3(0.4, 0.48, 0.7), uNight);
  gl_FragColor = vec4(col, 0.45 + streak * 0.35);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function flowingWater(geo, dir) {
  const m = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { uTime: jellyUniforms.uTime, uNight: jellyUniforms.uNight, uDir: { value: dir }, uColor: { value: new THREE.Color("#9eeef0") } },
      vertexShader: FLOW_VERT,
      fragmentShader: FLOW_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  m.castShadow = false;
  return m;
}

function fountain() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(1.35, 1.45, 0.45, 36), STONE, 0, 0.22);
  part(g, new THREE.TorusGeometry(1.33, 0.07, 8, 48), STONE, 0, 0.46, 0, Math.PI / 2);
  const pool = jellyWater(1.28);
  pool.position.y = 0.43;
  g.add(pool);
  part(g, new THREE.CylinderGeometry(0.16, 0.26, 0.95, 16), STONE, 0, 0.85);
  part(g, new THREE.CylinderGeometry(0.62, 0.3, 0.22, 24), STONE, 0, 1.32);
  const bowl = jellyWater(0.56);
  bowl.position.y = 1.44;
  g.add(bowl);
  part(g, new THREE.CylinderGeometry(0.08, 0.12, 0.4, 12), STONE, 0, 1.6);
  part(g, new THREE.SphereGeometry(0.11, 12, 10), STONE, 0, 1.84);
  // 水帘：从上层碗边一圈流下来
  const curtain = flowingWater(new THREE.CylinderGeometry(0.64, 0.82, 1.0, 40, 1, true), 1);
  curtain.position.y = 0.93;
  g.add(curtain);
  // 顶上的水柱
  const jet = flowingWater(new THREE.CylinderGeometry(0.03, 0.06, 0.55, 12, 1, true), -1);
  jet.position.y = 2.2;
  g.add(jet);

  // 水珠：顶上喷出来落回碗里；池边六个小喷口往中间画弧线
  const TOP = 110;
  const ARCS = 6;
  const PER = 26;
  const N = TOP + ARCS * PER;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const r = rng(12);
  const respawn = (i) => {
    if (i < TOP) {
      const a = r() * Math.PI * 2;
      const sp = 0.3 + r() * 0.25;
      pos.set([0, 2.45, 0], i * 3);
      vel.set([Math.cos(a) * sp, 0.9 + r() * 0.5, Math.sin(a) * sp], i * 3);
    } else {
      const a = (Math.floor((i - TOP) / PER) / ARCS) * Math.PI * 2 + 0.26;
      pos.set([Math.cos(a) * 1.22, 0.5, Math.sin(a) * 1.22], i * 3);
      const sp = -(0.78 + r() * 0.05);
      vel.set([Math.cos(a) * sp, 2.1 + r() * 0.1, Math.sin(a) * sp], i * 3);
    }
    life[i] = 0;
  };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  for (let i = 0; i < N; i++) {
    respawn(i);
    // 一开始就让水珠散在路上，不会一起出发
    const pre = r() * 1.0;
    life[i] = pre;
    pos[i * 3] += vel[i * 3] * pre;
    pos[i * 3 + 1] += vel[i * 3 + 1] * pre - 2.1 * pre * pre;
    pos[i * 3 + 2] += vel[i * 3 + 2] * pre;
    vel[i * 3 + 1] -= 4.2 * pre;
  }
  const spray = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: "#e6fdff", map: dotTexture(false), size: 0.13, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  spray.frustumCulled = false;
  g.add(spray);
  function update(dt) {
    for (let i = 0; i < N; i++) {
      vel[i * 3 + 1] -= 4.2 * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      life[i] += dt;
      const inBowl = Math.hypot(pos[i * 3], pos[i * 3 + 2]) < 0.56 && pos[i * 3 + 1] > 1.3;
      if (pos[i * 3 + 1] < (inBowl ? 1.44 : 0.43) || life[i] > 2.5) respawn(i);
    }
    geo.attributes.position.needsUpdate = true;
  }
  const flowing = [curtain, jet, spray];
  return { group: g, spray, flowing, update };
}

// ---------- 咖啡店
function cafe() {
  const g = new THREE.Group();
  const trim = SHOP.trim;
  part(g, new THREE.BoxGeometry(3.0, 4.1, 2.4), SHOP.wall, 0, 2.05, 0);
  box(g, 3.12, 0.16, 2.52, trim, 0, 2.2, 0);
  box(g, 3.2, 0.2, 2.6, SHOP.roof, 0, 4.2, 0);
  box(g, 3.02, 1.95, 0.08, WOOD_DARK, 0, 0.98, 1.2);
  const shopGlass = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#bcd6de", emissive: "#ffcf86", emissiveIntensity: 0, roughness: 0.15 }), 1.6);
  box(g, 1.55, 1.05, 0.04, shopGlass, -0.55, 1.15, 1.25);
  box(g, 0.62, 1.55, 0.05, SHOP.door, 0.95, 0.8, 1.26);
  part(g, new THREE.SphereGeometry(0.035, 8, 6), mat("#e8c46a", { metalness: 0.5, roughness: 0.3 }), 0.75, 0.85, 1.3);
  for (const x of [-0.75, 0.75]) {
    box(g, 0.7, 0.9, 0.05, shopGlass, x, 3.05, 1.22);
    box(g, 0.82, 0.08, 0.1, trim, x, 2.58, 1.25);
    box(g, 0.78, 0.18, 0.22, WOOD, x, 2.5, 1.32);
    for (let k = 0; k < 3; k++) part(g, blob(0.1, k), mat(["#f6a5c0", "#ffffff", "#ffd66e"][k], { roughness: 0.7 }), x - 0.22 + k * 0.22, 2.66, 1.33);
  }
  box(g, 3.25, 0.06, 1.0, new THREE.MeshStandardMaterial({ map: awningTex, roughness: 0.8 }), 0, 2.02, 1.68, 0.38);
  for (let k = 0; k < 8; k++) part(g, new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), k % 2 ? SHOP.awnA : SHOP.awnB, -1.42 + k * 0.405, 1.84, 2.14);
  const sign = textPlane("ISLAND CAFÉ", { width: 2.2, color: "#5c4033", bg: "rgba(251,247,239,0.97)", font: "700 96px" });
  sign.position.set(0, 3.75, 1.23);
  g.add(sign);
  box(g, 0.05, 0.05, 0.5, WOOD_DARK, 1.55, 3.0, 0.95);
  part(g, new THREE.CylinderGeometry(0.15, 0.12, 0.22, 16), trim, 1.55, 2.82, 1.15);
  part(g, new THREE.TorusGeometry(0.07, 0.02, 6, 12), trim, 1.55, 2.82, 1.0, 0, Math.PI / 2);
  for (const x of [-1.1, 0, 1.1]) {
    part(g, new THREE.CylinderGeometry(0.16, 0.12, 0.25, 10), mat("#c98a6a"), x, 4.42, 0.7);
    part(g, blob(0.24, x + 5), mat("#7fae6d"), x, 4.65, 0.7);
  }
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
  part(g, new THREE.ConeGeometry(1.0, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ map: awningTex, side: THREE.DoubleSide, roughness: 0.8 }), -0.95, 2.35, 2.75);
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
  const red = SHOP.stall;
  box(g, 1.9, 0.95, 0.75, WOOD, 0, 0.48, 0);
  box(g, 2.0, 0.07, 0.85, WOOD_DARK, 0, 0.97, 0);
  for (const x of [-0.92, 0.92]) box(g, 0.1, 2.3, 0.1, WOOD_DARK, x, 1.15, -0.3);
  for (const s of [-1, 1]) box(g, 1.25, 0.08, 1.2, red, s * 0.55, 2.42, -0.15, 0, 0, s * -0.42);
  box(g, 0.1, 0.1, 1.25, WOOD_DARK, 0, 2.66, -0.15);
  const sign = textPlane("LUCKY DRAW", { width: 1.5, color: "#ffffff", bg: "#c4473b", font: "800 92px" });
  sign.position.set(0, 1.95, -0.24);
  g.add(sign);
  part(g, new THREE.CylinderGeometry(0.17, 0.17, 0.42, 6), red, -0.4, 1.22, 0.05);
  part(g, new THREE.CylinderGeometry(0.175, 0.175, 0.06, 6), mat("#e8c46a", { metalness: 0.4, roughness: 0.35 }), -0.4, 1.3, 0.05);
  for (let k = 0; k < 5; k++) box(g, 0.025, 0.25, 0.012, mat("#f2e2c4"), -0.46 + k * 0.03, 1.5, 0.05, 0, 0, (k - 2) * 0.08);
  box(g, 0.5, 0.12, 0.3, mat("#fbf7ef"), 0.45, 1.06, 0.05);
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
  for (const x of [-0.75, 0.75]) {
    part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), WOOD_DARK, x, 2.12, 0.35);
    lanternLight(g, x, 1.95, 0.35, "#ff8a72").scale.set(1.2, 1.5, 1.2);
  }
  return g;
}

// ---------- 池塘和小木桥
function pond() {
  const g = new THREE.Group();
  const surface = jellyWater(POND.r - 0.05, "#7fd8cf", "#2f8f9c");
  g.add(surface);
  const pads = new THREE.Group();
  const padMat = mat("#6fa35f", { roughness: 0.8 });
  const r = rng(41);
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2;
    const d = 0.6 + r() * (POND.r - 1.1);
    part(pads, new THREE.CircleGeometry(0.2 + r() * 0.1, 14, 0.3, Math.PI * 2 - 0.6), padMat, Math.cos(a) * d, 0.04, Math.sin(a) * d, -Math.PI / 2, 0, r() * 6);
    if (k % 3 === 0) part(pads, blob(0.07, k), mat("#f6b4c8", { roughness: 0.6 }), Math.cos(a) * d, 0.09, Math.sin(a) * d);
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
  const span = POND.r * 2 + 0.6;
  const arc = (t) => Math.sin(Math.PI * t) * 0.65 + 0.25;
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const x = -span / 2 + t * span;
    const slope = (Math.cos(Math.PI * t) * 0.65 * Math.PI) / span;
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
  return { group: g, pads };
}

// ---------- 许愿池（小树林里）
function wishingWell() {
  const g = new THREE.Group();
  const stone = mat("#bdb5a8", { roughness: 0.95, flatShading: true });
  part(g, new THREE.CylinderGeometry(0.9, 0.95, 0.7, 16, 1, true), stone, 0, 0.35);
  part(g, new THREE.CylinderGeometry(0.72, 0.72, 0.7, 16, 1, true), mat("#8f877b", { side: THREE.BackSide }), 0, 0.35);
  part(g, new THREE.RingGeometry(0.72, 0.95, 16), mat("#cfc7ba", { roughness: 0.9, flatShading: true }), 0, 0.705, 0, -Math.PI / 2);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    part(g, blob(0.12, k, { detail: 0, smooth: false }), stone, Math.cos(a) * 0.94, 0.25 + (k % 2) * 0.25, Math.sin(a) * 0.94);
  }
  const water = jellyWater(0.7, "#8fe6e0", "#2b8fa8");
  water.position.y = 0.45;
  g.add(water);
  const gold = mat("#f2c94c", { metalness: 0.6, roughness: 0.3 });
  const r = rng(4);
  for (let k = 0; k < 9; k++) part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.01, 10), gold, (r() - 0.5) * 0.8, 0.43, (r() - 0.5) * 0.8, (r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
  for (const x of [-0.85, 0.85]) box(g, 0.1, 1.75, 0.1, WOOD_DARK, x, 0.88, 0);
  for (const s of [-1, 1]) box(g, 0.95, 0.07, 1.25, SHOP.wellRoof, s * 0.42, 1.95, 0, 0, 0, s * -0.55);
  box(g, 0.08, 0.08, 1.3, WOOD_DARK, 0, 2.2, 0);
  part(g, new THREE.CylinderGeometry(0.06, 0.06, 1.75, 8), WOOD, 0, 1.45, 0, 0, 0, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.55, 4), mat("#e9dcc2"), 0.1, 1.17, 0);
  part(g, new THREE.CylinderGeometry(0.12, 0.1, 0.18, 12), WOOD, 0.1, 0.86, 0);
  const sign = textPlane("WISHING WELL", { width: 1.1, color: "#ffffff", bg: "#8d6448", font: "800 90px" });
  sign.position.set(0, 1.62, 0.9);
  g.add(sign);
  return g;
}

function bench(parent, x, z, faceX, faceZ) {
  const g = new THREE.Group();
  box(g, 1.5, 0.08, 0.48, WOOD, 0, 0.46, 0);
  box(g, 1.5, 0.38, 0.06, WOOD, 0, 0.75, -0.22, -0.12);
  for (const sx of [-0.65, 0.65]) box(g, 0.07, 0.46, 0.44, mat("#4a4f55"), sx, 0.23, 0);
  g.position.set(x, terrainHeight(x, z), z);
  g.rotation.y = Math.atan2(faceX - x, faceZ - z);
  parent.add(g);
  return { x, z, ry: g.rotation.y, obj: g };
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
  const seats = [];
  const r = rng(91);
  const onGround = (obj, x, z, faceX = 0, faceZ = 0) => {
    obj.position.set(x, terrainHeight(x, z), z);
    obj.rotation.y = Math.atan2(faceX - x, faceZ - z);
    root.add(shadowed(obj));
    return obj;
  };
  const paved = (x, z, radius) => {
    const tex = pathTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(radius / 1.2, radius / 1.2);
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, terrainHeight(x, z) + 0.05, z);
    m.receiveShadow = true;
    root.add(m);
  };
  const soilMat = mat("#7a5a44", { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const soil = (cx, cz, r0, r1) => {
    const geo = r0 > 0 ? new THREE.RingGeometry(r0, r1, 48) : new THREE.CircleGeometry(r1, 32);
    const m = new THREE.Mesh(geo, soilMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, terrainHeight(cx, cz) + 0.04, cz);
    m.receiveShadow = true;
    root.add(m);
  };
  const types = ["tulip", "lavender", "puff", "daisy"];
  const bed = (cx, cz, r0, r1, n, gaps = []) => {
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      if (gaps.some((g) => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.32)) continue;
      const d = r0 + r() * (r1 - r0);
      flowerSpots.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d, types[Math.floor((a / (Math.PI * 2)) * 8) % 4], Math.floor(r() * 10)]);
    }
  };

  // 花房在正中间，门朝南（码头那边）；花坛在草地上，四条小路进来的地方留空
  const house = onGround(flowerHouse(), 0, 0, 0, 10);
  house.userData.kind = "flowerhouse";
  world.colliders.push({ x: 0, z: 0, r: 3.45 }, { x: -0.7, z: 3.4, r: 0.35 }, { x: 0.7, z: 3.4, r: 0.35 });
  const gates = [5, 90, 175, 270].map((d) => (d * Math.PI) / 180);
  soil(0, 0, 3.55, 4.35);
  bed(0, 0, 3.6, 4.3, 170, gates);
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    if (gates.some((g) => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35)) continue;
    world.colliders.push({ x: Math.cos(a) * 3.95, z: Math.sin(a) * 3.95, r: 0.38 });
  }
  // 夏天花房外面多一些花：绣球和向日葵
  const summerFlowers = new THREE.Group();
  [30, 145, 200, 240, 300, 335].forEach((deg, k) => {
    const a = (deg * Math.PI) / 180;
    const h = hydrangea(k);
    h.position.set(Math.cos(a) * 3.98, terrainHeight(Math.cos(a) * 3.98, Math.sin(a) * 3.98), Math.sin(a) * 3.98);
    h.rotation.y = k;
    h.scale.setScalar(0.85);
    summerFlowers.add(h);
  });
  [55, 63, 117, 125].forEach((deg, k) => {
    const a = (deg * Math.PI) / 180;
    const f = sunflower(k);
    f.position.set(Math.cos(a) * 4.1, terrainHeight(Math.cos(a) * 4.1, Math.sin(a) * 4.1), Math.sin(a) * 4.1);
    f.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)) + (k % 2 ? 0.25 : -0.25);
    summerFlowers.add(f);
  });
  root.add(summerFlowers);

  // 喷泉在南边，旁边两个小圆花坛（不长在路上）
  const F = { x: 0, z: 8.1 };
  paved(F.x, F.z, 2.0);
  const fnt = fountain();
  onGround(fnt.group, F.x, F.z);
  world.colliders.push({ x: F.x, z: F.z, r: 1.55 });
  for (const sx of [-2.7, 2.7]) {
    soil(sx, 5.7, 0, 0.85);
    bed(sx, 5.7, 0.1, 0.8, 40);
    world.colliders.push({ x: sx, z: 5.7, r: 0.8 });
  }
  seats.push(bench(root, -2.9, 10.3, F.x, F.z), bench(root, 2.9, 10.3, F.x, F.z));
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
  world.colliders.push({ x: POND.x, z: POND.z, r: POND.r + 0.2 });
  world.reserved.push([POND.x, POND.z, POND.r + 1.2]);
  seats.push(bench(root, POND.x + 2.6, POND.z + 2.0, POND.x, POND.z));
  world.colliders.push({ x: POND.x + 2.6, z: POND.z + 2.0, r: 0.7 });

  // 小树林里的许愿池，有一条小路过去，旁边一张长椅
  const well = onGround(wishingWell(), WELL.x, WELL.z, 8.3, 11.9);
  well.userData.kind = "wish";
  world.colliders.push({ x: WELL.x, z: WELL.z, r: 1.05 });
  world.reserved.push([WELL.x, WELL.z, 3.4]);
  world.addPathStrip(new THREE.Vector3(8.0, 0, 11.6), new THREE.Vector3(10.2, 0, 14.6), 1.1);
  seats.push(bench(root, WELL.x + 2.2, WELL.z - 0.4, WELL.x, WELL.z));
  world.colliders.push({ x: WELL.x + 2.2, z: WELL.z - 0.4, r: 0.7 });

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

  const specials = [
    [160, "normal"],
    [197, "garden"],
    [294, "garden"],
    [341, "normal"],
  ].map(([deg, type]) => {
    const a = (deg * Math.PI) / 180;
    return { type, x: Math.cos(a) * 9.6, z: Math.sin(a) * 9.6, s: 0.72 };
  });
  // 许愿池周围再种一圈树（避开小路和长椅）
  [
    [30, 3.9],
    [70, 4.3],
    [108, 3.7],
    [148, 4.4],
    [186, 3.9],
    [282, 4.1],
    [318, 4.6],
  ].forEach(([deg, d], k) => {
    const a = (deg * Math.PI) / 180;
    const x = WELL.x + Math.cos(a) * d;
    const z = WELL.z + Math.sin(a) * d;
    if (terrainHeight(x, z) > 0.62) specials.push({ type: "normal", x, z, s: 0.8 + (k % 3) * 0.12 });
  });

  // 互动点：站到这里会出现按钮
  const front = (obj, d) => new THREE.Vector3(0, 0, d).applyAxisAngle(new THREE.Vector3(0, 1, 0), obj.rotation.y).add(obj.position);
  const cafeFront = front(cafeObj, 3.5);
  const luckFront = front(stall, 1.6);
  const wellFront = front(well, 1.7);
  const interactions = [
    { kind: "flowerhouse", x: 0, z: 4.9, r: 2.2, label: "See the Flower House board" },
    { kind: "cafe", x: cafeFront.x, z: cafeFront.z, r: 2.4, label: "Order a drink" },
    { kind: "luck", x: luckFront.x, z: luckFront.z, r: 2.2, label: "Draw a lucky note" },
    { kind: "wish", x: wellFront.x, z: wellFront.z, r: 2.2, label: "Make a wish" },
    ...seats.map((s, i) => {
      const p = new THREE.Vector3(0, 0, 0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.ry).add(new THREE.Vector3(s.x, 0, s.z));
      return { kind: "bench", i, x: p.x, z: p.z, r: 1.7, label: "Sit on the bench" };
    }),
  ];
  // 长椅可以直接点：会走过去坐下
  seats.forEach((s, i) => {
    s.obj.userData.kind = "bench";
    s.obj.userData.seat = i;
    s.front = { x: interactions.at(-seats.length + i).x, z: interactions.at(-seats.length + i).z };
  });

  function setSeason(name) {
    const C = SHOP_COLORS[name];
    for (const k of Object.keys(SHOP)) SHOP[k].color.set(C[k]);
    paintAwning(C.awnA, C.awnB);
    WOOD.color.set(C.wood);
    WOOD_DARK.color.set(C.woodDark);
    summerFlowers.visible = name === "summer";
    pd.pads.visible = name !== "winter";
    jellyUniforms.uFrozen.value = name === "winter" ? 1 : 0;
    soilMat.color.set(name === "winter" ? "#e3e8ec" : "#7a5a44");
    for (const o of fnt.flowing) o.visible = name !== "winter";
  }

  function update(t, dt) {
    jellyUniforms.uTime.value = t;
    jellyUniforms.uNight.value = world.night;
    if (fnt.spray.visible) fnt.update(dt);
  }

  const cafeTop = cafeObj.position.clone().add(new THREE.Vector3(0, 5.6, 0));
  return { root, flowerSpots, specials, interactions, seats, cafeTop, pickables: [house, cafeObj, stall, well, ...seats.map((s) => s.obj)], setSeason, update };
}
