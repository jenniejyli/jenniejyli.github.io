import * as THREE from "three";

// Q 版小人：大头、大眼睛、腮红，外面一圈深色描边（卡通感）。
// jennie 照着照片做：深色到蓝绿渐变的长发、斜刘海、头顶圆墨镜、白色羽绒服、米白针织围巾。
// boy / girl 是访客可以选的样子。

const SKIN = "#fbe3d3";
const LINE = "#3d3442";

const outlineMat = new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide });
outlineMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * 0.016;");
};

const soft = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function add(parent, geo, material, pos = [0, 0, 0], { rot = [0, 0, 0], scale = [1, 1, 1], outline = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  if (outline) m.add(new THREE.Mesh(geo, outlineMat));
  parent.add(m);
  return m;
}

// 头发从上到下的渐变色（在头部坐标里算）
function paintGradient(mesh, top, bottom, y0, y1) {
  mesh.updateMatrix();
  const geo = mesh.geometry;
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const a = new THREE.Color(top);
  const b = new THREE.Color(bottom);
  const c = new THREE.Color();
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrix);
    const t = THREE.MathUtils.smoothstep(v.y, y1, y0);
    c.copy(b).lerp(a, t);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
}

const LOOKS = {
  jennie: {
    hair: ["#232c3a", "#4f8fa0"],
    top: "#f4f5f7",
    pants: "#3f4452",
    shoes: "#f2efe9",
    hairStyle: "long",
    lashes: true,
    sunglasses: true,
    scarf: "#f1e6d0",
    puffer: true,
  },
  boy: {
    hair: ["#33261f", "#4b382d"],
    top: "#a9cbe6",
    pants: "#d9c6a5",
    shoes: "#f6f6f4",
    hairStyle: "short",
    hoodie: true,
    backpack: "#e8b860",
  },
  girl: {
    hair: ["#5d3f31", "#8a6046"],
    top: "#dcc7a6",
    pants: "#5d5a66",
    shoes: "#7a5644",
    hairStyle: "wavy",
    lashes: true,
    glasses: true,
    belt: "#9b7656",
    clip: "#f6a5c0",
  },
};

export function makeCharacter(kind) {
  const look = LOOKS[kind];
  const root = new THREE.Group();
  root.scale.setScalar(1.12);
  const body = new THREE.Group();
  root.add(body);

  const skin = soft(SKIN);
  const top = soft(look.top, { roughness: 0.75 });
  const pants = soft(look.pants);
  const shoes = soft(look.shoes);
  const dark = soft("#2b2230", { roughness: 0.3 });
  const white = soft("#ffffff", { roughness: 0.2 });
  const hairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });

  // 腿和鞋
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.42, 0);
    add(leg, new THREE.CapsuleGeometry(0.095, 0.2, 6, 14), pants, [0, -0.17, 0]);
    add(leg, new THREE.SphereGeometry(0.115, 16, 12), shoes, [0, -0.36, 0.04], { scale: [1, 0.62, 1.38] });
    body.add(leg);
    legs.push(leg);
  }

  // 身体
  add(body, new THREE.CapsuleGeometry(0.26, 0.22, 8, 24), top, [0, 0.66, 0], { scale: [1, 1, 0.86] });
  if (look.puffer) {
    for (const y of [0.52, 0.66, 0.8]) {
      add(body, new THREE.TorusGeometry(0.262, 0.03, 8, 32), top, [0, y, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.86, 1], outline: false });
    }
    add(body, new THREE.BoxGeometry(0.014, 0.42, 0.01), soft("#c9ced6"), [0, 0.64, 0.232], { outline: false });
  }
  if (look.hoodie) {
    add(body, new THREE.TorusGeometry(0.17, 0.07, 10, 24), top, [0, 0.97, -0.14], { rot: [1.1, 0, 0] });
    for (const x of [-0.06, 0.06]) add(body, new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), white, [x, 0.84, 0.23], { outline: false });
    add(body, new THREE.BoxGeometry(0.26, 0.11, 0.02), soft("#96bbd8"), [0, 0.54, 0.225], { outline: false });
  }
  if (look.belt) {
    add(body, new THREE.TorusGeometry(0.262, 0.028, 8, 32), soft(look.belt), [0, 0.6, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.86, 1], outline: false });
    for (const y of [0.72, 0.82]) add(body, new THREE.SphereGeometry(0.018, 8, 6), soft("#7d5c45"), [0.06, y, 0.226], { outline: false });
    add(body, new THREE.TorusGeometry(0.16, 0.05, 8, 20), top, [0, 0.95, 0.02], { rot: [Math.PI / 2, 0, 0] });
  }
  if (look.scarf) {
    const knit = soft(look.scarf, { roughness: 1 });
    add(body, new THREE.TorusGeometry(0.19, 0.09, 12, 28), knit, [0, 0.97, 0], { rot: [Math.PI / 2, 0, 0] });
    const tails = [
      [-0.07, 0.79, 0.24, 0.08],
      [0.03, 0.76, 0.25, -0.06],
    ];
    for (const [x, y, z, rz] of tails) {
      const t = add(body, new THREE.CapsuleGeometry(0.065, 0.2, 6, 12), knit, [x, y, z], { rot: [0.12, 0, rz], scale: [1, 1, 0.45] });
      for (const fx of [-0.035, 0, 0.035]) add(t, new THREE.BoxGeometry(0.012, 0.05, 0.02), knit, [fx, -0.17, 0], { outline: false });
    }
  }
  if (look.backpack) {
    const pack = soft(look.backpack);
    add(body, new THREE.CapsuleGeometry(0.17, 0.14, 6, 14), pack, [0, 0.72, -0.27], { scale: [1.15, 1, 0.6] });
    for (const x of [-0.13, 0.13]) add(body, new THREE.BoxGeometry(0.05, 0.36, 0.02), pack, [x, 0.75, 0.215], { rot: [-0.12, 0, 0], outline: false });
  }

  // 手臂
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 0.9, 0);
    add(arm, new THREE.CapsuleGeometry(0.075, 0.2, 6, 12), top, [0, -0.16, 0]);
    add(arm, new THREE.SphereGeometry(0.072, 12, 10), skin, [0, -0.33, 0]);
    arm.rotation.z = side * 0.2;
    body.add(arm);
    arms.push(arm);
  }

  // 头
  const head = new THREE.Group();
  head.position.y = 1.3;
  body.add(head);
  add(head, new THREE.SphereGeometry(0.45, 40, 30), skin, [0, 0, 0], { scale: [1.04, 0.95, 0.97] });
  if (look.hairStyle === "short") {
    for (const side of [-1, 1]) add(head, new THREE.SphereGeometry(0.07, 10, 8), skin, [side * 0.455, -0.06, 0], { scale: [0.6, 1, 0.8] });
  }

  // 眼睛：大大的黑眼珠 + 两个高光，女生有睫毛
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = add(head, new THREE.SphereGeometry(0.07, 18, 14), dark, [side * 0.16, -0.07, 0.395], { scale: [0.85, 1.25, 0.45], outline: false });
    add(eye, new THREE.SphereGeometry(0.022, 10, 8), white, [0.022, 0.026, 0.058], { outline: false });
    add(eye, new THREE.SphereGeometry(0.012, 8, 6), white, [-0.02, -0.028, 0.062], { outline: false });
    eyes.push(eye);
    if (look.lashes) add(head, new THREE.BoxGeometry(0.05, 0.014, 0.012), dark, [side * 0.215, 0.015, 0.385], { rot: [0, side * 0.4, side * 0.5], outline: false });
    add(head, new THREE.CapsuleGeometry(0.011, 0.065, 4, 8), soft(look.hair[0]), [side * 0.16, 0.085, 0.41], { rot: [0, 0, Math.PI / 2 + side * 0.12], outline: false });
    add(head, new THREE.CircleGeometry(0.055, 20), soft("#ff9f9f", { transparent: true, opacity: 0.5 }), [side * 0.25, -0.17, 0.372], { rot: [0, side * 0.5, 0], scale: [1.5, 1, 1], outline: false });
  }
  add(head, new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI), soft("#c4645c"), [0, -0.2, 0.412], { rot: [0, 0, Math.PI], outline: false });

  // 头发
  const hairParts = [];
  const hair = (geo, pos, opts) => {
    const m = add(head, geo, hairMat, pos, opts);
    hairParts.push(m);
    return m;
  };
  hair(new THREE.SphereGeometry(0.492, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.56), [0, 0.03, -0.025]);
  // 后脑勺一直盖到脖子
  hair(new THREE.SphereGeometry(0.49, 32, 18, Math.PI * 1.5 - 1.35, 2.7, Math.PI * 0.3, Math.PI * (look.hairStyle === "short" ? 0.42 : 0.55)), [0, 0.02, -0.03]);
  if (look.hairStyle === "short") {
    for (let i = 0; i < 6; i++) {
      const a = (i - 2.5) * 0.26;
      hair(new THREE.ConeGeometry(0.075, 0.24, 8), [Math.sin(a) * 0.41, 0.24, Math.cos(a) * 0.37], { rot: [-0.5 + Math.PI, 0, a * 0.6] });
    }
    for (const side of [-1, 1]) hair(new THREE.SphereGeometry(0.13, 12, 10), [side * 0.38, 0.12, -0.05], { scale: [0.7, 1, 1] });
    hair(new THREE.ConeGeometry(0.05, 0.2, 8), [0.05, 0.53, -0.02], { rot: [0.3, 0, -0.5] });
  } else {
    // 后面的长发到腰，两侧各一缕垂在肩前
    hair(new THREE.CapsuleGeometry(0.4, 0.3, 8, 22), [0, -0.32, -0.27], { scale: [1.08, 1, 0.55] });
    for (const side of [-1, 1]) hair(new THREE.CapsuleGeometry(0.1, 0.5, 6, 14), [side * 0.38, -0.45, 0.08], { rot: [0, 0, side * 0.05], scale: [1.1, 1, 1] });
    // 斜刘海：一整片，往一边斜
    hair(new THREE.SphereGeometry(0.5, 36, 14, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.1, Math.PI * 0.34), [0, 0.03, -0.01], { rot: [0, 0, -0.15] });
    if (look.hairStyle === "wavy") {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) hair(new THREE.SphereGeometry(0.1, 12, 10), [side * (0.41 + (k % 2) * 0.04), -0.28 - k * 0.19, 0.02]);
      }
    }
  }
  for (const m of hairParts) paintGradient(m, look.hair[0], look.hair[1], 0.45, -0.95);

  if (look.sunglasses) {
    const shades = new THREE.Group();
    const lensMat = soft("#1c2230", { roughness: 0.2, metalness: 0.3 });
    for (const side of [-1, 1]) {
      add(shades, new THREE.CylinderGeometry(0.085, 0.085, 0.03, 28), lensMat, [side * 0.11, 0, 0], { rot: [Math.PI / 2, 0, 0], scale: [1.15, 1, 1] });
    }
    add(shades, new THREE.BoxGeometry(0.06, 0.018, 0.018), lensMat, [0, 0.02, 0], { outline: false });
    shades.position.set(0, 0.44, 0.245);
    shades.rotation.x = -0.95;
    head.add(shades);
  }
  if (look.glasses) {
    const frame = soft("#3a3036", { roughness: 0.3 });
    for (const side of [-1, 1]) add(head, new THREE.TorusGeometry(0.085, 0.012, 8, 24), frame, [side * 0.16, -0.06, 0.42], { outline: false });
    add(head, new THREE.BoxGeometry(0.07, 0.012, 0.012), frame, [0, -0.04, 0.43], { outline: false });
  }
  if (look.clip) {
    const clip = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      add(clip, new THREE.SphereGeometry(0.035, 8, 6), soft(look.clip), [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0], { outline: false });
    }
    add(clip, new THREE.SphereGeometry(0.025, 8, 6), soft("#ffd34d"), [0, 0, 0.015], { outline: false });
    clip.position.set(0.33, 0.25, 0.28);
    clip.rotation.y = 0.7;
    head.add(clip);
  }

  for (const m of root.children) m.traverse((o) => {
    if (o.isMesh && o.material !== outlineMat) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

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
      arms[1].rotation.z = waving ? -2.6 + Math.sin(t * 9) * 0.3 : 0.2;
      bounce = Math.max(0, bounce - dt * 2.5);
      const hopY = Math.sin(bounce * Math.PI);
      body.position.y = Math.abs(Math.sin(phase)) * 0.06 * move + hopY * 0.35;
      // 果冻一样的弹一下
      body.scale.set(1 + hopY * 0.06, 1 - hopY * 0.08 + Math.sin(t * 2.2) * 0.008, 1 + hopY * 0.06);
      head.rotation.z = Math.sin(t * 1.6) * 0.04 * (1 - move);
      head.position.y = 1.3 + Math.sin(t * 2.2) * 0.012;
      blinkAt -= dt;
      const blink = blinkAt < 0.12 && blinkAt > 0 ? 0.12 : 1.25;
      for (const e of eyes) e.scale.y = blink;
      if (blinkAt < 0) blinkAt = 2.5 + Math.random() * 3;
    },
  };
}
