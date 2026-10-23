import * as THREE from "three";
import { GLTFLoader } from "../vendor/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "../vendor/addons/loaders/DRACOLoader.js";
import { makeCharacter } from "./characters.js";

// ===== 小岛上的人物：优先用 3D 模型（footprint/models/*.glb），没有的话用代码画的小人 =====
// 模型是 Jennie 用 Tripo / Meshy 从手办图生成的，文件名：jennie.glb、boy.glb、girl.glb、barista.glb。
// 模型里的动画按名字找：walk / run（走路）、idle / stand（站着）、sit（坐）、wave / hello（挥手）。
// 这里统一做成和 characters.js 一样的用法（root、hold、sit、wave、hop、update……），main.js 不用管是哪一种。

// height：站直的身高（小岛上的单位），turn：模型如果朝错方向，在这里转一下（弧度）
const MODELS = {
  jennie: { file: "footprint/models/jennie.glb", height: 1.62, turn: 0 },
  boy: { file: "footprint/models/boy.glb", height: 1.7, turn: 0 },
  girl: { file: "footprint/models/girl.glb", height: 1.6, turn: 0 },
  barista: { file: "footprint/models/barista.glb", height: 1.72, turn: 0 },
};
const SEAT_Y = 0.5; // 长椅坐的地方离地面多高

let loader = null;
function gltfLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("vendor/addons/libs/draco/gltf/");
  loader.setDRACOLoader(draco);
  return loader;
}
// 每个模型只下载一次
const cache = {};
function loadModel(kind) {
  const cfg = MODELS[kind];
  if (!cfg) return Promise.resolve(null);
  cache[kind] ??= new Promise((resolve) => gltfLoader().load(cfg.file, resolve, undefined, () => resolve(null)));
  return cache[kind];
}

// 手上拿的咖啡杯 / 一小碟蛋糕（和代码小人用的一样大）
function heldItems() {
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const cup = new THREE.Group();
  const cupBand = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.03, 16), mat("#d9604f"));
  cup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.09, 16), mat("#fbf7ef")), cupBand);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.016, 16), mat("#8a5a3b"));
  lid.position.y = 0.05;
  cup.add(lid);
  const plate = new THREE.Group();
  plate.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.058, 0.012, 20), mat("#ffffff")));
  const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 16, 1, false, 0, Math.PI * 0.45), mat("#f6dcb4"));
  cake.position.set(-0.01, 0.031, -0.01);
  const cakeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.012, 16, 1, false, 0, Math.PI * 0.45), mat("#f6a5b8"));
  cakeTop.position.set(-0.01, 0.06, -0.01);
  plate.add(cake, cakeTop);
  cup.visible = plate.visible = false;
  const group = new THREE.Group();
  group.add(cup, plate);
  return {
    group,
    hold(what, color) {
      cup.visible = what === "cup";
      plate.visible = what === "cake";
      if (what === "cup") cupBand.material.color.set(color);
      else if (what === "cake") cakeTop.material.color.set(color);
    },
    get holding() {
      return cup.visible || plate.visible;
    },
  };
}

// 把一个 .glb 模型包装成小岛上能用的人物
function modelFigure(gltf, kind) {
  const cfg = MODELS[kind];
  const root = new THREE.Group();
  const inner = new THREE.Group(); // 跳一下 / 坐下时上下移动的是这一层
  root.add(inner);
  const turn = new THREE.Group();
  turn.rotation.y = cfg.turn;
  inner.add(turn);
  const model = gltf.scene;
  turn.add(model);
  // 缩放到设定的身高，脚踩在地上，站在原点
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = cfg.height / Math.max(size.y, 1e-6);
  model.scale.multiplyScalar(s);
  model.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false; // 带骨骼的模型动起来以后包围盒不准，别让它被裁掉
    for (const m of [o.material].flat()) if (m && "metalness" in m) m.metalness = 0; // 哑光一点，不要金属反光
  });

  // ---------- 动画
  const mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations;
  const find = (re) => clips.find((c) => re.test(c.name));
  const walkClip = find(/walk/i) || find(/run|jog/i) || (clips.length === 1 ? clips[0] : null);
  const idleClip = find(/idle|stand|breath/i) || clips.find((c) => c !== walkClip && !/sit|wave|hello/i.test(c.name)) || null;
  const sitClip = find(/sit/i);
  const waveClip = find(/wave|hello|greet/i);
  const act = (clip) => {
    if (!clip) return null;
    const a = mixer.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    return a;
  };
  const walk = act(walkClip);
  const idle = act(idleClip);
  const sit = act(sitClip);
  const wave = act(waveClip);
  if (walk && !idle) walk.time = 0;

  // ---------- 骨骼：右手（拿杯子）和屁股（坐下时对准椅子）
  let hand = null;
  let hips = null;
  model.traverse((o) => {
    if (!o.isBone) return;
    if (!hand && /(right.?hand|hand.?r\b|hand_r|r_hand)/i.test(o.name)) hand = o;
    if (!hips && /(hips|pelvis)/i.test(o.name)) hips = o;
  });
  const items = heldItems();
  const holder = new THREE.Group();
  holder.add(items.group);
  if (hand) hand.add(holder);
  else {
    holder.position.set(-0.2, cfg.height * 0.45, 0.12);
    inner.add(holder);
  }
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();

  let sitting = false;
  let waving = false;
  let bounce = 0;
  let blend = 0; // 0 站着 → 1 走路
  let sitLift = 0;

  return {
    root,
    canSit: !!sit,
    hold: items.hold,
    get holding() {
      return items.holding;
    },
    wave(on) {
      waving = on;
    },
    hop() {
      bounce = 1;
    },
    sit(on) {
      sitting = on && !!sit;
      sitLift = 0;
      if (sitting && hips) {
        // 先摆一下坐姿，看屁股有多高，再把整个人挪到椅子的高度
        for (const a of [walk, idle, wave]) a?.setEffectiveWeight(0);
        sit.setEffectiveWeight(1);
        mixer.update(0);
        root.updateMatrixWorld(true);
        hips.getWorldPosition(tmpV);
        sitLift = SEAT_Y + 0.06 - root.worldToLocal(tmpV).y;
      }
    },
    get sitting() {
      return sitting;
    },
    setSeason() {
      /* 模型的衣服是固定的 */
    },
    update(dt, t, speed) {
      const move = sitting ? 0 : Math.min(speed, 1);
      blend += (move - blend) * (1 - Math.exp(-dt * 10));
      if (walk) {
        walk.setEffectiveWeight(sitting ? 0 : idle ? blend : 1);
        walk.timeScale = idle ? 0.7 + 0.6 * move : move > 0.05 ? 0.7 + 0.6 * move : 0;
      }
      idle?.setEffectiveWeight(sitting || (waving && wave) ? 0 : 1 - blend);
      sit?.setEffectiveWeight(sitting ? 1 : 0);
      wave?.setEffectiveWeight(waving && !sitting ? 1 : 0);
      mixer.update(dt);
      bounce = Math.max(0, bounce - dt * 2.5);
      const hop = Math.sin(bounce * Math.PI) * 0.3 + (!wave && waving ? Math.abs(Math.sin(t * 6)) * 0.08 : 0);
      inner.position.y = hop + (sitting ? sitLift : 0);
      // 杯子保持竖直（不跟着手腕歪）
      if (items.holding) {
        if (hand) {
          hand.getWorldQuaternion(tmpQ).invert();
          root.getWorldQuaternion(holder.quaternion);
          holder.quaternion.premultiply(tmpQ);
          hand.getWorldScale(tmpV);
          holder.scale.setScalar(1 / tmpV.x);
        }
      }
    },
  };
}

// 先用代码画的小人，模型下载好了就换成模型（位置、手上拿的东西、坐着没坐着都保持不变）
export function createFigure(kind) {
  const root = new THREE.Group();
  let impl = makeCharacter(kind);
  root.add(impl.root);
  const state = { season: null, hold: null, color: null, sitting: false, waving: false };
  const api = {
    root,
    get isModel() {
      return impl.root.userData.isModel === true;
    },
    get canSit() {
      return impl.canSit !== false;
    },
    hold(what, color) {
      state.hold = what;
      state.color = color;
      impl.hold(what, color);
    },
    get holding() {
      return impl.holding;
    },
    setCupColor(c) {
      api.hold("cup", c);
    },
    wave(on) {
      state.waving = on;
      impl.wave(on);
    },
    hop() {
      impl.hop();
    },
    sit(on) {
      state.sitting = on;
      impl.sit(on);
    },
    get sitting() {
      return state.sitting;
    },
    setSeason(name) {
      state.season = name;
      impl.setSeason(name);
    },
    update(dt, t, speed) {
      impl.update(dt, t, speed);
    },
  };
  loadModel(kind).then((gltf) => {
    if (!gltf) return;
    const next = modelFigure(gltf, kind);
    next.root.userData.isModel = true;
    root.remove(impl.root);
    impl = next;
    root.add(impl.root);
    if (state.hold) impl.hold(state.hold, state.color);
    if (state.waving) impl.wave(true);
    if (state.sitting) impl.sit(true);
  });
  return api;
}
