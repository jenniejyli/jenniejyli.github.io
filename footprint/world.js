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

export const SEA_HALF = 50; // 方形果冻海的一半宽度
const EDGE_Y = -3.5; // 果冻块底部（海床边缘）的高度
const SEABED = -3.2; // 浅海海床的深度
const HOLE = { x: 31, z: 31, r: 5.5, depth: -11 }; // 角落里的"蓝洞"
export const PIER = { x0: -1.6, x1: 1.6, z0: 25, z1: 39.4, y: 0.55, endZ: 41.6, endR: 3.4 };
export const BOARD = { x: -6, z: 22 };
export const FEED = { x: 8.3, z: 29.3 };
export const FISH_ZONE = { x: 10, z: 35.1, r: 2.6 };
const GARDEN_GATES = [5, 90, 175, 270]; // 中间花园四个入口的方向（度）

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
  // 浅浅的沙底（带一点起伏），角落里有一个深蓝洞
  let y = SEABED * smoothstep(R, R + 10, r) + (fbm2(x * 0.12, z * 0.12) - 0.5) * 0.5 * smoothstep(R + 2, R + 8, r);
  const hd = Math.hypot(x - HOLE.x, z - HOLE.z);
  if (hd < HOLE.r + 2) y = lerp(HOLE.depth, y, smoothstep(HOLE.r - 1.5, HOLE.r + 1.5, hd));
  return y;
}

export function onPier(x, z) {
  return (x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1) || Math.hypot(x, z - PIER.endZ) < PIER.endR;
}

export function groundHeight(x, z) {
  const h = terrainHeight(x, z);
  return onPier(x, z) ? Math.max(PIER.y, h) : h;
}

// ===== 四季 =====
// 春天樱花，夏天椰树，秋天银杏 + 枫叶，冬天下雪 + 松树

export const SEASON_STYLE = {
  spring: { grass: "#a9d68e", grass2: "#c6e6a6", tuft: "#94c97a", crown: ["#f6bccd", "#fbdbe5"], blossom: "#f5b9cc", kapok: "#ec7f63", pine: "#ffffff", bush: "#93c97f", hedge: "#86c074", flowers: 1, particles: "petals" },
  summer: { grass: "#8ccb7c", grass2: "#a6d88d", tuft: "#79b86a", crown: ["#7cc06f", "#93cc7b"], blossom: "#f3aac2", kapok: "#7cbc69", pine: "#ffffff", bush: "#7dbd6e", hedge: "#6fae63", flowers: 1, particles: "summer" },
  autumn: { grass: "#b5cf80", grass2: "#c9d48c", tuft: "#a3bf6c", crown: ["#f3c64c", "#e5653f"], blossom: "#eca487", kapok: "#e4b75c", pine: "#f2f2e6", bush: "#9cc46c", hedge: "#8db866", flowers: 0.6, particles: "leaves" },
  winter: { grass: "#e6edf1", grass2: "#f6f9fb", tuft: "#dbe5ea", crown: ["#e8eff3", "#e8eff3"], blossom: "#eef1f5", kapok: "#dfe5e9", pine: "#ffffff", bush: "#dde7ec", hedge: "#d3e1e6", flowers: 0, particles: "snow" },
};

export function seasonOf(date) {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

// ===== 早晚 =====

const NIGHT = { skyTop: "#13204a", skyBottom: "#33467a", hemiSky: "#7085c0", hemiGround: "#313a58", hemi: 1.35, sun: "#b4c4ff", sunI: 0.95, shallow: "#6aa5b8", mid: "#2d7393", deep: "#15325c", foam: "#d6e6ff", night: 1, caustic: 0.12 };
const DAWN = { skyTop: "#b4cdea", skyBottom: "#fbe2d0", hemiSky: "#dce4f4", hemiGround: "#a3928a", hemi: 1.45, sun: "#ffd2ad", sunI: 2.0, shallow: "#c9efe2", mid: "#5cc9cf", deep: "#2c6fa6", foam: "#fff6ee", night: 0.15, caustic: 0.35 };
const DAY = { skyTop: "#b9def0", skyBottom: "#f3f1ea", hemiSky: "#e8f4ff", hemiGround: "#b8ab95", hemi: 1.6, sun: "#fff6e8", sunI: 2.6, shallow: "#b4f5e8", mid: "#46d2cf", deep: "#1f78b0", foam: "#ffffff", night: 0, caustic: 0.55 };
const DUSK = { skyTop: "#9fa3dc", skyBottom: "#f8cdbd", hemiSky: "#ecd0dc", hemiGround: "#8c7872", hemi: 1.25, sun: "#ffb48c", sunI: 1.8, shallow: "#d6e6e0", mid: "#5fb5c9", deep: "#2f5f9a", foam: "#fff1e8", night: 0.3, caustic: 0.3 };
const BLUE = { skyTop: "#2b3c76", skyBottom: "#8584bd", hemiSky: "#8a9ad0", hemiGround: "#40405a", hemi: 1.25, sun: "#c3b6ff", sunI: 0.8, shallow: "#8fb9c9", mid: "#3f8aa5", deep: "#1d3f72", foam: "#e6e6ff", night: 0.75, caustic: 0.15 };
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
const COLOR_KEYS = ["skyTop", "skyBottom", "hemiSky", "hemiGround", "sun", "shallow", "mid", "deep", "foam"];

function sampleTime(hour) {
  let i = 0;
  while (i < TIME_KEYS.length - 2 && hour >= TIME_KEYS[i + 1][0]) i++;
  const [h0, a] = TIME_KEYS[i];
  const [h1, b] = TIME_KEYS[i + 1];
  const t = smoothstep(0, 1, (hour - h0) / (h1 - h0));
  const out = {};
  for (const k of COLOR_KEYS) out[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  for (const k of ["hemi", "sunI", "night", "caustic"]) out[k] = lerp(a[k], b[k], t);
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

// 海底的光斑（焦散）
const CAUSTIC_GLSL = /* glsl */ `
float caustic(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return min(pow(abs(c), 8.0), 1.0);
}`;

// 水面高度：慢慢起伏 + 涟漪（点水面、喂鱼、踩水都会"duang"一下）
const WAVE_GLSL = /* glsl */ `
uniform float uTime;
uniform float uHalf;
uniform vec4 uRipples[8];
float waveH(vec2 p) {
  float h = sin(p.x * 0.16 + uTime * 0.8) * 0.05
          + sin(p.y * 0.21 - uTime * 0.65) * 0.05
          + sin((p.x + p.y) * 0.5 + uTime * 1.7) * 0.015;
  for (int i = 0; i < 8; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 4.5) continue;
    float d = distance(p, r.xy);
    float front = 1.0 - smoothstep(age * 5.0 - 1.4, age * 5.0 + 0.6, d);
    h += r.w * sin(d * 2.2 - age * 8.0) * exp(-age * 1.2) * exp(-d * 0.1) * front;
  }
  return h * (1.0 - smoothstep(uHalf - 3.0, uHalf - 0.2, max(abs(p.x), abs(p.y))));
}`;

const WATER_VERT = /* glsl */ `
${WAVE_GLSL}
varying vec3 vWorld;
varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float h = waveH(w.xz);
  float e = 0.35;
  float hx = waveH(w.xz + vec2(e, 0.0));
  float hz = waveH(w.xz + vec2(0.0, e));
  vN = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
  w.y += h;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uHalf;
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform sampler2D uDepth;
varying vec3 vWorld;
varying vec3 vN;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = vWorld.xz / (2.0 * uHalf) + 0.5;
  float d = texture2D(uDepth, uv).r;
  vec3 col = mix(uShallow, uMid, smoothstep(0.0, 0.42, d));
  col = mix(col, uDeep, smoothstep(0.55, 0.95, d));
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  // 果冻的光泽：朝着光的一面亮一点，再加一个高光
  col += max(dot(N, uSunDir), 0.0) * 0.05;
  float spec = pow(max(dot(N, normalize(V + uSunDir)), 0.0), 160.0) * (1.0 - uNight * 0.5);
  float fr = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col = mix(col, uSky, fr * 0.3);
  // 沙滩边的浪花
  float edgeW = 0.025 + 0.012 * sin(uTime * 1.6 + vWorld.x * 0.4 + vWorld.z * 0.3);
  float foam = 1.0 - smoothstep(edgeW * 0.35, edgeW, d);
  col = mix(col, uFoam, foam * 0.85);
  // 一闪一闪的亮点
  vec2 gp = vWorld.xz * 0.7;
  vec2 cell = floor(gp);
  float rnd = hash(cell);
  vec2 c = vec2(hash(cell + 3.7), hash(cell + 9.1)) * 0.7 + 0.15;
  float tw = pow(0.5 + 0.5 * sin(uTime * (1.5 + rnd * 2.5) + rnd * 50.0), 10.0);
  col += step(0.88, rnd) * (1.0 - smoothstep(0.0, 0.09, length(fract(gp) - c))) * tw * 0.8;
  col += spec * uSun * 1.3;
  float alpha = mix(0.26, 0.55, smoothstep(0.0, 0.5, d));
  alpha = mix(alpha, 0.9, smoothstep(0.6, 1.0, d));
  alpha = clamp(max(alpha, foam * 0.9) + spec, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WALL_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WALL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uMid;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  float t = vUv.y;
  vec3 col = mix(uMid * 0.82, mix(uMid, uShallow, 0.45), t);
  // 玻璃一样的亮边
  float rim = smoothstep(0.88, 1.0, t);
  float side = smoothstep(0.985, 1.0, max(vUv.x, 1.0 - vUv.x));
  col = mix(col, vec3(1.0), max(rim, side) * 0.55);
  col += pow(max(sin(vUv.x * 90.0 + t * 2.0 + uTime * 0.4), 0.0), 18.0) * 0.06;
  gl_FragColor = vec4(col, mix(0.62, 0.4, t) + max(rim, side) * 0.3);
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
  sc.left = -52;
  sc.right = 52;
  sc.top = 52;
  sc.bottom = -52;
  sc.near = 1;
  sc.far = 220;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // --- 果冻海的共用参数
  const ripples = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0));
  const waterUniforms = {
    uTime: { value: 0 },
    uNight: { value: 0 },
    uHalf: { value: SEA_HALF },
    uRipples: { value: ripples },
    uShallow: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color() },
    uSky: { value: new THREE.Color() },
    uSun: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uDepth: { value: null },
  };
  let rippleNext = 0;
  function ripple(x, z, amp = 0.15) {
    ripples[rippleNext].set(x, z, waterUniforms.uTime.value, amp);
    rippleNext = (rippleNext + 1) % ripples.length;
  }

  // --- 地形（方形网格，边缘就是果冻块的底）
  const N = lowPower ? 170 : 220;
  const terrainGeo = new THREE.PlaneGeometry(SEA_HALF * 2, SEA_HALF * 2, N, N);
  terrainGeo.rotateX(-Math.PI / 2);
  const tp = terrainGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const z = tp.getZ(i);
    const edge = Math.abs(x) > SEA_HALF - 0.01 || Math.abs(z) > SEA_HALF - 0.01;
    tp.setY(i, edge ? EDGE_Y : terrainHeight(x, z));
  }
  terrainGeo.computeVertexNormals();
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(tp.count * 3), 3));
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const seabedUniforms = { uTime: waterUniforms.uTime, uTint: { value: new THREE.Color("#7fdcd6") }, uCaustic: { value: 0.5 } };
  terrainMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, seabedUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform vec3 uTint;\nuniform float uCaustic;\n${CAUSTIC_GLSL}`)
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        float under = 1.0 - smoothstep(-0.35, 0.02, vWPos.y);
        float depth01 = clamp(-vWPos.y / 9.0, 0.0, 1.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * uTint, under * (0.45 + 0.5 * depth01));
        gl_FragColor.rgb += caustic(mod(vWPos.xz * 0.5, 6.28318) - 250.0, uTime * 0.55) * under * uCaustic * 1.8 * (1.0 - depth01);`,
      );
  };
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  const SAND = new THREE.Color("#f1e0b8");
  const SAND_WET = new THREE.Color("#e3cfa2");
  const SEABED_SAND = new THREE.Color("#f3e6c4");
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
      if (y < -0.05) c.copy(SEABED_SAND).lerp(SAND_WET, fbm2(x * 0.2, z * 0.2) * 0.5);
      else {
        c.copy(g1).lerp(g2, fbm2(x * 0.14, z * 0.14));
        c.lerp(y < 0.12 ? SAND_WET : SAND, 1 - smoothstep(0.42, 0.62, y));
      }
      col[i] = c.r;
      col[i + 1] = c.g;
      col[i + 2] = c.b;
    }
    terrainGeo.attributes.color.needsUpdate = true;
  }

  // --- 果冻海：水面 + 四面透明的侧壁
  const DT = 256;
  const depthData = new Uint8Array(DT * DT * 4);
  for (let j = 0; j < DT; j++) {
    for (let i = 0; i < DT; i++) {
      const x = -SEA_HALF + ((i + 0.5) * 2 * SEA_HALF) / DT;
      const z = -SEA_HALF + ((j + 0.5) * 2 * SEA_HALF) / DT;
      const v = Math.round(clamp(-terrainHeight(x, z) / 6, 0, 1) * 255);
      depthData.set([v, v, v, 255], (j * DT + i) * 4);
    }
  }
  const depthTex = new THREE.DataTexture(depthData, DT, DT, THREE.RGBAFormat);
  depthTex.magFilter = THREE.LinearFilter;
  depthTex.minFilter = THREE.LinearFilter;
  depthTex.needsUpdate = true;
  waterUniforms.uDepth.value = depthTex;

  const waterGeo = new THREE.PlaneGeometry(SEA_HALF * 2, SEA_HALF * 2, lowPower ? 120 : 170, lowPower ? 120 : 170);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false }),
  );
  water.renderOrder = 2;
  scene.add(water);

  const wallMat = new THREE.ShaderMaterial({
    uniforms: { uTime: waterUniforms.uTime, uShallow: waterUniforms.uShallow, uMid: waterUniforms.uMid },
    vertexShader: WALL_VERT,
    fragmentShader: WALL_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const wallH = -EDGE_Y;
  for (const [x, z, ry] of [
    [0, SEA_HALF, 0],
    [SEA_HALF, 0, Math.PI / 2],
    [0, -SEA_HALF, Math.PI],
    [-SEA_HALF, 0, -Math.PI / 2],
  ]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(SEA_HALF * 2, wallH), wallMat);
    w.position.set(x, EDGE_Y / 2, z);
    w.rotation.y = ry;
    w.renderOrder = 1;
    scene.add(w);
  }

  // --- 果冻块下面的土层：沙 → 浅棕 → 棕 → 深棕
  const strata = [
    [EDGE_Y, -5.0, "#efd9ad"],
    [-5.0, -7.2, "#d6ae82"],
    [-7.2, -9.8, "#a77b5a"],
    [-9.8, -12.8, "#7b5944"],
  ];
  for (const [top, bottom, color] of strata) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(SEA_HALF * 2, top - bottom, SEA_HALF * 2), mat(color, { roughness: 1 }));
    m.position.y = (top + bottom) / 2;
    scene.add(m);
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
      const p = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), cloudMat);
      p.position.set((k - n / 2) * 3.6 + cl() * 2, cl() * 2.4, cl() * 3);
      p.scale.y = 0.75;
      g.add(p);
    }
    const a = (i / 10) * Math.PI * 2 + cl();
    const r = 90 + cl() * 45;
    g.position.set(Math.cos(a) * r, -8 + cl() * 30, Math.sin(a) * r);
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
  ribbon(curve.getSpacedPoints(700).slice(0, 700), PATH_W, true);

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

  // --- 中间的小花园：凉亭、花坛、矮树篱、石板小路
  const gy = terrainHeight(0, 0);
  const gazebo = new THREE.Group();
  const stoneWhite = mat("#f7f3ea");
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.15, 0.28, 36), mat("#ece2cf"));
  floor.position.y = 0.1;
  gazebo.add(floor);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.1, 12), stoneWhite);
    pillar.position.set(Math.cos(a) * 1.55, 1.3, Math.sin(a) * 1.55);
    gazebo.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.09, 8, 40), stoneWhite);
  beam.rotation.x = Math.PI / 2;
  beam.position.y = 2.36;
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.35, 40), mat("#f2a8a3", { roughness: 0.7 }));
  roofMesh.position.y = 3.05;
  const roofRim = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.08, 8, 40), mat("#f7c7c2"));
  roofRim.rotation.x = Math.PI / 2;
  roofRim.position.y = 2.4;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat("#ffd27a", { roughness: 0.4 }));
  finial.position.y = 3.8;
  const lanternMatG = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffd27a", emissiveIntensity: 0, roughness: 0.4 }), 2.2);
  const hanging = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), lanternMatG);
  hanging.position.y = 1.95;
  gazebo.add(beam, roofMesh, roofRim, finial, hanging);
  gazebo.position.set(0, gy, 0);
  scene.add(shadowed(gazebo));
  colliders.push({ x: 0, z: 0, r: 2.2 });

  // 花坛的土（贴着地面）
  function groundRing(r0, r1, color, segs = 72) {
    const pos = [];
    const idx = [];
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      for (const r of [r0, r1]) {
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        pos.push(x, terrainHeight(x, z) + 0.05, z);
      }
    }
    for (let j = 0; j < segs; j++) {
      const a = j * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat(color, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    scene.add(m);
  }
  groundRing(2.75, 4.5, "#b99872");

  const hedgeMat = mat("#86c074", { roughness: 0.9 });
  const HEDGE_R = 5.7;
  const hedgeY = terrainHeight(HEDGE_R, 0) + 0.18;
  const gates = GARDEN_GATES.map((d) => (d * Math.PI) / 180).sort((a, b) => a - b);
  for (let k = 0; k < gates.length; k++) {
    const from = gates[k] + 0.2;
    const to = (k + 1 < gates.length ? gates[k + 1] : gates[0] + Math.PI * 2) - 0.2;
    const hedge = new THREE.Mesh(new THREE.TorusGeometry(HEDGE_R, 0.36, 10, 48, to - from), hedgeMat);
    hedge.rotation.x = Math.PI / 2;
    hedge.rotation.z = from;
    hedge.scale.z = 1.25;
    hedge.position.y = hedgeY;
    hedge.castShadow = hedge.receiveShadow = true;
    scene.add(hedge);
    for (let a = from; a <= to; a += 0.16) colliders.push({ x: Math.cos(a) * HEDGE_R, z: Math.sin(a) * HEDGE_R, r: 0.45 });
  }
  reserved.push([0, 0, 6.3]);
  for (const a of gates) {
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    addPathStrip(dir.clone().multiplyScalar(4.6), dir.clone().multiplyScalar(11.6), 1.4);
  }
  const bench = (deg) => {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * 7.2;
    const z = Math.sin(a) * 7.2;
    const g = new THREE.Group();
    const wood = mat("#c69a6e");
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), wood);
    seat.position.y = 0.48;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.08), wood);
    back.position.set(0, 0.78, -0.22);
    g.add(seat, back);
    for (const sx of [-0.68, 0.68]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.45), mat("#6d7480"));
      leg.position.set(sx, 0.24, 0);
      g.add(leg);
    }
    g.position.set(x, terrainHeight(x, z), z);
    g.rotation.y = Math.atan2(-x, -z);
    scene.add(shadowed(g));
    colliders.push({ x, z, r: 0.7 });
  };
  bench(150);
  bench(330);

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
  const deck = new THREE.Mesh(new THREE.BoxGeometry(PIER.x1 - PIER.x0, 0.25, pierLen), new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }));
  deck.position.set(0, PIER.y - 0.125, (PIER.z0 + PIER.z1) / 2);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(PIER.endR, PIER.endR, 0.25, 32), mat("#d4b089", { roughness: 0.9 }));
  platform.position.set(0, PIER.y - 0.125, PIER.endZ);
  const woodDark = mat("#9c7656");
  const pier = new THREE.Group();
  pier.add(deck, platform);
  for (let z = PIER.z0 + 3; z < PIER.z1; z += 2.4) {
    for (const x of [PIER.x0 + 0.15, PIER.x1 - 0.15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 4.6, 8), woodDark);
      post.position.set(x, PIER.y - 2.35, z);
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
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.6, 8), woodDark);
    post.position.set(Math.cos(a) * (PIER.endR - 0.25), PIER.y - 2.35, PIER.endZ + Math.sin(a) * (PIER.endR - 0.25));
    pier.add(post);
  }
  scene.add(shadowed(pier));

  const lh = new THREE.Group();
  const coral = mat("#ec9384");
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.5, 24), mat("#c9bdb0"));
  lhBase.position.y = 0.25;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.85, 4.2, 24), mat("#f7f4ee"));
  body.position.y = 2.6;
  lh.add(lhBase, body);
  for (const y of [1.3, 2.6, 3.9]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.66 + (4.7 - y) * 0.055, 0.7 + (4.7 - y) * 0.055, 0.42, 24), coral);
    band.position.y = y;
    lh.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 24), mat("#6d7480"));
  gallery.position.y = 4.78;
  const lanternMat = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#fff7d6", emissive: "#ffd779", emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.9 }), 2.5);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.75, 16), lanternMat);
  lantern.position.y = 5.25;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.85, 24), coral);
  cap.position.y = 6.05;
  lh.add(gallery, lantern, cap);
  const beamMat = new THREE.MeshBasicMaterial({ color: "#fff1b8", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const lightBeam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 22, 24, 1, true), beamMat);
  lightBeam.geometry.translate(0, -11, 0);
  lightBeam.rotation.z = Math.PI / 2;
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 5.25;
  beamPivot.add(lightBeam);
  lh.add(beamPivot);
  lh.position.set(2.6, PIER.y, PIER.endZ + 1.2);
  scene.add(shadowed(lh));
  colliders.push({ x: lh.position.x, z: lh.position.z, r: 1.0 });

  // --- 路灯
  const lampHeadMat = glowsAtNight(new THREE.MeshStandardMaterial({ color: "#fff6dd", emissive: "#ffd27a", emissiveIntensity: 0, roughness: 0.4 }), 2.4);
  const lampPostMat = mat("#5d6672");
  const glowMat = new THREE.SpriteMaterial({ map: dotTexture(true), color: "#ffd88f", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
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
  for (const z of [30, 36]) lamp(PIER.x0 + 0.15, z + 1.2, PIER.y);

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
  ["#fff7d6", "#ffe1e8", "#e2f1ff", "#e8f7df"].forEach((c, i) => {
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
  const P_COUNT = 360;
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
    leaves: { color: "#efa64f", size: 0.4, fall: 0.85, sway: 1.3, add: false },
    snow: { color: "#ffffff", size: 0.32, fall: 1.0, sway: 0.5, add: false },
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

  // --- 植物：每个"树位"按季节换成不同的树
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
    // 内陆树位（落叶树 / 松树）和沙滩树位（夏天是椰树）
    const inland = [];
    const pines = [];
    const beach = [];
    const special = { blossom: [], kapok: [] };
    for (const s of specials) {
      if (s.type === "palm") beach.push([s.x, s.z, s.s ?? 1]);
      else if (s.type === "round") inland.push([s.x, s.z, s.s ?? 1]);
      else special[s.type].push([s.x, s.z, s.s ?? 1]);
      colliders.push({ x: s.x, z: s.z, r: 0.45 });
    }
    // 花园里的小树（避开站点和镜头的方向）
    for (const [deg, type] of [
      [35, "blossom"],
      [62, "round"],
      [150, "round"],
      [197, "blossom"],
      [245, "round"],
      [294, "blossom"],
      [341, "round"],
    ]) {
      const a = (deg * Math.PI) / 180;
      const x = Math.cos(a) * 8.8;
      const z = Math.sin(a) * 8.8;
      (type === "blossom" ? special.blossom : inland).push([x, z, 0.68]);
      colliders.push({ x, z, r: 0.35 });
    }
    for (let tries = 0; tries < 1800 && inland.length + pines.length < 115; tries++) {
      const a = r() * Math.PI * 2;
      const rad = 16 + r() * 14;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (rad > islandRadius(a) - 7.2 || !free(x, z, 1.5)) continue;
      const s = 0.75 + r() * 0.55;
      (r() < 0.25 ? pines : inland).push([x, z, s]);
      colliders.push({ x, z, r: 0.45 * s });
    }
    for (let tries = 0; tries < 700 && beach.length < 24; tries++) {
      const a = r() * Math.PI * 2;
      const rad = islandRadius(a) - 4.6 + r() * 2.8;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if ((Math.abs(x) < 6 && z > 18) || !free(x, z, 1.2)) continue;
      beach.push([x, z, 0.85 + r() * 0.35]);
      colliders.push({ x, z, r: 0.35 });
    }

    const dummy = new THREE.Object3D();
    const place = (mesh, i, x, y, z, sx, sy = sx, sz = sx, ry = 0) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };
    const instanced = (geo, material, list, fn) => {
      const m = new THREE.InstancedMesh(geo, material, Math.max(list.length, 1));
      m.count = list.length;
      list.forEach(([x, z, s], i) => fn(m, i, x, terrainHeight(x, z), z, s));
      return m;
    };

    // 蓬松的树冠：几个球合在一起
    const crownGeo = mergeParts([
      { geo: new THREE.SphereGeometry(1, 16, 12), color: "#fff" },
      { geo: new THREE.SphereGeometry(0.74, 14, 10), color: "#fff", matrix: m4(0.66, -0.2, 0.22) },
      { geo: new THREE.SphereGeometry(0.72, 14, 10), color: "#fff", matrix: m4(-0.6, -0.16, -0.26) },
      { geo: new THREE.SphereGeometry(0.66, 14, 10), color: "#fff", matrix: m4(0.06, 0.52, -0.12) },
      { geo: new THREE.SphereGeometry(0.6, 14, 10), color: "#fff", matrix: m4(-0.2, -0.1, 0.62) },
    ]);
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 8);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = mat("#9a7458");

    // 落叶树（春樱花 / 夏绿树 / 秋银杏枫叶）：内陆在前，沙滩在后（夏天只画内陆的）
    const decid = [...inland, ...beach];
    veg.inlandCount = inland.length;
    veg.decidCount = decid.length;
    veg.trunks = instanced(trunkGeo, trunkMat, decid, (m, i, x, y, z, s) => place(m, i, x, y - 0.05, z, s, 1.5 * s, s));
    veg.crownMat = mat("#ffffff", { roughness: 0.85 });
    veg.crowns = instanced(crownGeo, veg.crownMat, decid, (m, i, x, y, z, s) => place(m, i, x, y + 2.2 * s, z, 1.2 * s, 1.1 * s, 1.2 * s, r() * 6));
    veg.crownShade = decid.map(() => 0.9 + r() * 0.2);
    veg.crowns.setColorAt(0, new THREE.Color());

    // 特别的树：港科大（广州）的粉色花树、广外的木棉
    const specTrunks = [...special.blossom.map((t) => [t, 1.5]), ...special.kapok.map((t) => [t, 2.6])];
    const st = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(specTrunks.length, 1));
    st.count = specTrunks.length;
    specTrunks.forEach(([[x, z, s], h], i) => place(st, i, x, terrainHeight(x, z) - 0.05, z, s, h * s, s));
    veg.blossomMat = mat("#f5b9cc", { roughness: 0.85 });
    veg.kapokMat = mat("#ec7f63", { roughness: 0.85 });
    const blossoms = instanced(crownGeo, veg.blossomMat, special.blossom, (m, i, x, y, z, s) => place(m, i, x, y + 2.1 * s, z, 1.3 * s, 1.0 * s, 1.3 * s, r() * 6));
    const kapoks = instanced(crownGeo, veg.kapokMat, special.kapok, (m, i, x, y, z, s) => place(m, i, x, y + 3.2 * s, z, 1.5 * s, 0.75 * s, 1.5 * s, r() * 6));

    // 松树（平时绿，冬天带雪）；冬天所有树位都换成雪松
    const pineParts = (snow) => [
      { geo: new THREE.CylinderGeometry(0.12, 0.18, 1.0, 8), color: "#8c6a50", matrix: m4(0, 0.5, 0) },
      { geo: new THREE.ConeGeometry(1.15, 1.8, 10), color: "#5f9e6e", matrix: m4(0, 1.6, 0) },
      { geo: new THREE.ConeGeometry(0.85, 1.5, 10), color: "#6aa877", matrix: m4(0, 2.45, 0) },
      { geo: new THREE.ConeGeometry(0.55, 1.1, 10), color: "#74b07f", matrix: m4(0, 3.15, 0) },
      ...(snow
        ? [
            { geo: new THREE.ConeGeometry(0.62, 0.62, 10), color: "#f6f9fb", matrix: m4(0, 2.0, 0) },
            { geo: new THREE.ConeGeometry(0.46, 0.5, 10), color: "#f6f9fb", matrix: m4(0, 2.78, 0) },
            { geo: new THREE.ConeGeometry(0.3, 0.42, 10), color: "#ffffff", matrix: m4(0, 3.5, 0) },
          ]
        : []),
    ];
    veg.pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    veg.pines = instanced(mergeParts(pineParts(false)), veg.pineMat, pines, (m, i, x, y, z, s) => place(m, i, x, y - 0.05, z, s, s * 1.1, s, r() * 6));
    const allSlots = [...inland, ...beach, ...pines];
    veg.snowPines = instanced(mergeParts(pineParts(true)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), allSlots, (m, i, x, y, z, s) => place(m, i, x, y - 0.05, z, s, s * 1.15, s, r() * 6));

    // 椰子树（夏天的沙滩）
    const palmParts = [];
    let px = 0;
    for (let k = 0; k < 6; k++) {
      palmParts.push({ geo: new THREE.CylinderGeometry(0.13, 0.17, 0.62, 8), color: k % 2 ? "#b98f68" : "#a87f5c", matrix: m4(px, 0.3 + k * 0.58, 0, 0, 0, -0.06) });
      px += 0.05 + k * 0.012;
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      palmParts.push({
        geo: new THREE.BoxGeometry(0.42, 0.05, 1.9),
        color: k % 2 ? "#7cc07a" : "#8fcd84",
        matrix: m4(px + Math.sin(a) * 0.85, 3.35, Math.cos(a) * 0.85, 0.42, a, 0),
      });
    }
    palmParts.push({ geo: new THREE.SphereGeometry(0.14, 8, 6), color: "#8a6a4a", matrix: m4(px + 0.12, 3.4, 0.1) });
    palmParts.push({ geo: new THREE.SphereGeometry(0.14, 8, 6), color: "#8a6a4a", matrix: m4(px - 0.08, 3.38, -0.12) });
    veg.palms = instanced(mergeParts(palmParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), beach, (m, i, x, y, z, s) =>
      place(m, i, x, y - 0.05, z, s, s, s, r() * 6),
    );

    // 圆圆的灌木
    const bushGeo = mergeParts([
      { geo: new THREE.SphereGeometry(1, 14, 10), color: "#fff" },
      { geo: new THREE.SphereGeometry(0.72, 12, 9), color: "#fff", matrix: m4(0.75, -0.18, 0.1) },
      { geo: new THREE.SphereGeometry(0.66, 12, 9), color: "#fff", matrix: m4(-0.7, -0.2, -0.15) },
    ]);
    const bushList = [];
    for (let tries = 0; tries < 1400 && bushList.length < 120; tries++) {
      const a = r() * Math.PI * 2;
      const rad = 6.4 + Math.sqrt(r()) * 24;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (rad > islandRadius(a) - 6.8 || !free(x, z, 0.5)) continue;
      bushList.push([x, z, 0.3 + r() * 0.3]);
    }
    veg.bushMat = mat("#93c97f", { roughness: 0.9 });
    const bushes = instanced(bushGeo, veg.bushMat, bushList, (m, i, x, y, z, s) => place(m, i, x, y + s * 0.5, z, s, s * 0.8, s, r() * 6));
    bushList.forEach((_, i) => bushes.setColorAt(i, new THREE.Color().setScalar(0.88 + r() * 0.24)));

    // 草丛：让草地有点质感
    const tuftGeo = mergeParts([
      { geo: new THREE.ConeGeometry(0.05, 0.36, 4), color: "#fff", matrix: m4(0, 0.18, 0, 0, 0, 0.25) },
      { geo: new THREE.ConeGeometry(0.05, 0.3, 4), color: "#fff", matrix: m4(0.06, 0.15, 0.03, 0, 0, -0.3) },
      { geo: new THREE.ConeGeometry(0.05, 0.26, 4), color: "#fff", matrix: m4(-0.05, 0.13, -0.04, 0.3, 0, 0) },
    ]);
    const tuftList = [];
    for (let tries = 0; tries < 3000 && tuftList.length < 900; tries++) {
      const x = (r() - 0.5) * 66;
      const z = (r() - 0.5) * 66;
      if (terrainHeight(x, z) < 0.62 || !free(x, z, 0.1)) continue;
      tuftList.push([x, z, 0.7 + r() * 0.6]);
    }
    veg.tuftMat = mat("#94c97a", { roughness: 1 });
    const tufts = instanced(tuftGeo, veg.tuftMat, tuftList, (m, i, x, y, z, s) => place(m, i, x, y - 0.02, z, s, s, s, r() * 6));

    // 小花：五片花瓣 + 黄色花心
    const petals = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      petals.push({ geo: new THREE.SphereGeometry(0.065, 8, 6), color: "#ffffff", matrix: m4(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075, 0, 0, 0, 1, 0.55, 1) });
    }
    petals.push({ geo: new THREE.SphereGeometry(0.05, 8, 6), color: "#ffd34d", matrix: m4(0, 0.02, 0) });
    const flowerColors = ["#f6a5c0", "#ffffff", "#ffd66e", "#c9b6f2", "#ff9f8a", "#f7c1d9"].map((c) => new THREE.Color(c));
    const flowerList = [];
    // 花坛里密密的一圈
    for (let k = 0; k < 260; k++) {
      const a = r() * Math.PI * 2;
      const rr = 2.85 + r() * 1.55;
      flowerList.push([Math.cos(a) * rr, Math.sin(a) * rr, flowerColors[Math.floor((a / (Math.PI * 2)) * 12) % flowerColors.length]]);
    }
    // 草地上一丛一丛的
    for (let c = 0; c < 46; c++) {
      const a = r() * Math.PI * 2;
      const rad = 6.5 + Math.sqrt(r()) * 22;
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
    const flowers = new THREE.InstancedMesh(mergeParts(petals), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), flowerList.length);
    flowerList.forEach(([x, z, color], i) => {
      place(flowers, i, x, terrainHeight(x, z) + 0.13, z, 0.9 + r() * 0.5, 1, 0.9 + r() * 0.5, r() * 6);
      flowers.setColorAt(i, color);
    });
    veg.flowers = flowers;
    veg.flowerTotal = flowerList.length;

    // 海边的石头、海底的珊瑚
    const rockList = [];
    for (let k = 0; k < 50; k++) {
      const a = r() * Math.PI * 2;
      const rad = islandRadius(a) - 0.8 + r() * 7;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if ((Math.abs(x) < 4.5 && z > 22) || Math.hypot(x - FISH_ZONE.x, z - FISH_ZONE.z) < FISH_ZONE.r + 1) continue;
      rockList.push([x, z, 0.3 + r() * 0.5]);
    }
    const rocks = instanced(new THREE.DodecahedronGeometry(1, 1), mat("#d9cfc2", { roughness: 0.95 }), rockList, (m, i, x, y, z, s) =>
      place(m, i, x, y + s * 0.2, z, s, s * 0.65, s, r() * 6),
    );
    const coralColors = ["#f7a9a0", "#ffc78f", "#f3b6d6", "#a8e0d0", "#c8b6f0"].map((c) => new THREE.Color(c));
    const coralList = [];
    for (let k = 0; k < 90; k++) {
      const a = r() * Math.PI * 2;
      const rad = islandRadius(a) + 2.5 + r() * 9;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (Math.max(Math.abs(x), Math.abs(z)) > SEA_HALF - 2 || Math.hypot(x - HOLE.x, z - HOLE.z) < HOLE.r + 1) continue;
      coralList.push([x, z, 0.25 + r() * 0.35, coralColors[k % coralColors.length]]);
    }
    const corals = instanced(new THREE.SphereGeometry(1, 10, 8), mat("#ffffff", { roughness: 0.6 }), coralList, (m, i, x, y, z, s) =>
      place(m, i, x, y + s * 0.4, z, s, s * 1.4, s, r() * 6),
    );
    coralList.forEach((c, i) => corals.setColorAt(i, c[3]));

    const all = [veg.trunks, veg.crowns, st, blossoms, kapoks, veg.pines, veg.snowPines, veg.palms, bushes, tufts, flowers, rocks, corals];
    for (const m of all) {
      m.castShadow = ![tufts, flowers, corals].includes(m);
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
    hedgeMat.color.set(S.hedge);
    if (!veg.crowns) return;
    const winter = name === "winter";
    const summer = name === "summer";
    // 树冠颜色：秋天一半银杏黄、一半枫叶红
    const c0 = new THREE.Color(S.crown[0]);
    const c1 = new THREE.Color(S.crown[1]);
    const tmp = new THREE.Color();
    veg.crownShade.forEach((shade, i) => {
      const base = name === "autumn" ? (i % 2 ? c1 : c0) : tmp.copy(c0).lerp(c1, (i * 0.37) % 1);
      veg.crowns.setColorAt(i, tmp.copy(base).multiplyScalar(shade));
    });
    veg.crowns.instanceColor.needsUpdate = true;
    veg.crowns.count = veg.trunks.count = winter ? 0 : summer ? veg.inlandCount : veg.decidCount;
    veg.palms.visible = summer;
    veg.pines.visible = !winter;
    veg.snowPines.visible = winter;
    veg.blossomMat.color.set(S.blossom);
    veg.kapokMat.color.set(S.kapok);
    veg.bushMat.color.set(S.bush);
    veg.tuftMat.color.set(S.tuft);
    veg.flowers.count = Math.round(veg.flowerTotal * S.flowers);
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
    sun.position.copy(sunDir).multiplyScalar(100);
    sunSprite.position.copy(sunDir).multiplyScalar(560);
    sunSprite.material.color.copy(night > 0.5 ? new THREE.Color("#e8eeff") : k.sun);
    sunSprite.scale.setScalar(night > 0.5 ? 34 : 60);
    waterUniforms.uShallow.value.copy(k.shallow);
    waterUniforms.uMid.value.copy(k.mid);
    waterUniforms.uDeep.value.copy(k.deep);
    waterUniforms.uFoam.value.copy(k.foam);
    waterUniforms.uSky.value.copy(k.skyBottom);
    waterUniforms.uSun.value.copy(k.sun);
    waterUniforms.uSunDir.value.copy(sunDir);
    waterUniforms.uNight.value = night;
    seabedUniforms.uTint.value.copy(k.mid).lerp(new THREE.Color("#ffffff"), 0.35);
    seabedUniforms.uCaustic.value = k.caustic;
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
      if (y < focus.y - 1 || Math.abs(x - focus.x) > 22 || Math.abs(z - focus.z) > 22) {
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
    if (Math.max(Math.abs(x), Math.abs(z)) > SEA_HALF - 1.5) return false;
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
    ripple,
    groundMeshes: [terrain, deck, platform],
    onUpdate: (fn) => updaters.push(fn),
    get night() {
      return night;
    },
  };
}
