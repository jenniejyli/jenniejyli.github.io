import * as THREE from "three";
import { PATH_POINTS, STATIONS } from "./data.js";
import {
  clamp,
  lerp,
  smoothstep,
  rng,
  fbm2,
  mat,
  mergeParts,
  m4,
  glowsAtNight,
  nightGlow,
  canvasTexture,
  textPlane,
  dotTexture,
  shadowed,
} from "./util.js";

// ===== 小岛的形状 =====

export const DISK_R = 56; // 整片果冻海（圆盘）的半径
export const SEA_FLOOR = -5.6;
export const PIER = { x0: -1.6, x1: 1.6, z0: 25, z1: 39.4, y: 0.55, endZ: 41.6, endR: 3.4 };
export const BOARD = { x: -6, z: 22 };
export const FEED = { x: 8.3, z: 29.3 };
export const FISH_ZONE = { x: 10, z: 35.1, r: 2.6 };

export function islandRadius(th) {
  return 32 + 1.8 * Math.sin(3 * th + 1) + 1.0 * Math.sin(5 * th + 2);
}

function hill(x, z) {
  return 1.7 * (1 - smoothstep(1.5, 9, Math.hypot(x, z)));
}

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const R = islandRadius(Math.atan2(z, x));
  const land = 1.0 + (fbm2(x * 0.09, z * 0.09) - 0.5) * 0.22 + hill(x, z);
  if (r < R - 5.2) return lerp(land, 0.5, smoothstep(R - 6.5, R - 5.2, r));
  if (r < R) return (0.5 * (R - r)) / 5.2;
  return Math.max(SEA_FLOOR, -5.4 * smoothstep(R, R + 12, r) - 0.03 * (r - R));
}

export function onPier(x, z) {
  return (x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1) || Math.hypot(x, z - PIER.endZ) < PIER.endR;
}

export function groundHeight(x, z) {
  const h = terrainHeight(x, z);
  return onPier(x, z) ? Math.max(PIER.y, h) : h;
}

// ===== 四季 =====

export const SEASON_STYLE = {
  spring: { grass: "#a9d68e", grass2: "#c6e6a6", leaf: "#a3d689", blossom: "#f5b9cc", kapok: "#ec7f63", pine: "#7fbf86", bush: "#93c97f", flowers: 1, particles: "petals" },
  summer: { grass: "#8ccb7c", grass2: "#a6d88d", leaf: "#78bd6d", blossom: "#f3aac2", kapok: "#7cbc69", pine: "#6aae76", bush: "#7dbd6e", flowers: 1, particles: "summer" },
  autumn: { grass: "#c9c985", grass2: "#dccf90", leaf: "#eba45f", blossom: "#eca487", kapok: "#e4b75c", pine: "#7aa676", bush: "#c7b26a", flowers: 0.45, particles: "leaves" },
  winter: { grass: "#e6edf1", grass2: "#f6f9fb", leaf: "#e8eff3", blossom: "#eef1f5", kapok: "#dfe5e9", pine: "#cfe0e2", bush: "#dde7ec", flowers: 0, particles: "snow" },
};

export function seasonOf(date) {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

// ===== 早晚 =====

const NIGHT = { skyTop: "#13204a", skyBottom: "#33467a", hemiSky: "#7085c0", hemiGround: "#313a58", hemi: 1.35, sun: "#b4c4ff", sunI: 0.95, shallow: "#5aa3b5", deep: "#1f4569", foam: "#d6e6ff", night: 1 };
const DAWN = { skyTop: "#9fb8e6", skyBottom: "#ffd9c4", hemiSky: "#d4dcf2", hemiGround: "#9c8a7c", hemi: 1.4, sun: "#ffcfa8", sunI: 2.0, shallow: "#a5e6dc", deep: "#68aed0", foam: "#fff6ee", night: 0.2 };
const DAY = { skyTop: "#8ccbef", skyBottom: "#e6f6fb", hemiSky: "#e4f3ff", hemiGround: "#b3a68f", hemi: 1.6, sun: "#fff6e8", sunI: 2.6, shallow: "#aef0e2", deep: "#5cbad7", foam: "#ffffff", night: 0 };
const DUSK = { skyTop: "#8c8fd4", skyBottom: "#ffc2a8", hemiSky: "#ebcbd8", hemiGround: "#86726c", hemi: 1.2, sun: "#ffb48c", sunI: 1.8, shallow: "#b0dcd9", deep: "#6890c4", foam: "#fff1e8", night: 0.3 };
const BLUE = { skyTop: "#2b3c76", skyBottom: "#8584bd", hemiSky: "#8a9ad0", hemiGround: "#40405a", hemi: 1.25, sun: "#c3b6ff", sunI: 0.8, shallow: "#7fb6c4", deep: "#2e527c", foam: "#e6e6ff", night: 0.75 };
const TIME_KEYS = [
  [0, NIGHT],
  [4.8, NIGHT],
  [6.3, DAWN],
  [8.5, DAY],
  [16.3, DAY],
  [18, DUSK],
  [19.3, BLUE],
  [20.5, NIGHT],
  [24, NIGHT],
];
const COLOR_KEYS = ["skyTop", "skyBottom", "hemiSky", "hemiGround", "sun", "shallow", "deep", "foam"];

function sampleTime(hour) {
  let i = 0;
  while (i < TIME_KEYS.length - 2 && hour >= TIME_KEYS[i + 1][0]) i++;
  const [h0, a] = TIME_KEYS[i];
  const [h1, b] = TIME_KEYS[i + 1];
  const t = smoothstep(0, 1, (hour - h0) / (h1 - h0));
  const out = {};
  for (const k of COLOR_KEYS) out[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  for (const k of ["hemi", "sunI", "night"]) out[k] = lerp(a[k], b[k], t);
  return out;
}

export function timeLabel(hour) {
  if (hour >= 5 && hour < 11) return "Morning";
  if (hour >= 11 && hour < 16.5) return "Afternoon";
  if (hour >= 16.5 && hour < 19.5) return "Evening";
  return "Night";
}

// ===== 着色器 =====

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
varying vec3 vDir;
void main() {
  float t = smoothstep(-0.3, 0.6, vDir.y);
  gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_VERT = /* glsl */ `
uniform float uTime;
uniform float uR;
varying vec3 vWorld;
varying float vWave;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float wave = sin(w.x * 0.18 + uTime * 0.9) * 0.5
             + sin(w.z * 0.22 - uTime * 0.7) * 0.5
             + sin((w.x + w.z) * 0.35 + uTime * 1.6) * 0.25;
  float edge = 1.0 - smoothstep(uR - 3.0, uR, length(w.xz));
  w.y += wave * 0.11 * edge;
  vWave = wave;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uR;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec3 uSky;
uniform sampler2D uDepth;
varying vec3 vWorld;
varying float vWave;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = vWorld.xz / (2.0 * uR) + 0.5;
  float d = texture2D(uDepth, uv).r;
  float sh = smoothstep(0.0, 0.6, d);
  vec3 col = mix(uShallow, uDeep, sh);
  // 果冻感：围着小岛一圈圈的浅色波纹
  col += smoothstep(0.75, 1.0, sin(d * 70.0 - uTime * 1.3) * 0.5 + 0.5) * (1.0 - sh) * 0.16;
  // 浅水区的光斑
  float ca = sin(vWorld.x * 1.7 + uTime * 1.1) * sin(vWorld.z * 1.5 - uTime * 0.9);
  col += pow(max(ca, 0.0), 6.0) * 0.22 * (1.0 - sh);
  // 沙滩边的白色浪花
  float edgeW = 0.03 + 0.015 * sin(uTime * 1.6 + vWorld.x * 0.4 + vWorld.z * 0.3);
  float foam = 1.0 - smoothstep(edgeW * 0.4, edgeW, d);
  col = mix(col, uFoam, foam * 0.9);
  // 水面上一闪一闪的亮点
  vec2 gp = vWorld.xz * 0.8;
  vec2 cell = floor(gp);
  vec2 f = fract(gp);
  float rnd = hash(cell);
  vec2 c = vec2(hash(cell + 3.7), hash(cell + 9.1)) * 0.7 + 0.15;
  float tw = pow(0.5 + 0.5 * sin(uTime * (1.5 + rnd * 2.5) + rnd * 50.0), 8.0);
  float spark = step(0.82, rnd) * smoothstep(0.1, 0.0, length(f - c)) * tw;
  col += spark * mix(vec3(1.0), vec3(0.85, 0.9, 1.0), uNight) * 0.9;
  col += vWave * 0.05;
  vec3 V = normalize(cameraPosition - vWorld);
  float fr = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  col = mix(col, uSky, fr * 0.4);
  float alpha = max(mix(0.32, 0.9, sh), foam * 0.95);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WALL_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WALL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
varying vec3 vWorld;
void main() {
  float t = clamp((vWorld.y + 6.0) / 6.0, 0.0, 1.0);
  vec3 col = mix(uDeep * 0.85, mix(uDeep, uShallow, 0.55), t);
  col = mix(col, uShallow + 0.12, smoothstep(0.93, 1.0, t));
  float ang = atan(vWorld.z, vWorld.x);
  col += pow(max(sin(ang * 46.0 + vWorld.y * 0.7 + uTime * 0.35), 0.0), 14.0) * 0.08;
  gl_FragColor = vec4(col, mix(0.78, 0.62, t));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ===== 搭建整个世界 =====

export function createWorld(scene, { lowPower = false } = {}) {
  const colliders = [];
  const reserved = [];
  const pathSamples = [];
  const updaters = [];
  let season = null;

  // --- 天空、太阳、星星
  const skyUniforms = { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 16),
    new THREE.ShaderMaterial({ uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -2;
  scene.add(sky);

  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  const sr = rng(11);
  for (let i = 0; i < 500; i++) {
    const a = sr() * Math.PI * 2;
    const y = 0.08 + sr() * 0.92;
    const rr = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * rr * 600, y * 600, Math.sin(a) * rr * 600);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: "#ffffff", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(false), color: "#fff3d6", transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.set(60, 60, 1);
  scene.add(sunSprite);

  // --- 灯光
  const hemi = new THREE.HemisphereLight("#ffffff", "#998877", 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffffff", 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -48;
  sc.right = 48;
  sc.top = 48;
  sc.bottom = -48;
  sc.near = 1;
  sc.far = 200;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // --- 地形（极坐标网格，外圈正好是圆盘边缘）
  const RINGS = 112;
  const SEGS = 200;
  const tPos = [0, terrainHeight(0, 0), 0];
  for (let i = 1; i <= RINGS; i++) {
    const r = (DISK_R * i) / RINGS;
    for (let j = 0; j < SEGS; j++) {
      const th = (j / SEGS) * Math.PI * 2;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      tPos.push(x, i === RINGS ? -6.0 : terrainHeight(x, z), z);
    }
  }
  const tIdx = [];
  const vid = (i, j) => 1 + (i - 1) * SEGS + (j % SEGS);
  for (let j = 0; j < SEGS; j++) tIdx.push(0, vid(1, j + 1), vid(1, j));
  for (let i = 2; i <= RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a0 = vid(i - 1, j);
      const a1 = vid(i - 1, j + 1);
      const b0 = vid(i, j);
      const b1 = vid(i, j + 1);
      tIdx.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute("position", new THREE.Float32BufferAttribute(tPos, 3));
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(tPos.length), 3));
  terrainGeo.setIndex(tIdx);
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  const SAND = new THREE.Color("#eedcb3");
  const SAND_WET = new THREE.Color("#dcc597");
  const SEABED = new THREE.Color("#e4d3a8");
  function paintTerrain(style) {
    const g1 = new THREE.Color(style.grass);
    const g2 = new THREE.Color(style.grass2);
    const pos = terrainGeo.attributes.position.array;
    const col = terrainGeo.attributes.color.array;
    const c = new THREE.Color();
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      if (y < -0.05) c.copy(SEABED).lerp(SAND_WET, clamp(-y / 6, 0, 1) * 0.6);
      else {
        c.copy(g1).lerp(g2, fbm2(x * 0.14, z * 0.14));
        const sandy = 1 - smoothstep(0.42, 0.62, y);
        c.lerp(y < 0.12 ? SAND_WET : SAND, sandy);
      }
      col[i] = c.r;
      col[i + 1] = c.g;
      col[i + 2] = c.b;
    }
    terrainGeo.attributes.color.needsUpdate = true;
  }

  // --- 果冻海：水面 + 透明侧壁
  const DT = 256;
  const depthData = new Uint8Array(DT * DT * 4);
  for (let j = 0; j < DT; j++) {
    for (let i = 0; i < DT; i++) {
      const x = -DISK_R + ((i + 0.5) * 2 * DISK_R) / DT;
      const z = -DISK_R + ((j + 0.5) * 2 * DISK_R) / DT;
      const v = Math.round(clamp(-terrainHeight(x, z) / 6, 0, 1) * 255);
      depthData.set([v, v, v, 255], (j * DT + i) * 4);
    }
  }
  const depthTex = new THREE.DataTexture(depthData, DT, DT, THREE.RGBAFormat);
  depthTex.magFilter = THREE.LinearFilter;
  depthTex.minFilter = THREE.LinearFilter;
  depthTex.needsUpdate = true;

  const waterUniforms = {
    uTime: { value: 0 },
    uNight: { value: 0 },
    uR: { value: DISK_R },
    uShallow: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color() },
    uSky: { value: new THREE.Color() },
    uDepth: { value: depthTex },
  };
  const wPos = [0, 0, 0];
  const WR = 64;
  const WS = 160;
  for (let i = 1; i <= WR; i++) {
    const r = ((DISK_R - 0.05) * i) / WR;
    for (let j = 0; j < WS; j++) {
      const th = (j / WS) * Math.PI * 2;
      wPos.push(Math.cos(th) * r, 0, Math.sin(th) * r);
    }
  }
  const wIdx = [];
  const wid = (i, j) => 1 + (i - 1) * WS + (j % WS);
  for (let j = 0; j < WS; j++) wIdx.push(0, wid(1, j + 1), wid(1, j));
  for (let i = 2; i <= WR; i++) {
    for (let j = 0; j < WS; j++) wIdx.push(wid(i - 1, j), wid(i - 1, j + 1), wid(i, j), wid(i - 1, j + 1), wid(i, j + 1), wid(i, j));
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
  waterGeo.setIndex(wIdx);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false }),
  );
  water.renderOrder = 2;
  scene.add(water);

  const wallUniforms = { uTime: waterUniforms.uTime, uShallow: waterUniforms.uShallow, uDeep: waterUniforms.uDeep };
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(DISK_R, DISK_R, 6, 160, 1, true),
    new THREE.ShaderMaterial({ uniforms: wallUniforms, vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, transparent: true, depthWrite: false }),
  );
  wall.position.y = -3;
  wall.renderOrder = 1;
  scene.add(wall);

  // --- 悬浮的底座：沙层、土层，下面是倒锥形的岩石
  const layers = [
    [DISK_R, DISK_R, 1.0, -6.5, "#ecd7ab"],
    [DISK_R, DISK_R - 1.2, 2.2, -8.1, "#cfa27b"],
    [DISK_R - 1.2, DISK_R - 6, 2.8, -10.6, "#b18466"],
  ];
  for (const [rt, rb, h, y, color] of layers) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 96), mat(color, { roughness: 1 }));
    m.position.y = y;
    scene.add(m);
  }
  const coneGeo = new THREE.CylinderGeometry(DISK_R - 6, 3, 18, 30, 6);
  const cr = rng(5);
  const cp = coneGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    if (cp.getY(i) > 8.9) continue;
    const k = 1 + (cr() - 0.5) * 0.16;
    cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) + (cr() - 0.5) * 1.2, cp.getZ(i) * k);
  }
  coneGeo.computeVertexNormals();
  const cone = new THREE.Mesh(coneGeo, mat("#9b8174", { roughness: 1, flatShading: true }));
  cone.position.y = -21;
  scene.add(cone);

  const rockMat = mat("#a38d80", { flatShading: true, roughness: 1 });
  const floaters = [];
  const fr = rng(9);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + fr() * 0.5;
    const r = 62 + fr() * 8;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + fr() * 1.6, 0), rockMat);
    m.position.set(Math.cos(a) * r, -9 - fr() * 9, Math.sin(a) * r);
    m.userData.base = m.position.y;
    m.userData.phase = fr() * 6;
    scene.add(m);
    floaters.push(m);
  }

  // --- 云
  const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#ffffff", emissiveIntensity: 0.25 });
  const clouds = new THREE.Group();
  const cl = rng(13);
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(cl() * 3);
    for (let k = 0; k < n; k++) {
      const s = 3 + cl() * 4;
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), cloudMat);
      p.position.set((k - n / 2) * 3.6 + cl() * 2, cl() * 2.4, cl() * 3);
      p.scale.y = 0.75;
      g.add(p);
    }
    const a = (i / 10) * Math.PI * 2 + cl();
    const r = 80 + cl() * 45;
    g.position.set(Math.cos(a) * r, -6 + cl() * 30, Math.sin(a) * r);
    g.lookAt(0, g.position.y, 0);
    clouds.add(g);
  }
  scene.add(clouds);

  // --- 石板路
  const PATH_W = 2.3;
  const pathMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const STONE = new THREE.Color("#eee5d3");
  const STONE_EDGE = new THREE.Color("#d8ccb6");

  function ribbon(points, width, closed) {
    const pos = [];
    const col = [];
    const idx = [];
    const n = points.length;
    const offs = [-width / 2, -width / 2 + 0.22, width / 2 - 0.22, width / 2];
    for (let i = 0; i < n; i++) {
      const prev = points[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
      const next = points[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      let tx = next.x - prev.x;
      let tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      for (let k = 0; k < 4; k++) {
        const x = points[i].x - tz * offs[k];
        const z = points[i].z + tx * offs[k];
        pos.push(x, terrainHeight(x, z) + 0.06, z);
        const c = k === 0 || k === 3 ? STONE_EDGE : STONE;
        col.push(c.r, c.g, c.b);
      }
      pathSamples.push([points[i].x, points[i].z, width / 2]);
    }
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = i * 4;
      const b = ((i + 1) % n) * 4;
      for (let k = 0; k < 3; k++) idx.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, pathMat);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  const curve = new THREE.CatmullRomCurve3(
    PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    "centripetal",
  );
  const loopPts = curve.getSpacedPoints(700).slice(0, 700);
  ribbon(loopPts, PATH_W, true);

  // 每一站门口的小广场
  const plazaMat = new THREE.MeshStandardMaterial({ color: "#ece2cf", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const plazaEdgeMat = new THREE.MeshStandardMaterial({ color: "#d6c9b1", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (const s of STATIONS) {
    const [x, z] = s.stop;
    const y = terrainHeight(x, z) + 0.07;
    const p = new THREE.Mesh(new THREE.CircleGeometry(2.5, 36), plazaMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    p.receiveShadow = true;
    const e = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.6, 36), plazaEdgeMat);
    e.rotation.x = -Math.PI / 2;
    e.position.set(x, y + 0.005, z);
    scene.add(p, e);
  }

  // 从一站的停靠点走到建筑门口的小路
  function addPathStrip(a, b, width = 1.8) {
    const pts = [];
    const n = Math.max(2, Math.ceil(a.distanceTo(b) / 0.5));
    for (let i = 0; i <= n; i++) pts.push(a.clone().lerp(b, i / n));
    ribbon(pts, width, false);
  }

  function pathDistance(x, z) {
    let best = Infinity;
    for (const [px, pz, hw] of pathSamples) {
      const d = Math.hypot(x - px, z - pz) - hw;
      if (d < best) best = d;
    }
    return best;
  }

  // --- 码头和灯塔
  const plankTex = canvasTexture(128, 512, (g, w, h) => {
    g.fillStyle = "#d7b48c";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = y % 64 ? "#cfa97f" : "#dbb994";
      g.fillRect(0, y, w, 30);
      g.fillStyle = "#b89068";
      g.fillRect(0, y + 30, w, 2);
    }
  });
  const pierLen = PIER.z1 - PIER.z0;
  const deckMat = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(PIER.x1 - PIER.x0, 0.25, pierLen), deckMat);
  deck.position.set(0, PIER.y - 0.125, (PIER.z0 + PIER.z1) / 2);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(PIER.endR, PIER.endR, 0.25, 32), mat("#d4b089", { roughness: 0.9 }));
  platform.position.set(0, PIER.y - 0.125, PIER.endZ);
  const woodDark = mat("#9c7656");
  const pier = new THREE.Group();
  pier.add(deck, platform);
  for (let z = PIER.z0 + 3; z < PIER.z1; z += 2.4) {
    for (const x of [PIER.x0 + 0.15, PIER.x1 - 0.15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.2, 8), woodDark);
      post.position.set(x, PIER.y - 1.7, z);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), woodDark);
      rail.position.set(x, PIER.y + 0.35, z);
      pier.add(post, rail);
    }
  }
  for (const x of [PIER.x0 + 0.15, PIER.x1 - 0.15]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, pierLen - 4), woodDark);
    top.position.set(x, PIER.y + 0.68, (PIER.z0 + 3 + PIER.z1) / 2 - 0.2);
    pier.add(top);
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 8), woodDark);
    post.position.set(Math.cos(a) * (PIER.endR - 0.25), PIER.y - 1.7, PIER.endZ + Math.sin(a) * (PIER.endR - 0.25));
    pier.add(post);
  }
  scene.add(shadowed(pier));

  const lh = new THREE.Group();
  const coral = mat("#ec9384");
  const lhWhite = mat("#f7f4ee");
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.5, 20), mat("#c9bdb0"));
  lhBase.position.y = 0.25;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.85, 4.2, 20), lhWhite);
  body.position.y = 2.6;
  lh.add(lhBase, body);
  for (const y of [1.3, 2.6, 3.9]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.66 + (4.7 - y) * 0.055, 0.7 + (4.7 - y) * 0.055, 0.42, 20), coral);
    band.position.y = y;
    lh.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 20), mat("#6d7480"));
  gallery.position.y = 4.78;
  const lanternMat = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#fff7d6", emissive: "#ffd779", emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.9 }), 2.5);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.75, 16), lanternMat);
  lantern.position.y = 5.25;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.85, 20), coral);
  cap.position.y = 6.05;
  lh.add(gallery, lantern, cap);
  const beamMat = new THREE.MeshBasicMaterial({ color: "#fff1b8", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 22, 24, 1, true), beamMat);
  beam.geometry.translate(0, -11, 0);
  beam.rotation.z = Math.PI / 2;
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 5.25;
  beamPivot.add(beam);
  lh.add(beamPivot);
  lh.position.set(2.6, PIER.y, PIER.endZ + 1.2);
  scene.add(shadowed(lh));
  colliders.push({ x: lh.position.x, z: lh.position.z, r: 1.0 });

  // --- 路灯
  const glowTex = dotTexture(true);
  const lampHeadMat = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#fff6dd", emissive: "#ffd27a", emissiveIntensity: 0, roughness: 0.4 }), 2.4);
  const lampPostMat = mat("#5d6672");
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: "#ffd88f", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  function lamp(x, z, y = terrainHeight(x, z)) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.3, 8), lampPostMat);
    post.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), lampHeadMat);
    head.position.y = 2.42;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 10), lampPostMat);
    hat.position.y = 2.66;
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(2.2, 2.2, 1);
    glow.position.y = 2.42;
    g.add(post, head, hat, glow);
    g.position.set(x, y, z);
    scene.add(shadowed(g, true, false));
    colliders.push({ x, z, r: 0.3 });
  }
  for (let k = 0; k < 14; k++) {
    const u = (k + 0.5) / 14;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    let nx = -t.z;
    let nz = t.x;
    if (nx * p.x + nz * p.z < 0) {
      nx = -nx;
      nz = -nz;
    }
    const x = p.x + nx * 1.75;
    const z = p.z + nz * 1.75;
    if (STATIONS.some((s) => Math.hypot(x - s.stop[0], z - s.stop[1]) < 4.2)) continue;
    if (Math.hypot(x - BOARD.x, z - BOARD.z) < 2.5) continue;
    lamp(x, z);
  }
  for (const z of [30, 36]) {
    lamp(PIER.x0 + 0.15, z + 1.2, PIER.y);
  }

  // --- 公告栏
  const board = new THREE.Group();
  const wood = mat("#b98a5e");
  const woodD = mat("#8d6448");
  for (const x of [-1.05, 1.05]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 0.14), woodD);
    post.position.set(x, 1.15, 0);
    board.add(post);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.45, 0.1), wood);
  panel.position.set(0, 1.45, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 0.62), woodD);
  roof.position.set(0, 2.35, 0);
  board.add(panel, roof);
  const notes = ["#fff7d6", "#ffe1e8", "#e2f1ff", "#e8f7df"];
  notes.forEach((c, i) => {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.55), mat(c, { roughness: 1 }));
    n.position.set(-0.75 + i * 0.5, 1.35 + (i % 2) * 0.12, 0.056);
    n.rotation.z = (i % 2 ? 1 : -1) * 0.06;
    board.add(n);
  });
  const boardTitle = textPlane("ISLAND BULLETIN", { width: 2.0, color: "#5a3f2b", font: "700 86px" });
  boardTitle.position.set(0, 2.0, 0.056);
  board.add(boardTitle);
  board.position.set(BOARD.x, terrainHeight(BOARD.x, BOARD.z), BOARD.z);
  board.rotation.y = Math.atan2(-3.36 - BOARD.x, 20.53 - BOARD.z);
  scene.add(shadowed(board));
  colliders.push({ x: BOARD.x, z: BOARD.z, r: 1.3 });
  reserved.push([BOARD.x, BOARD.z, 2.2]);

  // --- 喂鱼的牌子和小桶
  const feed = new THREE.Group();
  const fpost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), woodD);
  fpost.position.y = 0.75;
  const fboard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.08), wood);
  fboard.position.y = 1.45;
  const ftext = textPlane("FEED THE FISH", { width: 1.35, color: "#ffffff", font: "800 96px" });
  ftext.position.set(0, 1.45, 0.045);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 14), mat("#7fb4cf"));
  bucket.position.set(0.7, 0.22, 0.2);
  feed.add(fpost, fboard, ftext, bucket);
  feed.position.set(FEED.x, terrainHeight(FEED.x, FEED.z), FEED.z);
  feed.rotation.y = Math.atan2(-FEED.x, 26.5 - FEED.z);
  scene.add(shadowed(feed));
  colliders.push({ x: FEED.x, z: FEED.z, r: 0.5 });
  reserved.push([FEED.x, FEED.z, 2], [FISH_ZONE.x, FISH_ZONE.z, FISH_ZONE.r + 2]);

  // --- 季节粒子（花瓣 / 萤火虫 / 落叶 / 雪）
  const P_COUNT = 320;
  const pPos = new Float32Array(P_COUNT * 3);
  const pSeed = new Float32Array(P_COUNT);
  const pr = rng(21);
  for (let i = 0; i < P_COUNT; i++) {
    pSeed[i] = pr();
    pPos.set([(pr() - 0.5) * 44, pr() * 14, (pr() - 0.5) * 44], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ map: dotTexture(true), size: 0.3, transparent: true, depthWrite: false, color: "#ffffff" });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  scene.add(particles);
  const MODES = {
    petals: { color: "#f7bfd0", size: 0.34, fall: 0.55, sway: 1.0, add: false },
    leaves: { color: "#eb9a55", size: 0.38, fall: 0.85, sway: 1.3, add: false },
    snow: { color: "#ffffff", size: 0.3, fall: 1.0, sway: 0.5, add: false },
    fluff: { color: "#ffffff", size: 0.16, fall: 0.12, sway: 0.7, add: false },
    fireflies: { color: "#ffe27a", size: 0.42, fall: 0, sway: 0.6, add: true },
  };
  let pMode = MODES.fluff;
  let pModeName = "";
  function setParticleMode(name) {
    if (name === pModeName) return;
    pModeName = name;
    pMode = MODES[name];
    pMat.color.set(pMode.color);
    pMat.size = pMode.size;
    pMat.blending = pMode.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    pMat.needsUpdate = true;
  }

  // --- 植物（一次性摆好，季节只换颜色）
  const veg = {};
  function scatterVegetation(specials = []) {
    const r = rng(7);
    const free = (x, z, clear) => {
      if (pathDistance(x, z) < clear + 0.3) return false;
      for (const s of STATIONS) if (Math.hypot(x - s.stop[0], z - s.stop[1]) < 4.6 + clear) return false;
      for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + clear) return false;
      for (const [rx, rz, rr] of reserved) if (Math.hypot(x - rx, z - rz) < rr + clear) return false;
      if (Math.abs(x) < 3.5 && z > 22) return false;
      return true;
    };
    const trees = { round: [], pine: [], blossom: [], kapok: [], palm: [] };
    for (const s of specials) trees[s.type].push([s.x, s.z, s.s ?? 1]);

    // 树只种在石板路外圈；路内是一片开阔的草地，镜头不会被挡住
    for (let tries = 0; tries < 1500 && trees.round.length + trees.pine.length < 85; tries++) {
      const a = r() * Math.PI * 2;
      const rad = 16 + r() * 14;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (rad > islandRadius(a) - 7.2) continue;
      if (!free(x, z, 1.5)) continue;
      const s = 0.75 + r() * 0.55;
      (r() < 0.28 ? trees.pine : trees.round).push([x, z, s]);
      colliders.push({ x, z, r: 0.45 * s });
    }
    for (let tries = 0; tries < 600 && trees.palm.length < 22; tries++) {
      const a = r() * Math.PI * 2;
      const R = islandRadius(a);
      const rad = R - 4.6 + r() * 2.8;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (Math.abs(x) < 6 && z > 18) continue;
      if (!free(x, z, 1.2)) continue;
      trees.palm.push([x, z, 0.85 + r() * 0.35]);
      colliders.push({ x, z, r: 0.35 });
    }
    for (const list of Object.values(trees)) for (const t of list) if (!colliders.some((c) => c.x === t[0] && c.z === t[1])) colliders.push({ x: t[0], z: t[1], r: 0.45 });

    const dummy = new THREE.Object3D();
    const place = (mesh, i, x, y, z, sx, sy = sx, sz = sx, ry = 0) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };
    const tint = new THREE.Color();
    const shade = (mesh, i) => mesh.setColorAt(i, tint.setScalar(0.86 + r() * 0.26));

    // 树干（所有落叶树共用）
    const leafy = [...trees.round.map((t) => ["round", t]), ...trees.blossom.map((t) => ["blossom", t]), ...trees.kapok.map((t) => ["kapok", t]), ...trees.pine.map((t) => ["pine", t])];
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.2, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, mat("#9a7458"), leafy.length);
    leafy.forEach(([type, [x, z, s]], i) => {
      const h = type === "kapok" ? 2.6 : type === "pine" ? 0.9 : 1.5;
      place(trunks, i, x, terrainHeight(x, z) - 0.05, z, s, h * s, s);
    });

    veg.leafMat = mat("#9fd486", { flatShading: true });
    veg.blossomMat = mat("#f5b9cc", { flatShading: true });
    veg.kapokMat = mat("#ec7f63", { flatShading: true });
    veg.pineMat = mat("#7fbf86", { flatShading: true });
    veg.bushMat = mat("#93c97f", { flatShading: true });

    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const makeCrowns = (list, material, fn) => {
      const m = new THREE.InstancedMesh(crownGeo, material, Math.max(list.length, 1));
      m.count = list.length;
      list.forEach(([x, z, s], i) => {
        fn(m, i, x, terrainHeight(x, z), z, s);
        shade(m, i);
      });
      return m;
    };
    const round = makeCrowns(trees.round, veg.leafMat, (m, i, x, y, z, s) => place(m, i, x, y + 2.1 * s, z, 1.25 * s, 1.15 * s, 1.25 * s, r() * 6));
    const blossom = makeCrowns(trees.blossom, veg.blossomMat, (m, i, x, y, z, s) => place(m, i, x, y + 2.0 * s, z, 1.35 * s, 1.05 * s, 1.35 * s, r() * 6));
    const kapok = makeCrowns(trees.kapok, veg.kapokMat, (m, i, x, y, z, s) => place(m, i, x, y + 3.1 * s, z, 1.6 * s, 0.75 * s, 1.6 * s, r() * 6));

    const pineGeo = mergeParts([
      { geo: new THREE.ConeGeometry(1.1, 1.8, 7), color: "#ffffff", matrix: m4(0, 1.6, 0) },
      { geo: new THREE.ConeGeometry(0.8, 1.5, 7), color: "#ffffff", matrix: m4(0, 2.5, 0) },
    ]);
    const pines = new THREE.InstancedMesh(pineGeo, veg.pineMat, Math.max(trees.pine.length, 1));
    pines.count = trees.pine.length;
    trees.pine.forEach(([x, z, s], i) => {
      place(pines, i, x, terrainHeight(x, z), z, s, s * 1.1, s, r() * 6);
      shade(pines, i);
    });

    // 椰子树：树干 + 叶子合成一个模型
    const palmParts = [];
    let px = 0;
    for (let k = 0; k < 6; k++) {
      palmParts.push({ geo: new THREE.CylinderGeometry(0.13, 0.17, 0.62, 7), color: k % 2 ? "#b98f68" : "#a87f5c", matrix: m4(px, 0.3 + k * 0.58, 0, 0, 0, -0.06) });
      px += 0.05 + k * 0.012;
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      palmParts.push({
        geo: new THREE.BoxGeometry(0.42, 0.05, 1.9),
        color: k % 2 ? "#7cc07a" : "#8fcd84",
        matrix: m4(px + Math.sin(a) * 0.85, 3.55 - 0.2, Math.cos(a) * 0.85, 0.42, a, 0),
      });
    }
    palmParts.push({ geo: new THREE.SphereGeometry(0.14, 6, 5), color: "#8a6a4a", matrix: m4(px + 0.12, 3.4, 0.1) });
    palmParts.push({ geo: new THREE.SphereGeometry(0.14, 6, 5), color: "#8a6a4a", matrix: m4(px - 0.08, 3.38, -0.12) });
    const palms = new THREE.InstancedMesh(mergeParts(palmParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), Math.max(trees.palm.length, 1));
    palms.count = trees.palm.length;
    trees.palm.forEach(([x, z, s], i) => place(palms, i, x, terrainHeight(x, z) - 0.05, z, s, s, s, r() * 6));

    // 灌木、小花、石头、珊瑚
    const bushList = [];
    for (let tries = 0; tries < 900 && bushList.length < 80; tries++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * 30;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (rad > islandRadius(a) - 6.8 || !free(x, z, 0.5)) continue;
      bushList.push([x, z, 0.35 + r() * 0.4]);
    }
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), veg.bushMat, bushList.length);
    bushList.forEach(([x, z, s], i) => {
      place(bushes, i, x, terrainHeight(x, z) + s * 0.45, z, s * 1.2, s * 0.85, s * 1.2, r() * 6);
      shade(bushes, i);
    });

    const flowerColors = ["#f6a5c0", "#ffffff", "#ffd66e", "#c9b6f2", "#ff9f8a"].map((c) => new THREE.Color(c));
    const flowerList = [];
    for (let c = 0; c < 40; c++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * 28;
      const cx = Math.cos(a) * rad;
      const cz = Math.sin(a) * rad;
      if (rad > islandRadius(a) - 7) continue;
      const color = flowerColors[Math.floor(r() * flowerColors.length)];
      for (let k = 0; k < 14; k++) {
        const x = cx + (r() - 0.5) * 3;
        const z = cz + (r() - 0.5) * 3;
        if (free(x, z, 0.15)) flowerList.push([x, z, color]);
      }
    }
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const rr = 2.6 + (k % 3) * 0.5;
      flowerList.push([Math.cos(a) * rr, Math.sin(a) * rr, flowerColors[k % flowerColors.length]]);
    }
    const flowerGeo = new THREE.IcosahedronGeometry(0.12, 0);
    const flowers = new THREE.InstancedMesh(flowerGeo, mat("#ffffff", { roughness: 0.6 }), flowerList.length);
    flowerList.forEach(([x, z, color], i) => {
      place(flowers, i, x, terrainHeight(x, z) + 0.12, z, 1);
      flowers.setColorAt(i, color);
    });
    veg.flowers = flowers;
    veg.flowerTotal = flowerList.length;

    const rockList = [];
    for (let k = 0; k < 60; k++) {
      const a = r() * Math.PI * 2;
      const R = islandRadius(a);
      const rad = R - 0.8 + r() * 9;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if ((Math.abs(x) < 4.5 && z > 22) || Math.hypot(x - FISH_ZONE.x, z - FISH_ZONE.z) < FISH_ZONE.r + 1) continue;
      rockList.push([x, z, 0.3 + r() * 0.6]);
    }
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat("#cfc5b8", { flatShading: true }), rockList.length);
    rockList.forEach(([x, z, s], i) => {
      place(rocks, i, x, terrainHeight(x, z) + s * 0.2, z, s, s * 0.7, s, r() * 6);
      shade(rocks, i);
    });

    const coralColors = ["#f7a9a0", "#ffc78f", "#f3b6d6", "#a8e0d0"].map((c) => new THREE.Color(c));
    const coralList = [];
    for (let k = 0; k < 70; k++) {
      const a = r() * Math.PI * 2;
      const rad = islandRadius(a) + 2.5 + r() * 6;
      coralList.push([Math.cos(a) * rad, Math.sin(a) * rad, 0.25 + r() * 0.35, coralColors[k % coralColors.length]]);
    }
    const corals = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat("#ffffff", { flatShading: true, roughness: 0.7 }), coralList.length);
    coralList.forEach(([x, z, s, color], i) => {
      place(corals, i, x, terrainHeight(x, z) + s * 0.4, z, s, s * 1.4, s, r() * 6);
      corals.setColorAt(i, color);
    });

    const all = [trunks, round, blossom, kapok, pines, palms, bushes, flowers, rocks, corals];
    for (const m of all) {
      m.castShadow = m !== flowers && m !== corals;
      m.receiveShadow = true;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      scene.add(m);
    }
    if (season) applySeason(season, true);
  }

  function applySeason(name, force = false) {
    if (name === season && !force) return;
    season = name;
    const S = SEASON_STYLE[name];
    paintTerrain(S);
    if (veg.leafMat) {
      veg.leafMat.color.set(S.leaf);
      veg.blossomMat.color.set(S.blossom);
      veg.kapokMat.color.set(S.kapok);
      veg.pineMat.color.set(S.pine);
      veg.bushMat.color.set(S.bush);
      veg.flowers.count = Math.round(veg.flowerTotal * S.flowers);
    }
  }

  // --- 设置季节和时间（来自访客的时钟，或者预览）
  const sunDir = new THREE.Vector3();
  let night = 0;
  function setEnvironment(seasonName, hour) {
    applySeason(seasonName);
    const k = sampleTime(hour);
    night = k.night;
    skyUniforms.uTop.value.copy(k.skyTop);
    skyUniforms.uBottom.value.copy(k.skyBottom);
    hemi.color.copy(k.hemiSky);
    hemi.groundColor.copy(k.hemiGround);
    hemi.intensity = k.hemi;
    sun.color.copy(k.sun);
    sun.intensity = k.sunI;
    const dayT = (hour - 6) / 12;
    if (dayT > -0.04 && dayT < 1.04) {
      const a = clamp(dayT, 0, 1) * Math.PI;
      sunDir.set(Math.cos(a) * 0.8, Math.max(Math.sin(a), 0.14), 0.55).normalize();
    } else {
      sunDir.set(-0.35, 0.8, 0.45).normalize();
    }
    sun.position.copy(sunDir).multiplyScalar(90);
    sunSprite.position.copy(sunDir).multiplyScalar(560);
    sunSprite.material.color.copy(night > 0.5 ? new THREE.Color("#e8eeff") : k.sun);
    sunSprite.scale.setScalar(night > 0.5 ? 34 : 60);
    waterUniforms.uShallow.value.copy(k.shallow);
    waterUniforms.uDeep.value.copy(k.deep);
    waterUniforms.uFoam.value.copy(k.foam);
    waterUniforms.uSky.value.copy(k.skyBottom);
    waterUniforms.uNight.value = night;
    starMat.opacity = smoothstep(0.4, 0.9, night);
    cloudMat.color.set("#ffffff").lerp(new THREE.Color("#7f8ab8"), night * 0.8);
    cloudMat.emissiveIntensity = 0.25 * (1 - night);
    for (const { material, strength } of nightGlow) material.emissiveIntensity = smoothstep(0.15, 0.8, night) * strength;
    glowMat.opacity = smoothstep(0.2, 0.8, night) * 0.85;
    beamMat.opacity = smoothstep(0.4, 0.9, night) * 0.16;
    const S = SEASON_STYLE[seasonName];
    setParticleMode(S.particles === "summer" ? (night > 0.5 ? "fireflies" : "fluff") : S.particles);
    return night;
  }

  // --- 每一帧
  function update(dt, t, focus) {
    waterUniforms.uTime.value = t;
    clouds.rotation.y = t * 0.004;
    for (const f of floaters) f.position.y = f.userData.base + Math.sin(t * 0.6 + f.userData.phase) * 0.6;
    beamPivot.rotation.y = t * 0.8;
    const arr = pGeo.attributes.position.array;
    const fire = pModeName === "fireflies";
    for (let i = 0; i < P_COUNT; i++) {
      const s = pSeed[i];
      let x = arr[i * 3];
      let y = arr[i * 3 + 1];
      let z = arr[i * 3 + 2];
      if (fire) {
        x += Math.sin(t * 0.7 + s * 40) * dt * pMode.sway;
        z += Math.cos(t * 0.6 + s * 31) * dt * pMode.sway;
        y = focus.y + 0.6 + ((s * 7.3) % 2.6) + Math.sin(t * 1.3 + s * 20) * 0.3;
      } else {
        y -= pMode.fall * dt * (0.6 + s);
        x += Math.sin(t * 0.8 + s * 10) * pMode.sway * dt;
        z += Math.cos(t * 0.5 + s * 13) * pMode.sway * dt * 0.6;
      }
      const dx = x - focus.x;
      const dz = z - focus.z;
      if (y < focus.y - 1 || Math.abs(dx) > 22 || Math.abs(dz) > 22) {
        x = focus.x + (pr() - 0.5) * 44;
        z = focus.z + (pr() - 0.5) * 44;
        y = focus.y + (fire ? 1 : 6 + pr() * 9);
      }
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.opacity = fire ? 0.55 + 0.45 * Math.sin(t * 3) : 0.9;
    for (const u of updaters) u(dt, t);
  }

  function walkable(x, z, rad = 0.35) {
    if (Math.hypot(x, z) > DISK_R - 1.5) return false;
    if (!onPier(x, z) && terrainHeight(x, z) < -0.15) return false;
    for (const c of colliders) {
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = c.r + rad;
      if (dx * dx + dz * dz < rr * rr) return false;
    }
    return true;
  }

  return {
    colliders,
    reserved,
    curve,
    addPathStrip,
    pathDistance,
    scatterVegetation,
    setEnvironment,
    update,
    walkable,
    onUpdate: (fn) => updaters.push(fn),
    get night() {
      return night;
    },
  };
}
