import * as THREE from "three";
import { STATIONS, INTRO_LINES, FINISH_LINE, CHAT_LINES } from "./data.js";
import { createWorld, groundHeight, PIER, BOARD, FEED, seasonOf, timeLabel } from "./world.js";
import { buildLandmarks } from "./landmarks.js";
import { makeCharacter } from "./characters.js";
import { createFish } from "./fish.js";
import { clamp, lerp, labelSprite, mat } from "./util.js";

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
world.scatterVegetation(landmarks.specialTrees);
let fishFed = 0;
const fish = createFish(scene, { onEat: () => fishFed++, onSplash: (x, z) => world.ripple(x, z, 0.09) });

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
jennieTag.position.y = 2.25;
jennie.root.add(jennieTag);
jennie.root.userData.isJennie = true;
scene.add(jennie.root);
let jennieFollows = false;
let jennieStuck = 0;
let player = null;

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
      cam.pitch = clamp(cam.pitch + dy * 0.004, 0.22, 1.3);
    }
  } else if (pointers.size === 2) {
    const d = pinchDist();
    cam.dist = clamp((cam.dist * pinch) / d, 6, 36);
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
    if (mode === "play") cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.08), 6, 36);
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
  for (const hit of ray.intersectObjects([...landmarks.pickables, jennie.root], true)) {
    let o = hit.object;
    while (o && o.userData.station === undefined && !o.userData.isJennie) o = o.parent;
    if (!o) continue;
    if (o.userData.isJennie) chat();
    else openStation(o.userData.station);
    return;
  }
  // 点到地面就走过去；点到水面就"duang"一下
  const ground = ray.intersectObjects(world.groundMeshes, false)[0];
  if (!ground) return;
  const { x, z } = ground.point;
  if (groundHeight(x, z) < -0.15) {
    world.ripple(x, z, 0.22);
    return;
  }
  walkTarget = { x, z, stuck: 0 };
  targetRing.position.set(x, groundHeight(x, z) + 0.08, z);
  targetRing.visible = true;
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
// 留空时只在访客自己的浏览器里记；连不上（比如被墙）也不影响小岛
const STATS_URL = "https://footprint-stats.footprint-stats.workers.dev";
const remote = { id: null, stats: null };
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
api("/visit", {}).then((r) => {
  if (!r) return;
  remote.id = r.id;
  remote.stats = r;
});
function reportVisit() {
  if (!STATS_URL || !remote.id) return;
  const seconds = Math.round((performance.now() - visitStart) / 1000);
  navigator.sendBeacon?.(STATS_URL + "/leave", JSON.stringify({ id: remote.id, seconds }));
}
addEventListener("pagehide", reportVisit);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && reportVisit());

// 送花：自己送的记在浏览器里，所有人的总数来自后台
const FLOWER_KEY = "fp-flowers";
let flowerCounts = {};
try {
  flowerCounts = JSON.parse(localStorage.getItem(FLOWER_KEY)) || {};
} catch {
  flowerCounts = {};
}
function flowerNote(id) {
  const mine = flowerCounts[id] || 0;
  const all = remote.stats?.flowers?.[id];
  const parts = [];
  if (all) parts.push(`${all} flower${all > 1 ? "s" : ""} so far`);
  if (mine) parts.push(`you've sent ${mine}`);
  if (!parts.length) return "Leave a flower if you like this place.";
  const text = parts.join(" · ");
  return text[0].toUpperCase() + text.slice(1) + ".";
}
const totalFlowers = () => Object.values(flowerCounts).reduce((a, b) => a + b, 0);

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
      body.querySelector("[data-flower]").addEventListener("click", () => {
        flowerCounts[s.id] = (flowerCounts[s.id] || 0) + 1;
        try {
          localStorage.setItem(FLOWER_KEY, JSON.stringify(flowerCounts));
        } catch {
          /* 隐私模式下存不了，没关系 */
        }
        const note = body.querySelector(".fp-flower-note");
        note.textContent = flowerNote(s.id);
        burstFlowers(i);
        if (remote.id) {
          api("/flower", { id: remote.id, station: s.id }).then((r) => {
            if (r?.flowers) remote.stats = { ...remote.stats, ...r };
            note.textContent = flowerNote(s.id);
          });
        }
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
$("fp-intro-list").addEventListener("click", openTimeline);

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
  return `<ul class="fp-board">
       <li><strong>Visitors so far</strong><span>${s.visitors}</span></li>
       <li><strong>Where they come from</strong><span>${s.countries.map((c) => `${esc(regionName(c.code))} (${c.n})`).join(", ") || "–"}</span></li>
       <li><strong>Average stay</strong><span>${avg}</span></li>
       <li><strong>Flowers on the island</strong><span>${allFlowers}</span></li>
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
     ${
       STATS_URL
         ? `<p class="fp-panel-kicker">All visitors</p>${guestStats()}
            <p class="fp-note">Only each visitor's country or region and visit length are recorded. No IP addresses or personal data.</p>`
         : `<p class="fp-note">Visitor statistics (where guests come from and how long they stay) will be posted here soon.</p>`
     }`,
  );
  if (STATS_URL) api("/stats").then((r) => r && (remote.stats = { ...remote.stats, ...r }));
}

// ===== 走到哪一站 / 能做什么 =====
const visited = new Set();
const INTERACT = [
  ...STATIONS.map((s, i) => ({ kind: "station", i, x: s.stop[0], z: s.stop[1], r: 3.2, label: `Visit ${s.short}` })),
  { kind: "board", x: BOARD.x, z: BOARD.z, r: 2.9, label: "Read the bulletin" },
  { kind: "feed", x: FEED.x, z: FEED.z, r: 2.8, label: "Feed the fish" },
];
let action = null;
let hudKey = "";

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
  if (best?.label !== action?.label) {
    action = best;
    $("fp-action").hidden = !best;
    if (best) $("fp-action").textContent = best.label;
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
  else if (action.kind === "feed") {
    fish.feed(player.root.position);
    player.hop();
  } else if (action.kind === "jennie") chat();
}
$("fp-action").addEventListener("click", triggerAction);

// 传送（时间线里的 Go）
function teleportTo(i) {
  const fade = $("fp-fade");
  fade.classList.add("is-on");
  setTimeout(() => {
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
function burstFlowers(i) {
  const [sx, sz] = STATIONS[i].stop;
  const [bx, bz] = STATIONS[i].pos;
  for (let k = 0; k < 18; k++) {
    const m = new THREE.Mesh(petalGeo, petalMats[k % petalMats.length]);
    m.position.set(sx + (Math.random() - 0.5), groundHeight(sx, sz) + 1, sz + (Math.random() - 0.5));
    const v = new THREE.Vector3((bx - sx) * 0.12 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, (bz - sz) * 0.12 + (Math.random() - 0.5) * 2);
    scene.add(m);
    bursts.push({ m, v, life: 1.6 });
  }
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
  const tag = labelSprite("You", null, 0.32);
  tag.position.y = 2.15;
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
  if (canMove && len > 0.1) {
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
    if (d < 0.25) clearWalkTarget();
    else {
      const step = Math.min(SPEED * dt, d);
      const ox = p.x;
      const oz = p.z;
      moveChar(player.root, (dx / d) * step, (dz / d) * step);
      const moved = Math.hypot(p.x - ox, p.z - oz);
      walkTarget.stuck = moved < step * 0.3 ? walkTarget.stuck + dt : 0;
      if (walkTarget.stuck > 0.35) clearWalkTarget();
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
  if (jennieFollows) {
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
    get mode() {
      return mode;
    },
    get player() {
      return player?.root.position;
    },
  };
}
