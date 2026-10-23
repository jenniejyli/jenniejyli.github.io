import * as THREE from "three";
import { mat, shadowed } from "./util.js";

// Q 版小人：大头、小身子。jennie 照着照片做（墨绿蓝长发、头顶墨镜、白色羽绒服、米白围巾），
// boy / girl 是访客可以选的样子。
const LOOKS = {
  jennie: { hair: "#33505f", top: "#eef0f2", pants: "#4a4f5c", shoes: "#ece6dc", style: "long", scarf: "#f3e9d6", sunglasses: true },
  boy: { hair: "#3d2f28", top: "#a9c7e0", pants: "#d8c6a6", shoes: "#f4f4f2", style: "short", backpack: "#e3b65a" },
  girl: { hair: "#6b4a3a", top: "#d9c3a2", pants: "#5d5a66", shoes: "#3f3a3a", style: "wavy", glasses: true },
};

const SKIN = "#f7dcc8";

export function makeCharacter(kind) {
  const look = LOOKS[kind];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = mat(SKIN, { roughness: 0.7 });
  const hairMat = mat(look.hair, { roughness: 0.6 });
  const topMat = mat(look.top, { roughness: 0.85 });
  const pantsMat = mat(look.pants);
  const shoeMat = mat(look.shoes);
  const dark = mat("#1f2430", { roughness: 0.4 });

  // 腿
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.45, 0);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.24, 4, 10), pantsMat);
    l.position.y = -0.2;
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), shoeMat);
    shoe.scale.set(1, 0.6, 1.35);
    shoe.position.set(0, -0.4, 0.04);
    leg.add(l, shoe);
    body.add(leg);
    legs.push(leg);
  }

  // 身体（羽绒服 / 上衣）
  const torsoGeo = new THREE.CapsuleGeometry(0.27, 0.26, 6, 16);
  const torso = new THREE.Mesh(torsoGeo, topMat);
  torso.position.y = 0.72;
  torso.scale.set(1, 1, 0.86);
  body.add(torso);
  if (kind === "jennie") {
    for (const y of [0.6, 0.78]) {
      const puff = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 24), topMat);
      puff.rotation.x = Math.PI / 2;
      puff.scale.set(1, 0.86, 1);
      puff.position.y = y;
      body.add(puff);
    }
  }
  if (look.scarf) {
    const scarfMat = mat(look.scarf, { roughness: 1 });
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.085, 8, 20), scarfMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = 0.96;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.08), scarfMat);
    tail.position.set(-0.06, 0.8, 0.25);
    tail.rotation.z = 0.08;
    body.add(wrap, tail);
  }
  if (look.backpack) {
    const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.16, 4, 10), mat(look.backpack));
    pack.scale.set(1.15, 1, 0.6);
    pack.position.set(0, 0.74, -0.27);
    body.add(pack);
  }

  // 手臂
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 0.9, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 4, 8), topMat);
    a.position.y = -0.17;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin);
    hand.position.y = -0.35;
    arm.add(a, hand);
    arm.rotation.z = side * 0.18;
    body.add(arm);
    arms.push(arm);
  }

  // 头
  const head = new THREE.Group();
  head.position.y = 1.22;
  body.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), skin);
  face.scale.set(1, 0.95, 0.95);
  head.add(face);
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), dark);
    eye.scale.set(1, 1.3, 0.5);
    eye.position.set(side * 0.14, -0.02, 0.385);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat("#ffffff", { roughness: 0.2 }));
    shine.position.set(0.018, 0.03, 0.03);
    eye.add(shine);
    head.add(eye);
    eyes.push(eye);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), mat("#f4a7a0", { transparent: true, opacity: 0.55 }));
    blush.position.set(side * 0.23, -0.1, 0.355);
    blush.rotation.y = side * 0.45;
    head.add(blush);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 14, Math.PI), mat("#b0645c"));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.12, 0.395);
  head.add(smile);

  // 头发
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.455, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  cap.position.set(0, 0.02, -0.02);
  head.add(cap);
  const bangs = new THREE.Mesh(
    new THREE.SphereGeometry(0.448, 24, 10, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.16, Math.PI * (look.style === "short" ? 0.2 : 0.27)),
    hairMat,
  );
  head.add(bangs);
  if (look.style === "long" || look.style === "wavy") {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.5, 6, 16), hairMat);
    back.scale.set(1.12, 1, 0.42);
    back.position.set(0, -0.36, -0.2);
    head.add(back);
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.5, 4, 10), hairMat);
      lock.position.set(side * 0.37, -0.36, 0.06);
      lock.rotation.z = side * -0.06;
      head.add(lock);
      if (look.style === "wavy") {
        for (let k = 0; k < 3; k++) {
          const curl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hairMat);
          curl.position.set(side * (0.33 + (k % 2) * 0.05), -0.25 - k * 0.2, -0.05);
          head.add(curl);
        }
      }
    }
  }
  if (look.sunglasses) {
    const shades = new THREE.Group();
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.035), dark);
      lens.position.x = side * 0.11;
      shades.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), dark);
    bridge.position.y = 0.02;
    shades.add(bridge);
    shades.position.set(0, 0.36, 0.25);
    shades.rotation.x = -0.75;
    head.add(shades);
  }
  if (look.glasses) {
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 18), dark);
      rim.position.set(side * 0.14, -0.02, 0.41);
      head.add(rim);
    }
  }

  shadowed(root, true, false);

  let phase = 0;
  let blinkAt = 2 + Math.random() * 3;
  let waving = false;
  let bounce = 0;

  return {
    root,
    wave(on) {
      waving = on;
    },
    hop() {
      bounce = 1;
    },
    update(dt, t, speed) {
      const move = Math.min(speed, 1);
      phase += dt * (6 + 5 * move) * (move > 0.05 ? 1 : 0);
      const swing = Math.sin(phase) * 0.65 * move;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      arms[0].rotation.x = -swing * 0.9;
      arms[1].rotation.x = waving ? 0 : swing * 0.9;
      arms[1].rotation.z = waving ? -2.6 + Math.sin(t * 9) * 0.3 : 0.18;
      bounce = Math.max(0, bounce - dt * 2.5);
      body.position.y = Math.abs(Math.sin(phase)) * 0.06 * move + Math.sin(bounce * Math.PI) * 0.35;
      head.rotation.z = Math.sin(t * 1.6) * 0.03 * (1 - move);
      head.position.y = 1.22 + Math.sin(t * 2.2) * 0.012;
      blinkAt -= dt;
      const blink = blinkAt < 0.12 && blinkAt > 0 ? 0.15 : 1.3;
      for (const e of eyes) e.scale.y = blink;
      if (blinkAt < 0) blinkAt = 2.5 + Math.random() * 3;
    },
  };
}
