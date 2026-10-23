import * as THREE from "three";
import { canvasTexture, smoothstep } from "./util.js";

// 动森风格的 Q 版小人：大圆头 + 画出来的脸（大眼睛、睫毛、腮红）+ 一整片的头发。
// jennie 照着照片做：深色到蓝绿渐变的长直发、斜刘海、头顶墨镜、白色羽绒服、米白针织围巾。
// boy / girl 是访客可以选的样子。

const SKIN = "#fde5d6";
const HEAD_R = 0.46;
const HEAD_SCALE = [1.08, 0.94, 1.0];

const LOOKS = {
  jennie: {
    hair: ["#1f2633", "#3f7f8f"],
    eye: "#4a3a3c",
    top: "#f6f7f9",
    pants: "#3d4352",
    shoes: "#f3f0ea",
    style: "long",
    hairEnd: -0.7,
    bang: { base: 0.4, slant: 0.06, depth: 0.05, locks: 3.5 },
    lashes: true,
    mouth: "smile",
    sunglasses: true,
    scarf: "#f1e6d0",
    puffer: true,
  },
  boy: {
    hair: ["#2e231d", "#4a3629"],
    eye: "#3a2c28",
    top: "#a9cbe6",
    pants: "#d9c6a5",
    shoes: "#f6f6f4",
    style: "short",
    bang: { base: 0.34, slant: 0.0, depth: 0.08, locks: 5 },
    mouth: "open",
    hoodie: true,
    backpack: "#e8b860",
  },
  girl: {
    hair: ["#5a3b2e", "#8d6249"],
    eye: "#4b3428",
    top: "#dcc7a6",
    pants: "#5d5a66",
    shoes: "#7a5644",
    style: "wavy",
    hairEnd: -0.62,
    bang: { base: 0.38, slant: -0.03, depth: 0.05, locks: 4 },
    lashes: true,
    mouth: "cat",
    glasses: true,
    belt: "#9b7656",
    clip: "#f6a5c0",
    lanyard: true,
  },
};

// ---------- 脸（画在贴图上，贴在脸的前半部分）
const FACE = { phi: 1.9, t0: 0.36 * Math.PI, t1: 0.72 * Math.PI, W: 1024, H: 530 };

function faceTexture(look, closed) {
  const { W, H } = FACE;
  return canvasTexture(W, H, (g) => {
    g.lineCap = "round";
    // 腮红
    for (const x of [0.22 * W, 0.78 * W]) {
      const grad = g.createRadialGradient(x, 0.64 * H, 0, x, 0.64 * H, 70);
      grad.addColorStop(0, "rgba(255,140,140,0.55)");
      grad.addColorStop(1, "rgba(255,140,140,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, 0.64 * H, 72, 40, 0, 0, Math.PI * 2);
      g.fill();
    }
    // 眉毛
    g.strokeStyle = look.hair[0];
    g.lineWidth = 9;
    for (const s of [-1, 1]) {
      const x = 0.5 * W + s * 0.175 * W;
      g.beginPath();
      g.moveTo(x - 32, 0.205 * H + 4);
      g.quadraticCurveTo(x, 0.175 * H, x + 32, 0.205 * H + 4);
      g.stroke();
    }
    // 眼睛
    for (const s of [-1, 1]) {
      const cx = 0.5 * W + s * 0.173 * W;
      const cy = 0.47 * H;
      if (closed) {
        g.strokeStyle = "#2a1f24";
        g.lineWidth = 11;
        g.beginPath();
        g.moveTo(cx - 52, cy + 6);
        g.quadraticCurveTo(cx, cy + 40, cx + 52, cy + 6);
        g.stroke();
        continue;
      }
      const grad = g.createLinearGradient(0, cy - 75, 0, cy + 75);
      grad.addColorStop(0, "#1f1619");
      grad.addColorStop(0.55, "#2a1f24");
      grad.addColorStop(1, look.eye);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(cx, cy, 56, 74, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.beginPath();
      g.ellipse(cx, cy + 34, 34, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(cx + 16, cy - 28, 19, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx - 20, cy + 28, 8, 0, Math.PI * 2);
      g.fill();
      // 上眼线 + 外侧睫毛
      g.strokeStyle = "#1f1619";
      g.lineWidth = 10;
      g.beginPath();
      g.ellipse(cx, cy + 4, 62, 80, 0, Math.PI * 1.12, Math.PI * 1.88);
      g.stroke();
      if (look.lashes) {
        g.lineWidth = 7;
        const ox = cx + s * 58;
        g.beginPath();
        g.moveTo(ox, cy - 38);
        g.lineTo(ox + s * 22, cy - 56);
        g.moveTo(ox - s * 6, cy - 52);
        g.lineTo(ox + s * 10, cy - 74);
        g.stroke();
      }
    }
    // 鼻子
    g.fillStyle = "rgba(225,140,120,0.45)";
    g.beginPath();
    g.ellipse(0.5 * W, 0.6 * H, 8, 6, 0, 0, Math.PI * 2);
    g.fill();
    // 嘴巴
    const mx = 0.5 * W;
    const my = 0.745 * H;
    g.strokeStyle = "#b5574f";
    g.lineWidth = 8;
    if (look.mouth === "open") {
      g.fillStyle = "#8f3b3b";
      g.beginPath();
      g.moveTo(mx - 30, my - 8);
      g.quadraticCurveTo(mx, my + 44, mx + 30, my - 8);
      g.closePath();
      g.fill();
      g.fillStyle = "#e98282";
      g.beginPath();
      g.ellipse(mx, my + 14, 14, 8, 0, 0, Math.PI * 2);
      g.fill();
    } else if (look.mouth === "cat") {
      g.beginPath();
      g.moveTo(mx - 28, my - 4);
      g.quadraticCurveTo(mx - 14, my + 16, mx, my);
      g.quadraticCurveTo(mx + 14, my + 16, mx + 28, my - 4);
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(mx - 24, my - 4);
      g.quadraticCurveTo(mx, my + 20, mx + 24, my - 4);
      g.stroke();
    }
  });
}

// ---------- 参数曲面（头发用）
function surface(cols, rows, fn) {
  const pos = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pos.push(...fn(i / cols, j / rows));
  const idx = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      idx.push(b, a, d, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const sph = (R, phi, theta) => [-R * Math.cos(phi) * Math.sin(theta) * HEAD_SCALE[0], R * Math.cos(theta) * HEAD_SCALE[1], R * Math.sin(phi) * Math.sin(theta) * HEAD_SCALE[2]];
const fromFront = (phi) => Math.abs(((((phi - Math.PI / 2) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

function hairGeometries(look) {
  const parts = [];
  const short = look.style === "short";
  // 头顶到两侧/后脑：前面只盖到发际线
  parts.push(
    surface(56, 22, (u, v) => {
      const phi = u * Math.PI * 2;
      const tMax = Math.PI * (0.3 + (short ? 0.27 : 0.32) * smoothstep(0.45, 1.25, fromFront(phi)));
      return sph(0.492, phi, v * tMax);
    }),
  );
  // 刘海：一缕一缕，尖尖的发梢，可以往一边斜
  const B = look.bang;
  parts.push(
    surface(48, 12, (u, v) => {
      const off = (u - 0.5) * 2.3;
      const phi = Math.PI / 2 + off;
      const lock = Math.pow(Math.abs(Math.sin(off * B.locks + 0.6)), 0.55);
      const tBottom = Math.PI * (B.base + B.slant * (off / 1.15) + B.depth * (1 - lock));
      const theta = Math.PI * 0.1 + v * (tBottom - Math.PI * 0.1);
      return sph(0.5 + 0.018 * v, phi, theta);
    }),
  );
  if (!short) {
    // 后面和两边垂下来的长发（脸前面留出来）
    parts.push(
      surface(60, 26, (u, v) => {
        // 越往下越只留在背后（肩膀以下不挡手臂）
        const gap = 0.88 + 0.85 * smoothstep(0.3, 0.6, v);
        const off = gap + u * (Math.PI * 2 - gap * 2);
        const phi = Math.PI / 2 + off;
        const yEnd = look.hairEnd + 0.05 * Math.sin(phi * 7);
        const y = 0.06 + v * (yEnd - 0.06);
        let R = 0.508 - 0.065 * smoothstep(0, 0.5, v) + 0.03 * smoothstep(0.8, 1, v);
        if (look.style === "wavy") R += 0.028 * Math.sin(v * 15 + phi * 3) * smoothstep(0.15, 0.4, v);
        return [-R * Math.cos(phi) * HEAD_SCALE[0], y, R * Math.sin(phi) * HEAD_SCALE[2] - 0.02];
      }),
    );
  } else {
    // 短发的呆毛
    const g = new THREE.ConeGeometry(0.05, 0.22, 8);
    g.rotateZ(-0.5);
    g.translate(0.06, 0.52, -0.02);
    parts.push(g);
  }
  // 头发颜色：上深下浅（渐变）
  const top = new THREE.Color(look.hair[0]);
  const bottom = new THREE.Color(look.hair[1]);
  const c = new THREE.Color();
  for (const g of parts) {
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      c.copy(bottom).lerp(top, smoothstep(-0.75, 0.35, p.getY(i)));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  }
  return parts;
}

const soft = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, ...extra });

function add(parent, geo, material, pos = [0, 0, 0], { rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  parent.add(m);
  return m;
}

export function makeCharacter(kind) {
  const look = LOOKS[kind];
  const root = new THREE.Group();
  root.scale.setScalar(1.12);
  const body = new THREE.Group();
  root.add(body);

  const skin = soft(SKIN, { roughness: 0.7 });
  const top = soft(look.top, { roughness: 0.8 });
  const pants = soft(look.pants);
  const shoes = soft(look.shoes);

  // 腿和鞋
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.42, 0);
    add(leg, new THREE.CapsuleGeometry(0.095, 0.2, 6, 14), pants, [0, -0.17, 0]);
    add(leg, new THREE.SphereGeometry(0.115, 18, 12), shoes, [0, -0.36, 0.04], { scale: [1, 0.62, 1.38] });
    body.add(leg);
    legs.push(leg);
  }

  // 身体
  add(body, new THREE.CapsuleGeometry(0.26, 0.22, 10, 28), top, [0, 0.66, 0], { scale: [1, 1, 0.86] });
  if (look.puffer) {
    for (const y of [0.5, 0.64, 0.78]) add(body, new THREE.TorusGeometry(0.262, 0.032, 10, 36), top, [0, y, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.86, 1] });
    add(body, new THREE.BoxGeometry(0.014, 0.42, 0.01), soft("#cfd4dc"), [0, 0.64, 0.232]);
    add(body, new THREE.TorusGeometry(0.17, 0.06, 10, 24), top, [0, 0.95, -0.04], { rot: [1.35, 0, 0] });
  }
  if (look.hoodie) {
    add(body, new THREE.TorusGeometry(0.17, 0.07, 12, 28), top, [0, 0.97, -0.14], { rot: [1.1, 0, 0] });
    for (const x of [-0.06, 0.06]) add(body, new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), soft("#ffffff"), [x, 0.84, 0.23]);
    add(body, new THREE.BoxGeometry(0.26, 0.11, 0.02), soft("#96bbd8"), [0, 0.54, 0.225]);
  }
  if (look.belt) {
    add(body, new THREE.TorusGeometry(0.262, 0.028, 8, 36), soft(look.belt), [0, 0.6, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.86, 1] });
    for (const y of [0.72, 0.82]) add(body, new THREE.SphereGeometry(0.018, 8, 6), soft("#7d5c45"), [0.06, y, 0.226]);
    add(body, new THREE.TorusGeometry(0.16, 0.05, 10, 24), top, [0, 0.95, 0.02], { rot: [Math.PI / 2, 0, 0] });
  }
  if (look.lanyard) {
    add(body, new THREE.TorusGeometry(0.15, 0.008, 6, 24, Math.PI), soft("#3f6fb5"), [0, 0.88, 0.17], { rot: [0.4, 0, Math.PI] });
    add(body, new THREE.BoxGeometry(0.1, 0.13, 0.012), soft("#ffffff"), [0, 0.7, 0.24], { rot: [-0.08, 0, 0] });
    add(body, new THREE.BoxGeometry(0.1, 0.03, 0.014), soft("#3f6fb5"), [0, 0.75, 0.243], { rot: [-0.08, 0, 0] });
  }
  if (look.scarf) {
    const knit = soft(look.scarf, { roughness: 1 });
    add(body, new THREE.TorusGeometry(0.19, 0.09, 12, 32), knit, [0, 0.97, 0], { rot: [Math.PI / 2, 0, 0] });
    for (const [x, y, z, rz] of [
      [-0.07, 0.79, 0.24, 0.08],
      [0.03, 0.76, 0.25, -0.06],
    ]) {
      const t = add(body, new THREE.CapsuleGeometry(0.065, 0.2, 6, 12), knit, [x, y, z], { rot: [0.12, 0, rz], scale: [1, 1, 0.45] });
      for (const fx of [-0.035, 0, 0.035]) add(t, new THREE.BoxGeometry(0.012, 0.05, 0.02), knit, [fx, -0.17, 0]);
    }
  }
  if (look.backpack) {
    const pack = soft(look.backpack);
    add(body, new THREE.CapsuleGeometry(0.17, 0.14, 6, 16), pack, [0, 0.72, -0.27], { scale: [1.15, 1, 0.6] });
    for (const x of [-0.13, 0.13]) add(body, new THREE.BoxGeometry(0.05, 0.36, 0.02), pack, [x, 0.75, 0.215], { rot: [-0.12, 0, 0] });
  }

  // 手臂
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 0.9, 0);
    add(arm, new THREE.CapsuleGeometry(0.078, 0.2, 6, 14), top, [0, -0.16, 0]);
    add(arm, new THREE.SphereGeometry(0.07, 14, 10), skin, [0, -0.33, 0]);
    arm.rotation.z = side * 0.2;
    body.add(arm);
    arms.push(arm);
  }

  // 头：圆脸 + 画上去的五官
  const head = new THREE.Group();
  head.position.y = 1.3;
  body.add(head);
  add(head, new THREE.SphereGeometry(HEAD_R, 48, 36), skin, [0, 0, 0], { scale: HEAD_SCALE });
  if (look.style === "short") {
    for (const side of [-1, 1]) add(head, new THREE.SphereGeometry(0.075, 12, 10), skin, [side * 0.49, -0.06, 0], { scale: [0.6, 1, 0.8] });
  }
  const faceOpen = faceTexture(look, false);
  const faceClosed = faceTexture(look, true);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceOpen, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  add(head, new THREE.SphereGeometry(HEAD_R + 0.002, 48, 24, Math.PI / 2 - FACE.phi / 2, FACE.phi, FACE.t0, FACE.t1 - FACE.t0), faceMat, [0, 0, 0], { scale: HEAD_SCALE });

  const hairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
  for (const g of hairGeometries(look)) add(head, g, hairMat);

  if (look.sunglasses) {
    const shades = new THREE.Group();
    const lensMat = soft("#1c2230", { roughness: 0.2, metalness: 0.3 });
    for (const side of [-1, 1]) add(shades, new THREE.CylinderGeometry(0.085, 0.085, 0.03, 28), lensMat, [side * 0.115, 0, 0], { rot: [Math.PI / 2, 0, 0], scale: [1.15, 1, 1] });
    add(shades, new THREE.BoxGeometry(0.06, 0.018, 0.018), lensMat, [0, 0.02, 0]);
    shades.position.set(0, 0.43, 0.27);
    shades.rotation.x = -0.9;
    head.add(shades);
  }
  if (look.glasses) {
    const frame = soft("#3a3036", { roughness: 0.3 });
    for (const side of [-1, 1]) add(head, new THREE.TorusGeometry(0.088, 0.011, 8, 28), frame, [side * 0.165, -0.035, 0.447]);
    add(head, new THREE.BoxGeometry(0.075, 0.012, 0.012), frame, [0, -0.02, 0.458]);
  }
  if (look.clip) {
    const clip = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      add(clip, new THREE.SphereGeometry(0.035, 8, 6), soft(look.clip), [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0]);
    }
    add(clip, new THREE.SphereGeometry(0.025, 8, 6), soft("#ffd34d"), [0, 0, 0.015]);
    clip.position.set(0.36, 0.24, 0.3);
    clip.rotation.y = 0.7;
    head.add(clip);
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.material !== faceMat;
      o.receiveShadow = false;
    }
  });

  // 拿在手上的咖啡杯（在咖啡店买了以后出现）
  const cup = new THREE.Group();
  add(cup, new THREE.CylinderGeometry(0.06, 0.048, 0.13, 14), soft("#fbf7ef"), [0, 0, 0]);
  add(cup, new THREE.CylinderGeometry(0.062, 0.062, 0.025, 14), soft("#8a5a3b"), [0, 0.07, 0]);
  add(cup, new THREE.CylinderGeometry(0.061, 0.061, 0.04, 14), soft("#d9604f"), [0, -0.01, 0]);
  cup.position.set(0, -0.38, 0.08);
  cup.visible = false;
  arms[0].add(cup);

  let phase = 0;
  let blinkAt = 2 + Math.random() * 3;
  let waving = false;
  let bounce = 0;

  return {
    root,
    cup,
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
      arms[0].rotation.x = cup.visible ? -0.9 : -swing * 0.9;
      arms[1].rotation.x = waving ? 0 : swing * 0.9;
      arms[1].rotation.z = waving ? -2.6 + Math.sin(t * 9) * 0.3 : 0.2;
      bounce = Math.max(0, bounce - dt * 2.5);
      const hopY = Math.sin(bounce * Math.PI);
      body.position.y = Math.abs(Math.sin(phase)) * 0.06 * move + hopY * 0.35;
      body.scale.set(1 + hopY * 0.06, 1 - hopY * 0.08 + Math.sin(t * 2.2) * 0.008, 1 + hopY * 0.06);
      head.rotation.z = Math.sin(t * 1.6) * 0.04 * (1 - move);
      head.position.y = 1.3 + Math.sin(t * 2.2) * 0.012;
      blinkAt -= dt;
      const closed = blinkAt < 0.13 && blinkAt > 0;
      const map = closed ? faceClosed : faceOpen;
      if (faceMat.map !== map) faceMat.map = map;
      if (blinkAt < 0) blinkAt = 2.5 + Math.random() * 3;
    },
  };
}
