import * as THREE from "three";
import { STATIONS, INTRO_LINES, FINISH_LINE, CHAT_LINES, LUCKY_NOTES, CAFE_MENU } from "./data.js";
import { createWorld, groundHeight, terrainHeight, islandRadius, PIER, BOARD, FEED, seasonOf, beijingSeason, timeLabel } from "./world.js";
import { buildLandmarks } from "./landmarks.js";
import { createPlaza, WELL } from "./plaza.js";
import { drinkSVG, cupColor } from "./drinks.js";
import { createNature } from "./nature.js";
import { makeCharacter, setShape } from "./characters.js";
import { createFish } from "./fish.js";
import { createCritters } from "./critters.js";
import { clamp, lerp, labelSprite, mat, addSnow, snowUniform } from "./util.js";

// 在 studio.html 里捏好、点了 "Try it on the island" 的脸：只在自己的浏览器里生效，先看看效果
try {
  const saved = JSON.parse(localStorage.getItem("fp-shape"));
  if (saved) setShape(saved);
} catch {
  /* 没有就用默认的 */
}

const $ = (id) => document.getElementById(id);
const stage = $("fp-stage");
const canvas = $("fp-canvas");
const pad = (n) => String(n).padStart(2, "0");
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const lowPower = matchMedia("(pointer: coarse)").matches;

function showFallback() {
  $("fp-loading").hidden = true;
  $("fp-fallback-list").innerHTML = STATIONS.map(
    (s) => `<li><strong>${esc(s.name)}</strong><br>${esc(s.city)} · ${esc(s.period)}<br>${esc(s.role)}</li>`,
  ).join("");
  $("fp-fallback").hidden = false;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (err) {
  showFallback();
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.75 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1600);

// ===== 搭建小岛 =====
const world = createWorld(scene, { lowPower });
const landmarks = buildLandmarks(scene, world);
const plaza = createPlaza(scene, world);
const nature = createNature(scene, {
  terrainHeight,
  islandRadius,
  free: world.free,
  colliders: world.colliders,
  specials: [...landmarks.specialTrees, ...plaza.specials],
  flowerSpots: plaza.flowerSpots,
  lowPower,
});
world.onSeason(nature.setSeason);
world.onSeason(plaza.setSeason);
world.onUpdate((dt, t) => plaza.update(t, dt));
let fishFed = 0;
const fish = createFish(scene, { onEat: () => fishFed++, onSplash: (x, z) => world.ripple(x, z, 0.12) });
const critters = createCritters(scene, world);
world.onSeason(critters.setSeason);
world.onUpdate((dt, t) => critters.update(dt, t));
// 冬天建筑和小店的屋顶、窗台上有积雪
for (const g of landmarks.pickables) addSnow(g);
addSnow(plaza.root);
world.onSeason((name) => (snowUniform.value = name === "winter" ? 1 : 0));

// ===== 季节和时间：默认跟着访客的时钟 =====
const env = { season: "live", hour: "live" };
function currentEnv() {
  const now = new Date();
  return {
    season: env.season === "live" ? seasonOf(now) : env.season,
    hour: env.hour === "live" ? now.getHours() + now.getMinutes() / 60 : Number(env.hour),
  };
}
function applyEnv() {
  const { season, hour } = currentEnv();
  world.setEnvironment(season, hour);
  $("fp-env-label").textContent = `${cap(season)} · ${timeLabel(hour)}`;
  for (const seg of document.querySelectorAll(".fp-seg")) {
    for (const b of seg.querySelectorAll("button")) b.classList.toggle("is-on", b.dataset.v === String(env[seg.dataset.kind]));
  }
}
applyEnv();
setInterval(applyEnv, 60_000);

// ===== 小人 =====
const SPEED = 5;
const jennie = makeCharacter("jennie");
jennie.root.position.set(-1.2, PIER.y, 37.4);
const jennieTag = labelSprite("Jennie", "island host", 0.42);
jennieTag.position.y = 2.05;
jennie.root.add(jennieTag);
jennie.root.userData.isJennie = true;
scene.add(jennie.root);
// 咖啡店的店员：站在店门口的橱窗前，点单时跳一下，做好了会挥手
const barista = makeCharacter("barista");
{
  const c = plaza.cafeTop;
  const front = plaza.interactions.find((it) => it.kind === "cafe");
  const fx = front.x - c.x;
  const fz = front.z - c.z;
  const len = Math.hypot(fx, fz);
  const [ux, uz] = [fx / len, fz / len];
  const bx = c.x + uz * -0.55 + ux * 1.75;
  const bz = c.z - ux * -0.55 + uz * 1.75;
  barista.root.position.set(bx, groundHeight(bx, bz), bz);
  barista.root.rotation.y = Math.atan2(ux, uz);
  barista.root.userData.kind = "cafe";
  const tag = labelSprite("Barista", null, 0.3);
  tag.position.y = 1.95;
  barista.root.add(tag);
  scene.add(barista.root);
}
let jennieFollows = false;
let jennieStuck = 0;
let player = null;
// 冬天大家换长袖 + 围巾（Jennie、店员、访客）
const dressForSeason = (name) => {
  jennie.setSeason(name);
  barista.setSeason(name);
  player?.setSeason(name);
};
world.onSeason(dressForSeason);
dressForSeason(currentEnv().season);

const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), mat("#f08a7e", { emissive: "#f08a7e", emissiveIntensity: 0.4 }));
marker.scale.y = 1.5;
marker.visible = false;
scene.add(marker);

function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function moveChar(root, dx, dz) {
  const p = root.position;
  if (world.walkable(p.x + dx, p.z + dz)) {
    p.x += dx;
    p.z += dz;
    return true;
  }
  if (world.walkable(p.x + dx, p.z)) {
    p.x += dx;
    return true;
  }
  if (world.walkable(p.x, p.z + dz)) {
    p.z += dz;
    return true;
  }
  return false;
}

function jennieSpot() {
  const p = player.root.position;
  return [p.x + Math.cos(cam.yaw) * 1.4 + Math.sin(cam.yaw) * 0.4, p.z - Math.sin(cam.yaw) * 1.4 + Math.cos(cam.yaw) * 0.4];
}

function placeJennieBehind() {
  const p = player.root.position;
  const [sx, sz] = jennieSpot();
  if (world.walkable(sx, sz)) {
    jennie.root.position.set(sx, groundHeight(sx, sz), sz);
    return;
  }
  const a = player.root.rotation.y;
  for (const off of [1.3, -1.3, 2.2, -2.2, 0, Math.PI]) {
    const x = p.x - Math.sin(a + off) * 1.8;
    const z = p.z - Math.cos(a + off) * 1.8;
    if (world.walkable(x, z)) {
      jennie.root.position.set(x, groundHeight(x, z), z);
      return;
    }
  }
  jennie.root.position.set(p.x + 0.6, p.y, p.z + 0.6);
}

// ===== 输入：键盘、摇杆、拖动视角 =====
const keys = new Set();
const MOVE_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.target instanceof HTMLInputElement && k !== "escape") return; // 在输入框里打字时不走路
  if (MOVE_KEYS.includes(k)) {
    keys.add(k);
    e.preventDefault();
    hideHint();
  } else if (k === "escape") {
    if (!$("fp-panel").hidden) closePanel();
    $("fp-env-menu").hidden = true;
  } else if (k === "e" || ((k === "enter" || k === " ") && !(document.activeElement instanceof HTMLButtonElement))) {
    if (!$("fp-dialog").hidden && dialog.modal) advanceDialog();
    else if ($("fp-panel").hidden) triggerAction();
    e.preventDefault();
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());

const joy = { x: 0, y: 0, id: null };
const joyEl = $("fp-joystick");
const knob = joyEl.querySelector(".fp-knob");
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const max = r.width * 0.34;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx *= max / len;
    dy *= max / len;
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max;
  joy.y = -dy / max;
}
joyEl.addEventListener("pointerdown", (e) => {
  joy.id = e.pointerId;
  joyEl.setPointerCapture(e.pointerId);
  moveJoy(e);
  hideHint();
  e.preventDefault();
});
joyEl.addEventListener("pointermove", (e) => e.pointerId === joy.id && moveJoy(e));
const endJoy = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null;
  joy.x = joy.y = 0;
  knob.style.transform = "";
};
joyEl.addEventListener("pointerup", endJoy);
joyEl.addEventListener("pointercancel", endJoy);

const cam = { yaw: 0, pitch: 0.55, dist: 12, target: new THREE.Vector3(0, 1.5, 40) };
// 滚轮 / 双指缩放的范围：最远可以看到整个小岛和外面的海
const MIN_DIST = 6;
const MAX_DIST = 140;
const pointers = new Map();
let dragMoved = 0;
let pinch = 0;
const pinchDist = () => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
};
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = 0;
  if (pointers.size === 2) pinch = pinchDist();
  $("fp-env-menu").hidden = true;
});
canvas.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 1) {
    dragMoved += Math.abs(dx) + Math.abs(dy);
    if (mode === "play") {
      cam.yaw -= dx * 0.006;
      cam.pitch = clamp(cam.pitch + dy * 0.004, 0.22, 1.35);
    }
  } else if (pointers.size === 2) {
    const d = pinchDist();
    cam.dist = clamp((cam.dist * pinch) / d, MIN_DIST, MAX_DIST);
    pinch = d;
    dragMoved = 99;
  }
});
const pointerEnd = (e) => {
  if (!pointers.delete(e.pointerId)) return;
  if (pointers.size === 0 && dragMoved < 6 && e.type === "pointerup") pick(e);
};
canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (mode === "play") cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), MIN_DIST, MAX_DIST);
  },
  { passive: false },
);

// 点一下建筑 / Jennie
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(e) {
  if (mode !== "play" || !$("fp-panel").hidden) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const hit of ray.intersectObjects([...landmarks.pickables, ...plaza.pickables, ...critters.pickables, jennie.root], true)) {
    let o = hit.object;
    while (o && o.userData.station === undefined && !o.userData.isJennie && !o.userData.kind) o = o.parent;
    if (!o) continue;
    if (o.userData.isJennie) chat();
    else if (o.userData.kind === "bench") goSit(o.userData.seat);
    else if (o.userData.kind === "cat") meow(o.userData.cat);
    else if (o.userData.kind) openPlace(o.userData.kind);
    else openStation(o.userData.station);
    return;
  }
  // 点到地面就走过去；点到水面就"duang"一下（鱼在附近的话就往那里扔鱼食）
  const ground = ray.intersectObjects(world.groundMeshes, false)[0];
  if (!ground) return;
  const { x, z } = ground.point;
  if (groundHeight(x, z) < -0.15) {
    const p = player.root.position;
    if (fish.nearFish(x, z, 6) && Math.hypot(x - p.x, z - p.z) < 16) feedFish({ x, z });
    else world.ripple(x, z, 0.22);
    return;
  }
  goTo(x, z);
}

// 走到 (x, z)；到了以后做 then（比如坐下、取咖啡）
let pending = null;
function goTo(x, z, then = null) {
  walkTarget = { x, z, stuck: 0 };
  targetRing.position.set(x, groundHeight(x, z) + 0.08, z);
  targetRing.visible = true;
  pending = then;
}

let walkTarget = null;
const targetRing = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.48, 32),
  new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false }),
);
targetRing.rotation.x = -Math.PI / 2;
targetRing.visible = false;
scene.add(targetRing);
function clearWalkTarget() {
  walkTarget = null;
  pending = null;
  targetRing.visible = false;
}

function hideHint() {
  $("fp-hint").classList.add("is-faded");
}

// ===== 对话框（Jennie 说话） =====
const dialog = { lines: [], i: 0, typed: 0, text: "", modal: false, auto: 0, onDone: null };
function say(lines, { modal = false, onDone = null } = {}) {
  dialog.lines = Array.isArray(lines) ? lines : [lines];
  dialog.i = 0;
  dialog.modal = modal;
  dialog.onDone = onDone;
  showLine();
}
function showLine() {
  dialog.text = dialog.lines[dialog.i];
  dialog.typed = 0;
  dialog.auto = dialog.modal ? 0 : 4 + dialog.text.length * 0.05;
  const last = dialog.i === dialog.lines.length - 1;
  $("fp-dialog-next").textContent = last ? (dialog.modal ? "Let's go" : "OK") : "Next";
  $("fp-dialog").hidden = false;
}
function advanceDialog() {
  if (dialog.typed < dialog.text.length) {
    dialog.typed = dialog.text.length;
    return;
  }
  dialog.i++;
  if (dialog.i < dialog.lines.length) return showLine();
  $("fp-dialog").hidden = true;
  const done = dialog.onDone;
  dialog.lines = [];
  dialog.onDone = null;
  done?.();
}
$("fp-dialog-next").addEventListener("click", advanceDialog);
function updateDialog(dt) {
  if ($("fp-dialog").hidden) return;
  if (dialog.typed < dialog.text.length) {
    dialog.typed = Math.min(dialog.text.length, dialog.typed + dt * 48);
    $("fp-dialog-text").textContent = dialog.text.slice(0, Math.floor(dialog.typed));
  } else if (dialog.auto > 0) {
    dialog.auto -= dt;
    if (dialog.auto <= 0) advanceDialog();
  }
}
let chatIndex = 0;
function chat() {
  say(CHAT_LINES[chatIndex++ % CHAT_LINES.length]);
  jennie.hop();
}

// ===== 弹出面板 =====
function openPanel(html, onMount) {
  $("fp-panel-body").innerHTML = html;
  $("fp-panel").hidden = false;
  onMount?.($("fp-panel-body"));
  $("fp-close").focus();
}
function closePanel() {
  $("fp-panel").hidden = true;
}
$("fp-close").addEventListener("click", closePanel);
$("fp-panel").addEventListener("click", (e) => e.target === $("fp-panel") && closePanel());

// ===== 访客统计后台（Cloudflare Worker，代码在 footprint-stats 文件夹） =====
// 连不上（比如被墙）也不影响小岛，只是只能看到自己的数字
// 网址加 ?localstats 时连本机的测试后台（npx wrangler dev），平时连线上的
const STATS_URL = /[?&]localstats/.test(location.search) ? "http://127.0.0.1:8787" : "https://footprint-stats.footprint-stats.workers.dev";
const remote = { id: null, stats: null };
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 隐私模式下存不了，没关系 */
    }
  },
};
// 随机的访客编号：只用来算"有多少人"，不包含任何个人信息
let visitorId = store.get("fp-visitor", null);
if (!visitorId) {
  visitorId = crypto.randomUUID?.() ?? `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  store.set("fp-visitor", visitorId);
}
async function api(path, data) {
  if (!STATS_URL) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const opts = data === undefined ? { signal: ctrl.signal } : { method: "POST", body: JSON.stringify(data), signal: ctrl.signal };
    const res = await fetch(STATS_URL + path, opts);
    clearTimeout(timer);
    return res.ok || res.status === 429 ? await res.json() : null;
  } catch {
    return null;
  }
}
function mergeStats(r) {
  if (r && r.flowers) remote.stats = { ...remote.stats, ...r };
  return remote.stats;
}
// 访客自己填的名字（可以不填），存在浏览器里，下次来还记得
let visitorName = store.get("fp-name", "");
let nameSynced = true;
api("/visit", { visitor: visitorId, name: visitorName }).then((r) => {
  if (!r) return;
  remote.id = r.id;
  mergeStats(r);
  if (!nameSynced) setName(visitorName);
});
function setName(name) {
  visitorName = name.replace(/\s+/g, " ").trim().slice(0, 20);
  store.set("fp-name", visitorName);
  nameSynced = !!remote.id;
  if (remote.id) api("/name", { id: remote.id, name: visitorName });
}
const count = (name, detail) => (remote.id ? api("/count", { id: remote.id, name, detail }).then(mergeStats) : Promise.resolve(null));
function reportVisit() {
  if (!STATS_URL || !remote.id) return;
  const seconds = Math.round((performance.now() - visitStart) / 1000);
  navigator.sendBeacon?.(STATS_URL + "/leave", JSON.stringify({ id: remote.id, seconds }));
}
addEventListener("pagehide", reportVisit);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && reportVisit());

// ===== 送花：自己送的记在浏览器里，所有人的数字来自后台 =====
const flowerCounts = store.get("fp-flowers", {});
const totalFlowers = () => Object.values(flowerCounts).reduce((a, b) => a + b, 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function flowerNote(id) {
  const mine = flowerCounts[id] || 0;
  const s = remote.stats;
  if (s?.senders) {
    const people = s.senders[id] || 0;
    const all = s.flowers?.[id] || 0;
    if (!people) return "Be the first to leave a flower here.";
    return `${plural(people, "person has", "people have")} sent flowers here${mine ? ", including you" : ""} · ${plural(all, "flower", "flowers")} in total.`;
  }
  return mine ? `You've sent ${plural(mine, "flower", "flowers")} here.` : "Leave a flower if you like this place.";
}

function sendFlower(i, onDone, burstHere = false) {
  const s = STATIONS[i];
  flowerCounts[s.id] = (flowerCounts[s.id] || 0) + 1;
  store.set("fp-flowers", flowerCounts);
  if (burstHere) {
    const p = player.root.position;
    burstAt(p.x, p.y + 1.2, p.z, 0, 0);
  } else burstFlowers(i);
  if (!remote.id) return onDone?.();
  api("/flower", { id: remote.id, station: s.id }).then((r) => {
    mergeStats(r);
    onDone?.();
  });
}

function openStation(i) {
  const s = STATIONS[i];
  const prev = STATIONS[i - 1];
  const next = STATIONS[i + 1];
  openPanel(
    `<div class="fp-panel-head"><span class="fp-panel-num">${pad(i + 1)}</span><p class="fp-panel-kicker">${esc(s.city)} · ${esc(s.period)}</p></div>
     <h2 id="fp-panel-title">${esc(s.name)}</h2>
     <p class="fp-panel-role">${esc(s.role)}</p>
     <p>${esc(s.text)}</p>
     <div class="fp-flower"><button class="fp-btn" data-flower>Send a flower</button><span class="fp-flower-note">${flowerNote(s.id)}</span></div>
     <div class="fp-panel-nav">
       ${prev ? `<button class="fp-link" data-go="${i - 1}">← ${esc(prev.short)}</button>` : "<span></span>"}
       ${next ? `<button class="fp-link" data-go="${i + 1}">Go to ${esc(next.short)} →</button>` : ""}
     </div>`,
    (body) => {
      const note = body.querySelector(".fp-flower-note");
      body.querySelector("[data-flower]").addEventListener("click", () => {
        note.textContent = "Sending your flower…";
        sendFlower(i, () => (note.textContent = flowerNote(s.id)));
      });
      bindGo(body);
    },
  );
}

function bindGo(body) {
  for (const b of body.querySelectorAll("[data-go]")) {
    b.addEventListener("click", () => {
      closePanel();
      if (mode === "play") teleportTo(Number(b.dataset.go));
    });
  }
}

function openTimeline() {
  const canGo = mode === "play";
  openPanel(
    `<p class="fp-panel-kicker">Footprint</p>
     <h2 id="fp-panel-title">The journey so far</h2>
     <ol class="fp-timeline">${STATIONS.map(
       (s, i) => `<li>${canGo ? `<button data-go="${i}">` : "<div>"}
         <span class="fp-tl-num">${pad(i + 1)}</span>
         <span class="fp-tl-text"><strong>${esc(s.name)}</strong><span>${esc(s.city)} · ${esc(s.period)}</span><span>${esc(s.role)}</span></span>
         ${canGo ? `<span class="fp-tl-go">Go →</span></button>` : "</div>"}</li>`,
     ).join("")}</ol>`,
    bindGo,
  );
}
$("fp-list-btn").addEventListener("click", openTimeline);

// ===== 留言板：公开的愿望（Jennie 可以回复）+ 每位访客在岛上做了什么 =====
// 网址加 ?admin 是 Jennie 的管理模式：输入一次钥匙（存在她自己的浏览器里）就可以回复、隐藏留言
const ADMIN = /[?&]admin/.test(location.search);
const allItems = () => [...CAFE_MENU.coffee, ...CAFE_MENU.tea, ...CAFE_MENU.cake, ...["spring", "summer", "autumn", "winter"].flatMap((s) => CAFE_MENU[s])];
const itemName = (id) => allItems().find((d) => d.id === id)?.name || id;
const stationName = (id) => STATIONS.find((s) => s.id === id)?.short || id;
const nameOf = (r) => (r.name ? esc(r.name) : "A visitor");
function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? plural(d, "day ago", "days ago") : new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// 同一位访客的记录合成一段话：送花给了哪几站、点了什么、抽到什么签……
function summarize(rows) {
  const flowers = [...new Set(rows.filter((r) => r.kind === "flower").map((r) => stationName(r.detail)))];
  const orders = [...new Set(rows.filter((r) => r.kind === "order").map((r) => itemName(r.detail)))];
  const luck = rows.filter((r) => r.kind === "luck").map((r) => r.detail).filter(Boolean);
  const wishes = rows.filter((r) => r.kind === "wish").length;
  const out = [];
  if (flowers.length) out.push(`🌷 sent flowers to ${flowers.map(esc).join(", ")}`);
  if (orders.length) out.push(`☕ ordered ${orders.map(esc).join(", ")}`);
  if (luck.length) out.push(`🎋 drew ${plural(luck.length, "lucky note", "lucky notes")} (${[...new Set(luck)].map(esc).join(", ")})`);
  else if (rows.some((r) => r.kind === "luck")) out.push("🎋 drew a lucky note");
  if (wishes) out.push(`🪙 made ${plural(wishes, "wish", "wishes")}`);
  if (rows.some((r) => r.kind === "fish")) out.push("🐟 fed the fish");
  return out;
}

let adminKey = ADMIN ? store.get("fp-admin-key", "") : "";
function openGuestbook(tab = "wishes") {
  openPanel(
    `<p class="fp-panel-kicker">Guestbook</p>
     <h2 id="fp-panel-title">Visitors & wishes</h2>
     <div class="fp-tabs" role="tablist">
       <button role="tab" data-tab="wishes" aria-selected="${tab === "wishes"}">Wishes</button>
       <button role="tab" data-tab="visitors" aria-selected="${tab === "visitors"}">Visitors</button>
     </div>
     ${ADMIN ? `<form class="fp-admin" data-admin ${adminKey ? "hidden" : ""}><input type="password" data-key placeholder="Jennie's reply key" aria-label="Reply key"><button class="fp-btn fp-btn-small">Unlock</button></form>` : ""}
     <div data-gb><p class="fp-note">Loading the guestbook…</p></div>`,
    (body) => {
      let data = null;
      const box = body.querySelector("[data-gb]");
      const render = () => {
        if (!data) {
          box.innerHTML = `<p class="fp-note">The guestbook can't be reached right now. Please try again later.</p>`;
          return;
        }
        if (tab === "wishes") {
          box.innerHTML = data.wishes.length
            ? `<ul class="fp-gb">${data.wishes
                .map(
                  (w) => `<li class="${w.hidden ? "is-hidden" : ""}">
                    <p class="fp-gb-wish">“${esc(w.detail || "")}”</p>
                    <p class="fp-gb-meta">${nameOf(w)} · ${ago(w.created)}${w.hidden ? " · hidden" : ""}</p>
                    ${w.reply ? `<p class="fp-gb-reply"><strong>Jennie</strong> ${esc(w.reply)}</p>` : ""}
                    ${
                      ADMIN && adminKey
                        ? `<div class="fp-admin-row"><input data-reply="${w.n}" maxlength="300" value="${esc(w.reply || "")}" placeholder="Write a reply…" aria-label="Reply">
                           <button class="fp-btn fp-btn-small" data-save="${w.n}">Reply</button>
                           <button class="fp-link" data-hide="${w.n}" data-to="${w.hidden ? 0 : 1}">${w.hidden ? "Show" : "Hide"}</button></div>`
                        : ""
                    }
                  </li>`,
                )
                .join("")}</ul>`
            : `<p class="fp-note">No shared wishes yet. Make one at the wishing well in the little woods!</p>`;
        } else {
          const groups = new Map();
          for (const r of data.activity) {
            if (!groups.has(r.who)) groups.set(r.who, []);
            groups.get(r.who).push(r);
          }
          const list = [...groups.values()].slice(0, 40).map((rows) => ({ rows, lines: summarize(rows) }));
          box.innerHTML = list.length
            ? `<ul class="fp-gb">${list
                .map(({ rows, lines }) => `<li><p class="fp-gb-meta"><strong>${nameOf(rows[0])}</strong> · ${ago(rows[0].created)}</p><ul class="fp-gb-lines">${lines.map((l) => `<li>${l}</li>`).join("")}</ul></li>`)
                .join("")}</ul>`
            : `<p class="fp-note">Nobody has left a footprint yet. Be the first!</p>`;
        }
        for (const b of box.querySelectorAll("[data-save]")) {
          b.addEventListener("click", () => adminCall("/admin/reply", { n: Number(b.dataset.save), reply: box.querySelector(`[data-reply="${b.dataset.save}"]`).value }));
        }
        for (const b of box.querySelectorAll("[data-hide]")) {
          b.addEventListener("click", () => adminCall("/admin/hide", { n: Number(b.dataset.hide), hidden: b.dataset.to === "1" }));
        }
      };
      const adminCall = (path, extra) =>
        api(path, { key: adminKey, ...extra }).then((r) => {
          if (r?.ok) {
            data = r;
            render();
          } else toast("<span><strong>That didn't work.</strong> Check the reply key and try again.</span>");
        });
      for (const t of body.querySelectorAll("[data-tab]")) {
        t.addEventListener("click", () => {
          tab = t.dataset.tab;
          for (const o of body.querySelectorAll("[data-tab]")) o.setAttribute("aria-selected", String(o === t));
          render();
        });
      }
      body.querySelector("[data-admin]")?.addEventListener("submit", (e) => {
        e.preventDefault();
        adminKey = body.querySelector("[data-key]").value.trim();
        api("/admin/check", { key: adminKey }).then((r) => {
          if (!r?.ok) {
            adminKey = "";
            toast("<span><strong>Wrong key.</strong> Please try again.</span>");
            return;
          }
          store.set("fp-admin-key", adminKey);
          body.querySelector("[data-admin]").hidden = true;
          data = r;
          render();
        });
      });
      (ADMIN && adminKey ? api("/admin/check", { key: adminKey }) : api("/guestbook")).then((r) => {
        data = r?.wishes ? r : null;
        render();
      });
    },
  );
}
$("fp-guest-btn").addEventListener("click", () => openGuestbook());
$("fp-intro-list").addEventListener("click", openTimeline);

// ===== 花房：只是一块看板，显示每一站收到多少花（送花在各站里送） =====
function openFlowerHouse() {
  const render = () => {
    const s = remote.stats;
    const rows = STATIONS.map((st, i) => ({ st, i, flowers: s?.flowers?.[st.id] || 0, people: s?.senders?.[st.id] || 0, mine: flowerCounts[st.id] || 0 }));
    const ranked = [...rows].sort((a, b) => b.flowers - a.flowers || a.i - b.i);
    const max = Math.max(1, ...rows.map((r) => r.flowers));
    return `<p class="fp-panel-kicker">Flower House</p>
      <h2 id="fp-panel-title">Flower board</h2>
      <p>Which places on Jennie's journey have visitors left the most flowers? To leave one yourself, visit a stop and press “Send a flower”.</p>
      <ol class="fp-rank">${ranked
        .map(
          (r, k) => `<li>
            <span class="fp-rank-num">${k + 1}</span>
            <span class="fp-rank-text"><strong>${esc(r.st.short)}</strong>
              <span class="fp-rank-bar"><span style="width:${((r.flowers / max) * 100).toFixed(0)}%"></span></span>
              <span class="fp-rank-meta">${plural(r.flowers, "flower", "flowers")} · ${plural(r.people, "person", "people")}${r.mine ? ` · you sent ${r.mine}` : ""}</span>
            </span>
          </li>`,
        )
        .join("")}</ol>
      ${s ? "" : `<p class="fp-note">Live totals are not available right now, so only your own flowers are shown.</p>`}`;
  };
  openPanel(render());
  api("/stats").then((r) => {
    const body = $("fp-panel-body");
    if (!r || $("fp-panel").hidden || !body.querySelector(".fp-rank")) return;
    mergeStats(r);
    body.innerHTML = render();
  });
}

// ===== 小提示（上面弹一下就消失；带按钮的会一直留着，直到点了或者事情做完） =====
let toastTimer = 0;
function toast(html, ms = 5000, button = null) {
  const el = $("fp-toast");
  el.innerHTML = html;
  el.hidden = false;
  el.classList.toggle("has-button", !!button);
  if (button) {
    const b = document.createElement("button");
    b.className = "fp-btn fp-btn-small";
    b.textContent = button.label;
    b.addEventListener("click", () => {
      hideToast();
      button.onClick();
    });
    el.append(b);
  }
  el.classList.remove("is-in");
  void el.offsetWidth;
  el.classList.add("is-in");
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(hideToast, ms);
}
function hideToast() {
  clearTimeout(toastTimer);
  $("fp-toast").hidden = true;
}

// 叮咚一声（点单时顺便把声音打开：浏览器要求先点一下才能出声）
let audio = null;
function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch {
    audio = null;
  }
}
function ding() {
  if (!audio) return;
  const t0 = audio.currentTime;
  for (const [f, at] of [
    [988, 0],
    [1319, 0.18],
  ]) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 1.1);
    o.connect(g).connect(audio.destination);
    o.start(t0 + at);
    o.stop(t0 + at + 1.2);
  }
}

// ===== 咖啡店：点单 → 等一会儿做好 → 回来取 → 看到饮料和销量，拿在手上走 =====
const BREW_SECONDS = 12;
let cupTimer = 0;
let order = null; // { d, left, ready }
const sold = (d) => remote.stats?.counters?.[`drink-${d.id}`] || 0;
const unit = (d) => (d.kind === "cake" ? "piece" : "cup");
const cafeSpot = plaza.interactions.find((it) => it.kind === "cafe");
function setCafeLabel(text) {
  cafeSpot.label = text;
  action = null; // 让按钮文字马上刷新
}

function openCafe() {
  if (order?.ready) return pickUpDrink();
  if (order) {
    openPanel(
      `<p class="fp-panel-kicker">Island Café</p>
       <h2 id="fp-panel-title">Your ${esc(order.d.name)} is on its way</h2>
       <div class="fp-drink-wait">${drinkSVG(order.d, 84)}<p>The barista is making it now. Have a look around and come back in a few seconds!</p></div>`,
    );
    return;
  }
  // 季节限定按北京时间：春夏秋冬各一款，放在最上面；下面分咖啡 / 茶 / 蛋糕三页
  const season = beijingSeason();
  const special = CAFE_MENU[season][0];
  const tabs = [
    ["coffee", "Coffee"],
    ["tea", "Tea"],
    ["cake", "Cakes"],
  ];
  const menu = [special, ...CAFE_MENU.coffee, ...CAFE_MENU.tea, ...CAFE_MENU.cake];
  const served = remote.stats?.counters?.coffee;
  const item = (d) =>
    `<li>${drinkSVG(d, 58)}<span>${d === special ? `<span class="fp-badge">${cap(season)} special</span>` : ""}<strong>${esc(d.name)}</strong><span>${esc(d.desc)}</span>${
      sold(d) ? `<span class="fp-sold">${plural(sold(d), unit(d), `${unit(d)}s`)} sold</span>` : ""
    }</span><button class="fp-btn fp-btn-small" data-order="${menu.indexOf(d)}">Order</button></li>`;
  openPanel(
    `<p class="fp-panel-kicker">Island Café</p>
     <h2 id="fp-panel-title">What would you like?</h2>
     <p>Coffee, tea and cakes, freshly made on the island. It's on the house.</p>
     <ul class="fp-menu-list fp-drinks">${item(special)}</ul>
     <div class="fp-tabs" role="tablist">${tabs.map(([k, label], i) => `<button role="tab" data-tab="${k}" aria-selected="${i === 0}">${label}</button>`).join("")}</div>
     ${tabs.map(([k], i) => `<ul class="fp-menu-list fp-drinks" data-list="${k}" ${i ? "hidden" : ""}>${CAFE_MENU[k].map(item).join("")}</ul>`).join("")}
     ${served ? `<p class="fp-note">${plural(served, "order", "orders")} served on the island so far.</p>` : ""}`,
    (body) => {
      for (const t of body.querySelectorAll("[data-tab]")) {
        t.addEventListener("click", () => {
          for (const o of body.querySelectorAll("[data-tab]")) o.setAttribute("aria-selected", String(o === t));
          for (const l of body.querySelectorAll("[data-list]")) l.hidden = l.dataset.list !== t.dataset.tab;
        });
      }
      for (const b of body.querySelectorAll("[data-order]")) {
        b.addEventListener("click", () => {
          const d = menu[Number(b.dataset.order)];
          unlockAudio();
          barista.hop();
          closePanel();
          order = { d, left: BREW_SECONDS, ready: false };
          setCafeLabel(d.kind === "cake" ? "Waiting for your cake…" : "Waiting for your drink…");
          toast(`${drinkSVG(d, 40)}<span><strong>Order received!</strong> Your ${esc(d.name)} will be ready in a moment.</span>`);
          count(`drink-${d.id}`);
          count("coffee");
        });
      }
    },
  );
}

// 做好了：叮一声 + 上面弹出带按钮的提示 + 咖啡店头顶出现牌子 + Jennie 提醒；页面在后台的话标签页标题也会变
const readySign = labelSprite("Your order is ready!", "Pick it up here", 0.42);
readySign.visible = false;
scene.add(readySign);
const pageTitle = document.title;
document.addEventListener("visibilitychange", () => !document.hidden && (document.title = pageTitle));

function updateOrder(dt) {
  if (order?.ready) {
    readySign.position.copy(plaza.cafeTop).y += Math.sin(elapsed * 3) * 0.15;
    return;
  }
  if (!order || (order.left -= dt) > 0) return;
  order.ready = true;
  const name = order.d.name;
  setCafeLabel(`Pick up your ${name}`);
  readySign.visible = true;
  barista.wave(true);
  ding();
  toast(`${drinkSVG(order.d, 44)}<span><strong>Ding! Your ${esc(name)} is ready.</strong> It's waiting for you at the café.</span>`, 0, {
    label: "Go pick it up",
    onClick: () => {
      if (!$("fp-panel").hidden) closePanel();
      if (seat >= 0) standUp();
      goTo(cafeSpot.x, cafeSpot.z, () => openCafe());
    },
  });
  if (mode === "play" && $("fp-dialog").hidden) say(`Your ${name} is ready! Let's go and get it.`);
  if (document.hidden) document.title = `☕ Your ${name} is ready!`;
}

function pickUpDrink() {
  const d = order.d;
  order = null;
  readySign.visible = false;
  barista.wave(false);
  hideToast();
  setCafeLabel("Order a drink");
  player.hold(d.kind === "cake" ? "cake" : "cup", cupColor(d));
  cupTimer = 150;
  player.hop();
  const n = sold(d);
  openPanel(
    `<p class="fp-panel-kicker">Island Café</p>
     <h2 id="fp-panel-title">Here's your ${esc(d.name)}!</h2>
     <div class="fp-drink-big">${drinkSVG(d, 150)}</div>
     <p class="fp-drink-desc">${esc(d.desc)} Enjoy it on your walk.</p>
     ${n ? `<p class="fp-sold-big"><strong>${n}</strong> ${n === 1 ? unit(d) : `${unit(d)}s`} of ${esc(d.name)} sold on the island so far.</p>` : ""}`,
  );
}

// ===== 抽签：摇一摇，抽一张好运字条 =====
function openLuck() {
  const drawn = remote.stats?.counters?.luck;
  openPanel(
    `<p class="fp-panel-kicker">Lucky Draw</p>
     <h2 id="fp-panel-title">Draw a lucky note</h2>
     <p>Shake the box and see what the island has to say to you today.</p>
     <div class="fp-luck"><div class="fp-luck-box" data-box><span></span></div><div class="fp-luck-note" data-note hidden></div></div>
     <div class="fp-flower"><button class="fp-btn" data-draw>Shake the box</button><span class="fp-flower-note" data-count>${drawn ? `${plural(drawn, "note", "notes")} drawn so far.` : ""}</span></div>`,
    (body) => {
      const btn = body.querySelector("[data-draw]");
      const box = body.querySelector("[data-box]");
      const note = body.querySelector("[data-note]");
      btn.addEventListener("click", () => {
        note.hidden = true;
        box.classList.remove("is-shaking");
        void box.offsetWidth;
        box.classList.add("is-shaking");
        btn.disabled = true;
        setTimeout(() => {
          const [level, text] = LUCKY_NOTES[Math.floor(Math.random() * LUCKY_NOTES.length)];
          note.innerHTML = `<span class="fp-luck-level">${esc(level)}</span><p>${esc(text)}</p>`;
          note.hidden = false;
          btn.disabled = false;
          btn.textContent = "Draw again";
          count("luck", level).then(() => {
            const n = remote.stats?.counters?.luck;
            if (n) body.querySelector("[data-count]").textContent = `${plural(n, "note", "notes")} drawn so far.`;
          });
        }, 900);
      });
    },
  );
}

// ===== 许愿池：许个愿，往井里扔一枚硬币。默认保密；勾选"公开"才会出现在留言板上，Jennie 可以回复 =====
function openWish() {
  const made = remote.stats?.counters?.wish;
  openPanel(
    `<p class="fp-panel-kicker">Wishing Well</p>
     <h2 id="fp-panel-title">Make a wish</h2>
     <p>Close your eyes, make a wish, and toss a coin into the well.</p>
     <input class="fp-wish-input" data-wish maxlength="140" placeholder="Write your wish here (optional)" aria-label="Your wish">
     <label class="fp-share"><input type="checkbox" data-share> <span><strong>Share my wish on the guestbook</strong>
       <span data-share-note>If you share it, Jennie can reply to you there, and other visitors may see it too.</span></span></label>
     <p class="fp-note" data-secret>Not shared: your wish stays a secret and is never sent or saved.</p>
     <div class="fp-flower"><button class="fp-btn" data-toss>Toss a coin</button><span class="fp-flower-note">${made ? `${plural(made, "wish", "wishes")} made here so far.` : ""}</span></div>`,
    (body) => {
      const share = body.querySelector("[data-share]");
      const input = body.querySelector("[data-wish]");
      share.addEventListener("change", () => (body.querySelector("[data-secret]").hidden = share.checked));
      body.querySelector("[data-toss]").addEventListener("click", () => {
        const text = input.value.trim();
        if (share.checked && !text) {
          input.focus();
          input.placeholder = "Write your wish first, then share it";
          return;
        }
        closePanel();
        tossCoin(share.checked ? text : "");
      });
    },
  );
}

const coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), mat("#f2c94c", { metalness: 0.6, roughness: 0.3, emissive: "#8a6a10", emissiveIntensity: 0.25 }));
coinMesh.visible = false;
scene.add(coinMesh);
const coin = { t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), shared: "" };
function tossCoin(shared = "") {
  coin.shared = shared;
  const p = player.root.position;
  coin.from.set(p.x, p.y + 1.2, p.z);
  coin.to.set(WELL.x, terrainHeight(WELL.x, WELL.z) + 0.45, WELL.z);
  coin.t = 0;
  coinMesh.visible = true;
  player.root.rotation.y = Math.atan2(WELL.x - p.x, WELL.z - p.z);
  player.hop();
}
function updateCoin(dt) {
  if (coin.t >= 1) return;
  coin.t = Math.min(1, coin.t + dt / 0.9);
  coinMesh.position.lerpVectors(coin.from, coin.to, coin.t);
  coinMesh.position.y += Math.sin(coin.t * Math.PI) * 1.6;
  coinMesh.rotation.x += dt * 14;
  if (coin.t < 1) return;
  coinMesh.visible = false;
  burstAt(coin.to.x, coin.to.y + 0.2, coin.to.z, 0, 0, sparkleMats);
  const sent = coin.shared && remote.id ? api("/wish", { id: remote.id, text: coin.shared }).then(mergeStats) : count("wish");
  const shared = !!coin.shared;
  sent.then(() => {
    const n = remote.stats?.counters?.wish;
    const more = shared ? " It's on the guestbook now, and Jennie may reply there." : n ? ` ${plural(n, "wish has", "wishes have")} been made here.` : " May it come true!";
    toast(`<span class="fp-toast-coin" aria-hidden="true"></span><span><strong>Plop! Your wish is in the well.</strong>${more}</span>`);
  });
}

// ===== 长椅：坐下 / 站起来，Jennie 也会坐到旁边 =====
let seat = -1;
let jennieSeated = false;
function benchSpot(s, side) {
  // 椅子本地坐标 (side, 0.04) 换成世界坐标
  return [s.x + Math.cos(s.ry) * side + Math.sin(s.ry) * 0.04, s.z - Math.sin(s.ry) * side + Math.cos(s.ry) * 0.04];
}
function sitOn(i) {
  const s = plaza.seats[i];
  clearWalkTarget();
  seat = i;
  const [x, z] = benchSpot(s, jennieFollows ? -0.36 : 0);
  player.root.position.set(x, groundHeight(x, z), z);
  player.root.rotation.y = s.ry;
  player.sit(true);
  if (jennieFollows && player.root.position.distanceTo(jennie.root.position) < 8) {
    const [jx, jz] = benchSpot(s, 0.36);
    jennie.root.position.set(jx, groundHeight(jx, jz), jz);
    jennie.root.rotation.y = s.ry;
    jennie.sit(true);
    jennieSeated = true;
  }
}
// 点长椅：走过去坐下（已经在旁边就直接坐）
function goSit(i) {
  if (seat === i) return;
  if (seat >= 0) standUp();
  const s = plaza.seats[i];
  const p = player.root.position;
  if (Math.hypot(p.x - s.front.x, p.z - s.front.z) < 1.7) sitOn(i);
  else goTo(s.front.x, s.front.z, () => sitOn(i));
}

// 点猫：跳一下，喵一声
function meow(k) {
  const c = critters.poke(k);
  const p = c.root.position;
  burstAt(p.x, p.y + 0.6, p.z, 0, 0, heartMats);
  toast(`<span class="fp-toast-paw" aria-hidden="true">🐾</span><span><strong>Meow!</strong> The ${c.name.toLowerCase()} says hi.</span>`, 2600);
}

function standUp() {
  const s = plaza.seats[seat];
  seat = -1;
  player.sit(false);
  const p = player.root.position;
  p.x += Math.sin(s.ry) * 0.75;
  p.z += Math.cos(s.ry) * 0.75;
  if (jennieSeated) {
    jennie.sit(false);
    jennieSeated = false;
    const j = jennie.root.position;
    j.x += Math.sin(s.ry) * 0.75;
    j.z += Math.cos(s.ry) * 0.75;
  }
}

function openPlace(kind) {
  if (kind === "flowerhouse") openFlowerHouse();
  else if (kind === "cafe") openCafe();
  else if (kind === "luck") openLuck();
  else if (kind === "wish") openWish();
}

function feedFish(target = null) {
  fish.feed(player.root.position, target);
  player.hop();
  count("fish");
}

// ===== 公告栏 =====
const visitStart = performance.now();
const visitTime = () => {
  const s = Math.floor((performance.now() - visitStart) / 1000);
  return `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
};
const regionName = (() => {
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return (code) => (code && code !== "XX" ? names.of(code) : "Somewhere lovely");
  } catch {
    return (code) => code || "Somewhere lovely";
  }
})();

function guestStats() {
  const s = remote.stats;
  if (!s) return `<p class="fp-note">Visitor statistics are not available right now.</p>`;
  const mins = Math.floor(s.avgSeconds / 60);
  const avg = s.avgSeconds ? `${mins ? `${mins} min ` : ""}${s.avgSeconds % 60} s` : "–";
  const allFlowers = Object.values(s.flowers || {}).reduce((a, b) => a + b, 0);
  const c = s.counters || {};
  return `<ul class="fp-board">
       <li><strong>Visitors so far</strong><span>${s.visitors}</span></li>
       <li><strong>Where they come from</strong><span>${s.countries.map((x) => `${esc(regionName(x.code))} (${x.n})`).join(", ") || "–"}</span></li>
       <li><strong>Average stay</strong><span>${avg}</span></li>
       <li><strong>On the island so far</strong><span>${plural(allFlowers, "flower", "flowers")} · ${plural(c.coffee || 0, "café order", "café orders")} · ${plural(c.luck || 0, "lucky note", "lucky notes")} · ${plural(c.wish || 0, "wish", "wishes")} · fish fed ${c.fish || 0} times</span></li>
     </ul>`;
}

function openBoard() {
  const { season, hour } = currentEnv();
  openPanel(
    `<p class="fp-panel-kicker">Island bulletin</p>
     <h2 id="fp-panel-title">Hello, traveller!</h2>
     <ul class="fp-board">
       <li><strong>Today on the island</strong><span>${cap(season)}, ${timeLabel(hour).toLowerCase()}. The island follows your local clock.</span></li>
       <li><strong>Your visit</strong><span><span data-live-time>${visitTime()}</span> · ${visited.size} of ${STATIONS.length} stops visited</span></li>
       <li><strong>Flowers you've sent</strong><span>${totalFlowers()}</span></li>
       <li><strong>Fish fed</strong><span>${fishFed}</span></li>
     </ul>
     <p class="fp-panel-kicker">All visitors</p>${guestStats()}
     <p class="fp-note">The island records a random visitor number, your country or region, how long you stay, the name you choose (optional) and what you do here: flowers, café orders, lucky notes and wishes. A wish's words are saved only if you choose to share it. No IP addresses.</p>`,
  );
  api("/stats").then(mergeStats);
}

// ===== 走到哪一站 / 能做什么 =====
const visited = new Set();
const INTERACT = [
  ...STATIONS.map((s, i) => ({ kind: "station", i, x: s.stop[0], z: s.stop[1], r: 3.2, label: `Visit ${s.short}` })),
  { kind: "board", x: BOARD.x, z: BOARD.z, r: 2.9, label: "Read the bulletin" },
  { kind: "feed", x: FEED.x, z: FEED.z, r: 3.4, label: "Feed the fish" },
  ...plaza.interactions,
];
let action = null;
let hudKey = "";
const STAND = { kind: "stand", label: "Stand up" };

function nextStop() {
  for (let i = 0; i < STATIONS.length; i++) if (!visited.has(i)) return i;
  return -1;
}

function updateInteractions() {
  const p = player.root.position;
  let best = null;
  let bestD = Infinity;
  let near = -1;
  for (const it of INTERACT) {
    const d = Math.hypot(p.x - it.x, p.z - it.z);
    if (d < it.r && d < bestD) {
      best = it;
      bestD = d;
    }
    if (it.kind === "station" && d < 3.0) {
      near = it.i;
      if (!visited.has(it.i)) {
        visited.add(it.i);
        const lines = [STATIONS[it.i].line];
        if (visited.size === STATIONS.length) lines.push(FINISH_LINE);
        say(lines);
        jennie.hop();
      }
    }
  }
  if (!best && jennieFollows && p.distanceTo(jennie.root.position) < 2.6) best = { kind: "jennie", label: "Talk to Jennie" };
  if (seat >= 0) best = STAND;
  if (best?.label !== action?.label) {
    action = best;
    $("fp-action").hidden = !best;
    if (best) $("fp-action").textContent = best.label;
    $("fp-action").classList.toggle("is-ready", best?.kind === "cafe" && !!order?.ready);
  }

  const idx = near >= 0 ? near : nextStop();
  const key = `${near}|${idx}|${visited.size}`;
  if (key !== hudKey) {
    hudKey = key;
    const done = idx < 0;
    const s = STATIONS[done ? STATIONS.length - 1 : idx];
    $("fp-stop-num").textContent = done ? "✓" : pad(idx + 1);
    $("fp-stop-label").textContent = near >= 0 ? `Stop ${near + 1} of ${STATIONS.length}` : done ? "All stops visited" : `Next stop · ${idx + 1} of ${STATIONS.length}`;
    $("fp-stop-name").textContent = done ? "Thanks for visiting!" : s.short;
    $("fp-stop-meta").textContent = done ? "Open the timeline to jump anywhere" : `${s.city} · ${s.period}`;
  }
}

function triggerAction() {
  if (mode !== "play" || !action) return;
  if (action.kind === "station") openStation(action.i);
  else if (action.kind === "board") openBoard();
  else if (action.kind === "feed") feedFish();
  else if (action.kind === "jennie") chat();
  else if (action.kind === "bench") sitOn(action.i);
  else if (action.kind === "stand") standUp();
  else openPlace(action.kind);
}
$("fp-action").addEventListener("click", triggerAction);

// 传送（时间线里的 Go）
function teleportTo(i) {
  const fade = $("fp-fade");
  fade.classList.add("is-on");
  setTimeout(() => {
    if (seat >= 0) standUp();
    const s = STATIONS[i];
    const [sx, sz] = s.stop;
    const face = Math.atan2(s.pos[0] - sx, s.pos[1] - sz);
    clearWalkTarget();
    player.root.position.set(sx, groundHeight(sx, sz), sz);
    player.root.rotation.y = face;
    cam.yaw = face + Math.PI;
    cam.target.copy(player.root.position);
    placeJennieBehind();
    fade.classList.remove("is-on");
  }, 380);
}

// 送花的小动画
const bursts = [];
const petalGeo = new THREE.IcosahedronGeometry(0.11, 0);
const petalMats = ["#f6a5c0", "#ffffff", "#ffd66e", "#ff9f8a"].map((c) => mat(c));
const heartMats = ["#f6a5c0", "#ff8fab", "#ffffff"].map((c) => mat(c, { emissive: c, emissiveIntensity: 0.3 }));
const sparkleMats = ["#ffe58a", "#ffffff", "#9fe8e2"].map((c) => mat(c, { emissive: c, emissiveIntensity: 0.6 }));
function burstAt(x, y, z, dx, dz, mats = petalMats) {
  for (let k = 0; k < 18; k++) {
    const m = new THREE.Mesh(petalGeo, mats[k % mats.length]);
    m.position.set(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5));
    const v = new THREE.Vector3(dx + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, dz + (Math.random() - 0.5) * 2);
    scene.add(m);
    bursts.push({ m, v, life: 1.6 });
  }
}
function burstFlowers(i) {
  const [sx, sz] = STATIONS[i].stop;
  const [bx, bz] = STATIONS[i].pos;
  burstAt(sx, groundHeight(sx, sz) + 1, sz, (bx - sx) * 0.12, (bz - sz) * 0.12);
}
function updateBursts(dt) {
  for (let k = bursts.length - 1; k >= 0; k--) {
    const b = bursts[k];
    b.life -= dt;
    b.v.y -= 4 * dt;
    b.m.position.addScaledVector(b.v, dt);
    b.m.rotation.x += dt * 5;
    b.m.scale.setScalar(Math.max(b.life / 1.6, 0.01));
    if (b.life <= 0) {
      scene.remove(b.m);
      bursts.splice(k, 1);
    }
  }
}

// ===== 季节 / 时间预览菜单 =====
$("fp-env-btn").addEventListener("click", (e) => {
  const menu = $("fp-env-menu");
  menu.hidden = !menu.hidden;
  e.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
});
for (const seg of document.querySelectorAll(".fp-seg")) {
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    env[seg.dataset.kind] = b.dataset.v;
    applyEnv();
  });
}

// ===== 开场：选小人 → 镜头飞到码头 → Jennie 打招呼 =====
let mode = "intro";
const OVERVIEW = { target: new THREE.Vector3(0, -6, 0), pitch: 0.5, dist: 118 };
const fly = { t: 0, yaw: 0 };
const ARRIVAL_YAW = -0.4; // 上岛时镜头稍微斜一点，灯塔不会挡住人

for (const b of document.querySelectorAll("[data-avatar]")) {
  b.addEventListener("click", () => start(b.dataset.avatar));
}

function start(kind) {
  if (player) return;
  player = makeCharacter(kind);
  player.setSeason(currentEnv().season);
  setName($("fp-name").value);
  const tag = labelSprite(visitorName || "You", null, 0.32);
  tag.position.y = 1.95;
  player.root.add(tag);
  player.root.position.set(0, PIER.y, 40.4);
  player.root.rotation.y = Math.PI;
  scene.add(player.root);
  jennie.root.rotation.y = 0;
  $("fp-intro").hidden = true;
  fly.t = 0;
  fly.yaw = cam.yaw;
  mode = "flying";
}

function beginGreeting() {
  mode = "greeting";
  jennie.wave(true);
  say(INTRO_LINES, {
    modal: true,
    onDone: () => {
      jennie.wave(false);
      jennieFollows = true;
      mode = "play";
      $("fp-hud").hidden = false;
      hudKey = "";
    },
  });
}

// ===== 镜头 =====
function placeCamera(target, yaw, pitch, dist) {
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    target.y + Math.sin(pitch) * dist,
    target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(target);
}
const followTarget = new THREE.Vector3();
const flyTarget = new THREE.Vector3();
function updateCamera(dt, t) {
  if (mode === "intro") {
    cam.yaw = t * 0.05;
    placeCamera(OVERVIEW.target, cam.yaw, OVERVIEW.pitch, OVERVIEW.dist);
    return;
  }
  followTarget.copy(player.root.position).y += 1.1;
  if (mode === "flying") {
    fly.t = Math.min(1, fly.t + dt / 2.8);
    const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
    flyTarget.lerpVectors(OVERVIEW.target, followTarget, k);
    const endYaw = Math.round(fly.yaw / (Math.PI * 2)) * Math.PI * 2 + ARRIVAL_YAW;
    placeCamera(flyTarget, lerp(fly.yaw, endYaw, k), lerp(OVERVIEW.pitch, cam.pitch, k), lerp(OVERVIEW.dist, cam.dist, k));
    if (fly.t >= 1) {
      cam.yaw = ARRIVAL_YAW;
      cam.target.copy(followTarget);
      beginGreeting();
    }
    return;
  }
  cam.target.lerp(followTarget, 1 - Math.exp(-dt * 6));
  placeCamera(cam.target, cam.yaw, cam.pitch, cam.dist);
}

// ===== 每一帧 =====
function updatePlayer(dt, t) {
  let ix = joy.x;
  let iy = joy.y;
  if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
  if (keys.has("d") || keys.has("arrowright")) ix += 1;
  if (keys.has("w") || keys.has("arrowup")) iy += 1;
  if (keys.has("s") || keys.has("arrowdown")) iy -= 1;
  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  let speed = 0;
  const p = player.root.position;
  const canMove = mode === "play" && $("fp-panel").hidden;
  if (len > 0.1) clearWalkTarget();
  if (seat >= 0 && canMove && (len > 0.1 || walkTarget)) standUp();
  if (seat >= 0) speed = 0;
  else if (canMove && len > 0.1) {
    const dx = (-Math.sin(cam.yaw) * iy + Math.cos(cam.yaw) * ix) * SPEED * dt;
    const dz = (-Math.cos(cam.yaw) * iy - Math.sin(cam.yaw) * ix) * SPEED * dt;
    moveChar(player.root, dx, dz);
    player.root.rotation.y = lerpAngle(player.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 14));
    speed = Math.min(len, 1);
  } else if (canMove && walkTarget) {
    // 点击地面后自动走过去，被挡住就停下
    const dx = walkTarget.x - p.x;
    const dz = walkTarget.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) {
      const then = pending;
      clearWalkTarget();
      then?.();
    }
    else {
      const step = Math.min(SPEED * dt, d);
      const ox = p.x;
      const oz = p.z;
      moveChar(player.root, (dx / d) * step, (dz / d) * step);
      const moved = Math.hypot(p.x - ox, p.z - oz);
      walkTarget.stuck = moved < step * 0.3 ? walkTarget.stuck + dt : 0;
      if (walkTarget.stuck > 0.35) {
        // 被挡住了：离得够近的话照样去做（比如坐下）
        const then = d < 1.6 ? pending : null;
        clearWalkTarget();
        then?.();
      }
      player.root.rotation.y = lerpAngle(player.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 14));
      speed = 1;
    }
  }
  if (targetRing.visible) targetRing.scale.setScalar(1 + Math.sin(t * 6) * 0.1);
  p.y = lerp(p.y, groundHeight(p.x, p.z), 1 - Math.exp(-dt * 18));
  // 在浅水里走会带起涟漪
  if (speed > 0.1 && groundHeight(p.x, p.z) < -0.02 && (wadeTimer -= dt) < 0) {
    world.ripple(p.x, p.z, 0.05);
    wadeTimer = 0.35;
  }
  player.update(dt, t, speed);
}
let wadeTimer = 0;

function updateJennie(dt, t) {
  let speed = 0;
  const j = jennie.root.position;
  if (player && (mode === "greeting" || mode === "flying")) {
    const p = player.root.position;
    jennie.root.rotation.y = lerpAngle(jennie.root.rotation.y, Math.atan2(p.x - j.x, p.z - j.z), 1 - Math.exp(-dt * 6));
  }
  if (jennieFollows && !jennieSeated) {
    // 走在访客的右前方（从镜头看），两个人都不会被挡住
    const p = player.root.position;
    const [tx, tz] = jennieSpot();
    const dx = tx - j.x;
    const dz = tz - j.z;
    const d = Math.hypot(dx, dz);
    if (Math.hypot(p.x - j.x, p.z - j.z) > 16) placeJennieBehind();
    else if (d > 0.45) {
      const sp = Math.min(SPEED * 1.15, d * 2.8);
      if (moveChar(jennie.root, (dx / d) * sp * dt, (dz / d) * sp * dt)) jennieStuck = 0;
      else if ((jennieStuck += dt) > 1.2) {
        placeJennieBehind();
        jennieStuck = 0;
      }
      jennie.root.rotation.y = lerpAngle(jennie.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      speed = sp / SPEED;
    } else {
      jennie.root.rotation.y = lerpAngle(jennie.root.rotation.y, player.root.rotation.y, 1 - Math.exp(-dt * 3));
    }
  }
  j.y = lerp(j.y, groundHeight(j.x, j.z), 1 - Math.exp(-dt * 18));
  jennie.update(dt, t, speed);
}

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 58 : 42;
  OVERVIEW.dist = w < h ? 190 : 140;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

const clock = new THREE.Clock();
const focus = new THREE.Vector3(0, 1, 20);
let elapsed = 0;
let started = false;
let liveTick = 0;
function tick(dt) {
  elapsed += dt;
  if (player) updatePlayer(dt, elapsed);
  updateJennie(dt, elapsed);
  fish.update(dt, elapsed);
  updateBursts(dt);
  if (cupTimer > 0 && (cupTimer -= dt) <= 0 && player) player.hold(null);
  barista.update(dt, elapsed, 0);
  updateOrder(dt);
  updateCoin(dt);
  if (player) focus.copy(player.root.position);
  world.update(dt, elapsed, focus);
  updateCamera(dt, elapsed);
  if (mode === "play") updateInteractions();
  updateDialog(dt);

  const next = mode === "play" ? nextStop() : -1;
  marker.visible = next >= 0;
  if (next >= 0) {
    const [sx, sz] = STATIONS[next].stop;
    marker.position.set(sx, groundHeight(sx, sz) + 2.6 + Math.sin(elapsed * 3) * 0.2, sz);
    marker.rotation.y += dt * 2;
  }
  if ((liveTick += dt) > 1) {
    liveTick = 0;
    const live = document.querySelector("[data-live-time]");
    if (live) live.textContent = visitTime();
  }
}

function frame() {
  tick(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
  if (!started) {
    started = true;
    $("fp-loading").hidden = true;
    if (mode === "intro") $("fp-intro").hidden = false;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 调试用：网址加 ?debug 才有，可以手动快进几帧
if (location.search.includes("debug")) {
  window.fpDebug = {
    step(n = 1, dt = 1 / 30) {
      for (let i = 0; i < n; i++) tick(dt);
      renderer.render(scene, camera);
    },
    snap(w = 560) {
      renderer.render(scene, camera);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = Math.round((w * canvas.height) / canvas.width);
      c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.72);
    },
    keys,
    joy,
    cam,
    scene,
    camera,
    world,
    renderer,
    jennie: jennie.root,
    teleportTo,
    pick: (clientX, clientY) => pick({ clientX, clientY }),
    get mode() {
      return mode;
    },
    get player() {
      return player?.root.position;
    },
  };
}
