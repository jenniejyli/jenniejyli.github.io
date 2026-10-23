import * as THREE from "three";
import { canvasTexture, smoothstep, smoothNormals } from "./util.js";

// 照着毛毡人偶 / KIVO 潮玩做的小人：鹅蛋脸 + 小下巴、画出来的大眼睛、有脖子，头身比大约 1:3.7，
// 一缕一缕的头发贴着头型，冬天换长袖 + 围巾。
// jennie：黑色长直发 + 白色连衣裙 + 圆眼镜 + 黄色渔夫帽；boy / girl 是访客可以选的样子（女生和 Jennie 同款，裙子是粉色）。

const SKIN = "#ffdccb";
const HEAD_R = 0.33; // 头部建模用的半径（下面整颗头再整体缩小 HEAD_SCALE）
const HEAD_Y = 1.47;
const HEAD_SCALE = 0.6;
const HIP = 0.74;

// sleeve / legs / scarf：冬天的长袖、裤袜（或长裤）、围巾
const LOOKS = {
  jennie: {
    hair: "#1d1b22",
    hairHi: "#3a3542",
    iris: "#8a5a50",
    style: "long",
    lashes: true,
    mouth: "smile",
    outfit: "dress",
    dress: "#fbfaf7",
    bow: "#fff4ec",
    socks: "#ffffff",
    shoes: "#2f2a30",
    glasses: "#3d3238",
    hat: "#f6d55c",
    sleeve: "#f1e8d8",
    legs: "#efe6da",
    scarf: "#d9534f",
  },
  boy: {
    hair: "#4a352a",
    hairHi: "#6a4e3c",
    iris: "#5b4a3e",
    style: "short",
    mouth: "grin",
    outfit: "tee",
    top: "#f4efe6",
    print: "#7ea7d8",
    bottoms: "#3f5a80",
    socks: "#ffffff",
    shoes: "#ffffff",
    shoeAccent: "#6f9fd8",
    hat: "#f6d55c",
    sleeve: "#9db7d8",
    legs: "#9fbbdc",
    scarf: "#5f9a6a",
  },
  girl: {
    hair: "#6a4434",
    hairHi: "#8d5f48",
    iris: "#6a8a55",
    style: "bob",
    lashes: true,
    mouth: "o",
    outfit: "dress",
    dress: "#f7bccb",
    bow: "#fff4ec",
    socks: "#ffffff",
    shoes: "#d97a8c",
    hat: "#f6d55c",
    sleeve: "#fbe3ea",
    legs: "#f6dbe2",
    scarf: "#7fb2e0",
  },
  // 咖啡店的店员：白衬衫 + 绿色围裙 + 贝雷帽
  barista: {
    hair: "#3a2a24",
    hairHi: "#5a4234",
    iris: "#6a4a3a",
    style: "short",
    mouth: "smile",
    outfit: "apron",
    top: "#fbfaf7",
    apron: "#5b8a6e",
    bottoms: "#cdb592",
    socks: "#f4efe6",
    shoes: "#5a4232",
    beret: "#5b8a6e",
    sleeve: "#fbfaf7",
    legs: "#cdb592",
    scarf: "#e0a040",
  },
};

// ---------- 头的形状：像毛毡娃娃那样圆圆的脸，下半张脸有一点肉肉的脸颊，下巴小小的、是圆的（不是尖的）
function headShape(x, y, z) {
  const t = y / HEAD_R;
  const jaw = smoothstep(-0.1, -1.0, t);
  const cheeks = 1 + 0.05 * Math.exp(-(((t + 0.35) / 0.28) ** 2));
  const w = 0.9 * cheeks * (1 - 0.2 * jaw ** 1.5);
  const d = 0.94 * (1 - 0.1 * jaw * jaw);
  return [x * w, y * (t < 0 ? 1.05 : 1.0), z * d];
}
function headGeometry(r, opts = []) {
  const g = new THREE.SphereGeometry(r, ...opts);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = headShape(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- 脸（画在贴图上，贴在头的前面）
const FACE = { phi: 1.9, t0: 0.34 * Math.PI, t1: 0.74 * Math.PI, W: 1024, H: 590 };

function faceTexture(look, closed) {
  const { W, H } = FACE;
  return canvasTexture(W, H, (g) => {
    g.lineCap = "round";
    g.lineJoin = "round";
    const eyeY = 0.5 * H;
    // 腮红
    for (const x of [0.25 * W, 0.75 * W]) {
      const grad = g.createRadialGradient(x, eyeY + 95, 0, x, eyeY + 95, 75);
      grad.addColorStop(0, "rgba(255,135,135,0.5)");
      grad.addColorStop(1, "rgba(255,135,135,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, eyeY + 95, 80, 45, 0, 0, Math.PI * 2);
      g.fill();
    }
    // 眉毛（细细短短的）
    g.strokeStyle = look.hair;
    g.lineWidth = 7;
    for (const s of [-1, 1]) {
      const x = 0.5 * W + s * 0.19 * W;
      g.beginPath();
      g.moveTo(x - s * 34, eyeY - 120);
      g.quadraticCurveTo(x, eyeY - 132, x + s * 30, eyeY - 122);
      g.stroke();
    }
    for (const s of [-1, 1]) {
      const cx = 0.5 * W + s * 0.19 * W;
      const cy = eyeY;
      if (closed) {
        g.strokeStyle = "#2a1f24";
        g.lineWidth = 12;
        g.beginPath();
        g.moveTo(cx - 70, cy + 4);
        g.quadraticCurveTo(cx, cy + 46, cx + 70, cy + 4);
        g.stroke();
        continue;
      }
      // 眼白
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.ellipse(cx, cy + 6, 74, 70, 0, 0, Math.PI * 2);
      g.fill();
      // 虹膜（上深下浅）+ 瞳孔
      const ir = g.createLinearGradient(0, cy - 70, 0, cy + 70);
      ir.addColorStop(0, "#2a1d22");
      ir.addColorStop(0.45, look.iris);
      ir.addColorStop(1, "#e9c3b4");
      g.fillStyle = ir;
      g.beginPath();
      g.ellipse(cx + s * 4, cy + 8, 62, 68, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#24181d";
      g.beginPath();
      g.ellipse(cx + s * 4, cy + 4, 30, 38, 0, 0, Math.PI * 2);
      g.fill();
      // 高光
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.ellipse(cx - s * 18, cy - 22, 20, 24, -0.3, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx + s * 26, cy + 34, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.arc(cx + s * 30, cy - 30, 6, 0, Math.PI * 2);
      g.fill();
      // 上眼线（粗）+ 外眼角往外翘
      g.strokeStyle = "#231a1f";
      g.lineWidth = 13;
      g.beginPath();
      g.moveTo(cx - s * 76, cy - 6);
      g.quadraticCurveTo(cx - s * 30, cy - 78, cx + s * 46, cy - 66);
      g.quadraticCurveTo(cx + s * 76, cy - 52, cx + s * 92, cy - 30);
      g.stroke();
      if (look.lashes) {
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(cx + s * 84, cy - 40);
        g.lineTo(cx + s * 104, cy - 58);
        g.moveTo(cx + s * 70, cy - 56);
        g.lineTo(cx + s * 84, cy - 80);
        g.stroke();
      }
      // 下眼睑
      g.strokeStyle = "rgba(190,120,110,0.45)";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(cx - 40, cy + 74);
      g.quadraticCurveTo(cx, cy + 82, cx + 40, cy + 74);
      g.stroke();
    }
    // 鼻子
    g.fillStyle = "rgba(225,135,115,0.4)";
    g.beginPath();
    g.ellipse(0.5 * W, eyeY + 96, 7, 5, 0, 0, Math.PI * 2);
    g.fill();
    // 嘴巴
    const mx = 0.5 * W;
    const my = eyeY + 142;
    g.strokeStyle = "#b5574f";
    g.lineWidth = 7;
    if (look.mouth === "grin") {
      g.fillStyle = "#8f3b3b";
      g.beginPath();
      g.moveTo(mx - 28, my - 6);
      g.quadraticCurveTo(mx, my + 40, mx + 28, my - 6);
      g.closePath();
      g.fill();
      g.fillStyle = "#e98282";
      g.beginPath();
      g.ellipse(mx, my + 12, 12, 7, 0, 0, Math.PI * 2);
      g.fill();
    } else if (look.mouth === "o") {
      g.fillStyle = "#b8564e";
      g.beginPath();
      g.ellipse(mx, my + 4, 12, 14, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(mx - 20, my - 2);
      g.quadraticCurveTo(mx, my + 16, mx + 20, my - 2);
      g.stroke();
    }
  });
}

// ---------- 头发：一个"帽子"盖住头顶，再加一缕一缕的发束
const sph = (R, phi, theta) => headShape(-R * Math.cos(phi) * Math.sin(theta), R * Math.cos(theta), R * Math.sin(phi) * Math.sin(theta));
const fromFront = (phi) => Math.abs(((((phi - Math.PI / 2) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

function surface(cols, rows, fn) {
  const pos = [];
  const uv = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      pos.push(...fn(i / cols, j / rows));
      uv.push(i / cols, 1 - j / rows);
    }
  }
  const idx = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a + 1, a, a + cols + 2, a, a + cols + 1, a + cols + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 头发上一条一条的发丝（亮暗相间的竖条纹），让大块头发不像一块布
function hairStreaks(color, hi) {
  const t = canvasTexture(256, 64, (g) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 64);
    let x = 0;
    let k = 0;
    while (x < 256) {
      const w = 3 + ((k * 37) % 7);
      g.fillStyle = k % 3 === 0 ? hi : k % 3 === 1 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.05)";
      g.fillRect(x, 0, w, 64);
      x += w + 2 + ((k * 13) % 5);
      k++;
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  return t;
}

// 一缕头发：沿着曲线走，越往发梢越细，横截面是扁的
function strand(points, r0, flat = 0.55, segs = 14) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segs, false);
  const radial = 8;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = r0 * Math.pow(1 - t, 0.75) + 0.002;
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a) * r * flat);
      const b = frames.binormals[i].clone().multiplyScalar(Math.sin(a) * r);
      pos.push(c.x + n.x + b.x, c.y + n.y + b.y, c.z + n.z + b.z);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      idx.push(a, b, a + radial, b, b + radial, a + radial);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 从头皮上某一点出发，贴着头往下长的一缕（phi 方向，起点角 t0，终点角 t1，稍微往外翘）
function lock(phi, t0, t1, r0, { lift = 0.03, curl = 0, sweep = 0 } = {}) {
  const pts = [];
  for (let k = 0; k <= 5; k++) {
    const t = k / 5;
    const th = t0 + (t1 - t0) * t;
    const R = HEAD_R + 0.02 + lift * t * t;
    const [x, y, z] = sph(R, phi + sweep * t, th);
    pts.push(new THREE.Vector3(x, y + curl * t * t, z));
  }
  return strand(pts, r0);
}

function hairGeometries(look) {
  const parts = [];
  const short = look.style === "short";
  // 头顶到两侧/后脑；前面只到发际线
  parts.push(
    surface(56, 22, (u, v) => {
      const phi = u * Math.PI * 2;
      const back = smoothstep(0.45, 1.3, fromFront(phi));
      const tMax = Math.PI * (0.28 + (short ? 0.28 : 0.36) * back);
      return sph(HEAD_R + 0.022, phi, v * tMax);
    }),
  );
  // 刘海：几缕，往一边斜，发梢尖尖的
  const fringe = short
    ? [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((o, k) => [o, 0.36 + (k % 2) * 0.04, 0.05])
    : [-0.82, -0.55, -0.28, 0.0, 0.27, 0.52, 0.78].map((o, k) => [o, 0.41 + (k % 3) * 0.025 - o * 0.03, 0.055]);
  // 戴帽子的话刘海从帽檐下面开始，不会从帽子顶上戳出来
  const fringeTop = look.hat ? Math.PI * 0.3 : Math.PI * 0.12;
  for (const [o, end, r0] of fringe) parts.push(lock(Math.PI / 2 + o, fringeTop, Math.PI * end, r0 * (look.hat ? 0.8 : 1), { sweep: -0.12, lift: 0.015 }));
  if (look.style === "long") {
    // 后面的长直发 + 两侧垂到胸前的几缕
    // 后面的长直发：贴着头往下，到肩膀以下变成垂在背后的一片（不会和肩膀、身体穿模）
    parts.push(
      surface(60, 30, (u, v) => {
        const k = smoothstep(0.3, 0.62, v);
        const gap = 0.95 + 0.75 * k;
        const phi = Math.PI / 2 + gap + u * (Math.PI * 2 - gap * 2);
        const R = HEAD_R + 0.035 - 0.03 * smoothstep(0, 0.4, v);
        const x = THREE.MathUtils.lerp(-R * Math.cos(phi) * 0.98, -Math.cos(phi) * 0.37, k);
        const z = THREE.MathUtils.lerp(R * Math.sin(phi) * 0.97 - 0.02, Math.sin(phi) * 0.14 - 0.22, k);
        return [x, 0.04 - v * 0.95 + 0.02 * Math.sin(phi * 9) * v, z];
      }),
    );
  } else if (look.style === "bob") {
    // 齐下巴的波波头
    parts.push(
      surface(60, 16, (u, v) => {
        const gap = 0.92;
        const off = gap + u * (Math.PI * 2 - gap * 2);
        const phi = Math.PI / 2 + off;
        const y = 0.02 - v * 0.4;
        const R = HEAD_R + 0.03 + 0.03 * smoothstep(0.6, 1, v);
        return [-R * Math.cos(phi) * 0.98, y, R * Math.sin(phi) * 0.99 - 0.02];
      }),
    );
  } else {
    // 短发：一圈翘起来的小发束 + 呆毛
    for (let k = 0; k < 10; k++) {
      const phi = Math.PI / 2 + 0.95 + (k / 9) * (Math.PI * 2 - 1.9);
      parts.push(lock(phi, Math.PI * 0.32, Math.PI * 0.6, 0.06, { lift: 0.05, curl: 0.03 }));
    }
    if (!look.hat) parts.push(strand([new THREE.Vector3(0.02, HEAD_R + 0.01, 0.0), new THREE.Vector3(0.05, HEAD_R + 0.12, -0.02), new THREE.Vector3(0.13, HEAD_R + 0.15, -0.04)], 0.035, 0.7));
  }
  return parts;
}

const soft = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });

function add(parent, geo, material, pos = [0, 0, 0], { rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  parent.add(m);
  return m;
}

// 轮廓点按从上到下写；LatheGeometry 要从下到上才是朝外的面，所以反过来
function lathe(points, segs = 32) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)).reverse(), segs);
}

export function makeCharacter(kind) {
  const look = LOOKS[kind];
  const root = new THREE.Group();
  root.scale.setScalar(1.05);
  const body = new THREE.Group();
  root.add(body);

  // 皮肤带一点点自发光，阴影里也不会发灰（软胶玩具的感觉）
  const skin = soft(SKIN, { roughness: 0.5, emissive: "#ffb9a0", emissiveIntensity: 0.08 });
  // 胳膊、腿单独一个材质：冬天换成长袖、裤袜 / 长裤
  const armMat = skin.clone();
  const legMat = look.outfit === "apron" ? soft(look.bottoms, { roughness: 0.8 }) : skin.clone();
  const socks = soft(look.socks);
  const shoes = soft(look.shoes, { roughness: 0.4 });
  const bottoms = look.bottoms ? soft(look.bottoms, { roughness: 0.8 }) : null;

  // ---------- 腿：大腿在屁股处转，小腿在膝盖处转（坐下时小腿垂下来）
  const legs = [];
  const knees = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.068, HIP, 0);
    add(thigh, new THREE.CapsuleGeometry(0.052, 0.24, 6, 14), legMat, [0, -0.16, 0]);
    if (look.outfit === "tee") add(thigh, new THREE.CylinderGeometry(0.068, 0.074, 0.17, 14), bottoms, [0, -0.07, 0]);
    const knee = new THREE.Group();
    knee.position.y = -0.32;
    add(knee, new THREE.CapsuleGeometry(0.046, 0.22, 6, 14), legMat, [0, -0.15, 0]);
    add(knee, new THREE.CylinderGeometry(0.05, 0.047, 0.13, 14), socks, [0, -0.25, 0]);
    const shoe = new THREE.Group();
    shoe.position.set(0, -0.36, 0.022);
    add(shoe, new THREE.SphereGeometry(0.07, 18, 12), shoes, [0, 0, 0], { scale: [0.95, 0.65, 1.5] });
    add(shoe, new THREE.CylinderGeometry(0.072, 0.072, 0.025, 18), soft(look.shoeAccent || "#2a2328"), [0, -0.03, 0], { scale: [0.95, 1, 1.5] });
    if (look.outfit === "dress") add(shoe, new THREE.TorusGeometry(0.05, 0.008, 6, 16, Math.PI), shoes, [0, 0.025, 0.02], { rot: [0, Math.PI / 2, 0] });
    knee.add(shoe);
    thigh.add(knee);
    body.add(thigh);
    legs.push(thigh);
    knees.push(knee);
  }

  // ---------- 衣服
  if (look.outfit === "dress") {
    const dress = soft(look.dress, { roughness: 0.75 });
    const trim = soft("#f3efe8");
    add(body, lathe([[0.001, 1.215], [0.06, 1.212], [0.105, 1.18], [0.128, 1.11], [0.12, 1.02], [0.1, 0.94], [0.108, 0.9], [0.16, 0.79], [0.235, 0.63], [0.245, 0.6], [0.001, 0.6]], 36), dress);
    add(body, new THREE.TorusGeometry(0.24, 0.014, 8, 40), trim, [0, 0.605, 0], { rot: [Math.PI / 2, 0, 0] });
    for (const side of [-1, 1]) {
      add(body, new THREE.SphereGeometry(0.056, 16, 12), dress, [side * 0.135, 1.14, 0], { scale: [1.05, 0.85, 1] });
      add(body, new THREE.SphereGeometry(0.045, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim, [side * 0.042, 1.2, 0.07], { rot: [0.9, side * 0.4, 0], scale: [1.2, 0.5, 1] });
      add(body, new THREE.SphereGeometry(0.026, 12, 10), soft(look.bow), [side * 0.03, 1.12, 0.12], { scale: [1.3, 0.8, 0.6] });
    }
    add(body, new THREE.SphereGeometry(0.014, 10, 8), soft(look.bow), [0, 1.12, 0.125]);
  } else {
    const topMat = soft(look.top, { roughness: 0.75 });
    add(body, new THREE.CapsuleGeometry(0.112, 0.24, 8, 24), topMat, [0, 0.97, 0], { scale: [1.05, 1, 0.78] });
    for (const side of [-1, 1]) add(body, new THREE.CylinderGeometry(0.045, 0.052, 0.1, 14), topMat, [side * 0.135, 1.1, 0], { rot: [0, 0, side * 0.45] });
    if (look.print) add(body, new THREE.CircleGeometry(0.045, 20), soft(look.print), [0, 1.0, 0.0905]);
    add(body, new THREE.CylinderGeometry(0.118, 0.124, 0.14, 20), bottoms, [0, 0.77, 0], { scale: [1.05, 1, 0.8] });
    if (look.outfit === "apron") {
      const apron = soft(look.apron, { roughness: 0.85 });
      add(body, new THREE.BoxGeometry(0.2, 0.42, 0.012), apron, [0, 0.86, 0.098]);
      add(body, new THREE.BoxGeometry(0.09, 0.06, 0.014), soft("#fbfaf7"), [0, 0.79, 0.106]);
      add(body, new THREE.TorusGeometry(0.118, 0.009, 6, 30), apron, [0, 0.92, 0], { rot: [Math.PI / 2, 0, 0], scale: [1.06, 0.8, 1] });
    }
  }

  // ---------- 手臂（肩膀处转动）
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.148, 1.13, 0);
    add(arm, new THREE.CapsuleGeometry(0.033, 0.36, 6, 12), armMat, [0, -0.21, 0]);
    add(arm, new THREE.SphereGeometry(0.039, 14, 10), skin, [0, -0.44, 0]);
    arm.rotation.z = side * 0.1;
    body.add(arm);
    arms.push(arm);
  }
  // 脖子：细一点、稍微靠后，颜色比脸深一点（下巴下面的阴影），头和脖子分得开
  const neckMat = soft("#efc3ae", { roughness: 0.6 });
  add(body, new THREE.CylinderGeometry(0.034, 0.04, 0.12, 14), neckMat, [0, 1.25, -0.012]);

  // 冬天的围巾
  const scarfMat = soft(look.scarf, { roughness: 0.95 });
  const scarf = new THREE.Group();
  add(scarf, new THREE.TorusGeometry(0.058, 0.03, 10, 24), scarfMat, [0, 1.2, 0.005], { rot: [Math.PI / 2, 0, 0] });
  add(scarf, new THREE.BoxGeometry(0.06, 0.2, 0.025), scarfMat, [0.045, 1.09, 0.1], { rot: [0.12, 0, 0.12] });
  add(scarf, new THREE.BoxGeometry(0.062, 0.022, 0.028), soft("#ffffff", { roughness: 0.95 }), [0.058, 1.0, 0.112], { rot: [0.12, 0, 0.12] });
  scarf.visible = false;
  body.add(scarf);

  // ---------- 头（鹅蛋脸，比身体小，下面有脖子）
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  head.scale.setScalar(HEAD_SCALE);
  body.add(head);
  add(head, smoothNormals(headGeometry(HEAD_R, [48, 36])), skin);
  for (const side of [-1, 1]) add(head, new THREE.SphereGeometry(0.055, 14, 10), skin, headShape(side * HEAD_R, -0.05, -0.02), { scale: [0.45, 0.75, 0.6] });
  const faceOpen = faceTexture(look, false);
  const faceClosed = faceTexture(look, true);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceOpen, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  add(head, headGeometry(HEAD_R + 0.0015, [48, 26, Math.PI / 2 - FACE.phi / 2, FACE.phi, FACE.t0, FACE.t1 - FACE.t0]), faceMat);

  const hairMat = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.38, side: THREE.DoubleSide, emissive: look.hairHi, emissiveIntensity: 0.12 });
  const hairSheet = hairMat.clone();
  hairSheet.color.set("#ffffff");
  hairSheet.map = hairStreaks(look.hair, look.hairHi);
  for (const g of hairGeometries(look)) add(head, g, g.attributes.uv ? hairSheet : hairMat);

  if (look.hat) {
    const hat = soft(look.hat, { roughness: 0.85 });
    add(head, new THREE.SphereGeometry(HEAD_R + 0.05, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), hat, [0, 0.03, -0.01], { scale: [0.98, 0.95, 1.0] });
    add(head, new THREE.CylinderGeometry(HEAD_R + 0.15, HEAD_R + 0.17, 0.025, 36), hat, [0, 0.07, 0.0], { rot: [-0.08, 0, 0], scale: [0.98, 1, 1] });
    add(head, new THREE.TorusGeometry(HEAD_R + 0.055, 0.014, 6, 36), soft("#8a6a4a"), [0, 0.1, 0.0], { rot: [Math.PI / 2 - 0.08, 0, 0], scale: [0.98, 1, 1.0] });
  }
  if (look.beret) {
    const beret = soft(look.beret, { roughness: 0.9 });
    add(head, new THREE.SphereGeometry(HEAD_R + 0.06, 28, 12), beret, [0.03, 0.25, -0.02], { rot: [0, 0, -0.2], scale: [0.95, 0.38, 0.98] });
    add(head, new THREE.CylinderGeometry(0.012, 0.016, 0.05, 8), beret, [0.0, 0.41, -0.02]);
  }
  if (look.glasses) {
    // 圆圆的细框眼镜：两个镜框 + 鼻梁 + 镜腿（挂到耳朵上）。位置都按头的形状算
    const frame = soft(look.glasses, { roughness: 0.35 });
    const glasses = new THREE.Group();
    const at = (rr, dphi, th) => new THREE.Vector3(...sph(rr, Math.PI / 2 + dphi, th));
    for (const side of [-1, 1]) {
      add(glasses, new THREE.TorusGeometry(0.078, 0.0075, 8, 32), frame, at(HEAD_R + 0.04, side * 0.36, 0.54 * Math.PI).toArray(), { rot: [0, side * 0.36, 0] });
      const from = at(HEAD_R + 0.035, side * 0.62, 0.535 * Math.PI);
      const to = at(HEAD_R + 0.012, side * 1.42, 0.53 * Math.PI);
      const temple = add(glasses, new THREE.CylinderGeometry(0.0055, 0.0055, from.distanceTo(to), 6), frame, from.clone().lerp(to, 0.5).toArray());
      temple.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
    const mid = at(HEAD_R + 0.045, 0, 0.53 * Math.PI);
    add(glasses, new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), frame, [0, mid.y - 0.012, mid.z], { scale: [1, 0.55, 1] });
    head.add(glasses);
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.material !== faceMat;
      o.receiveShadow = false;
    }
  });

  // ---------- 拿在手上的东西：饮料杯 / 一小碟蛋糕（转一下保持端平）
  const cup = new THREE.Group();
  const cupBody = add(cup, new THREE.CylinderGeometry(0.042, 0.034, 0.095, 14), soft("#fbf7ef"));
  const cupBand = add(cup, new THREE.CylinderGeometry(0.043, 0.043, 0.03, 14), soft("#d9604f"), [0, -0.01, 0]);
  add(cup, new THREE.CylinderGeometry(0.044, 0.044, 0.018, 14), soft("#8a5a3b"), [0, 0.052, 0]);
  cup.position.set(0, -0.46, 0.04);
  cup.rotation.x = 0.9;
  cup.visible = false;
  arms[0].add(cup);
  const plate = new THREE.Group();
  add(plate, new THREE.CylinderGeometry(0.075, 0.062, 0.012, 20), soft("#ffffff"));
  add(plate, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16, 1, false, 0, Math.PI * 0.45), soft("#f6dcb4"), [-0.01, 0.031, -0.01]);
  const cakeTop = add(plate, new THREE.CylinderGeometry(0.051, 0.051, 0.012, 16, 1, false, 0, Math.PI * 0.45), soft("#f6a5b8"), [-0.01, 0.06, -0.01]);
  plate.position.set(0, -0.47, 0.06);
  plate.rotation.x = 0.9;
  plate.visible = false;
  arms[0].add(plate);

  let phase = 0;
  let blinkAt = 2 + Math.random() * 3;
  let waving = false;
  let bounce = 0;
  let sitting = false;

  const hold = (what, color) => {
    cup.visible = what === "cup";
    plate.visible = what === "cake";
    if (what === "cup") {
      cupBand.material.color.set(color);
      cupBody.material.color.set("#fbf7ef");
    } else if (what === "cake") cakeTop.material.color.set(color);
  };

  return {
    root,
    cup,
    hold,
    get holding() {
      return cup.visible || plate.visible;
    },
    setCupColor(c) {
      hold("cup", c);
    },
    wave(on) {
      waving = on;
    },
    hop() {
      bounce = 1;
    },
    sit(on) {
      sitting = on;
    },
    get sitting() {
      return sitting;
    },
    // 冬天：长袖 + 围巾 + 裤袜（或长裤）
    setSeason(name) {
      const w = name === "winter";
      scarf.visible = w;
      armMat.color.set(w ? look.sleeve : SKIN);
      armMat.emissiveIntensity = w ? 0 : 0.08;
      if (look.outfit !== "apron") {
        legMat.color.set(w ? look.legs : SKIN);
        legMat.emissiveIntensity = w ? 0 : 0.08;
      }
    },
    update(dt, t, speed) {
      const move = sitting ? 0 : Math.min(speed, 1);
      phase += dt * (6 + 5 * move) * (move > 0.05 ? 1 : 0);
      const swing = Math.sin(phase) * 0.55 * move;
      legs[0].rotation.x = sitting ? -1.5 : swing;
      legs[1].rotation.x = sitting ? -1.5 : -swing;
      // 腿往后摆的时候膝盖弯一点
      knees[0].rotation.x = sitting ? 1.5 : Math.max(0, Math.sin(phase)) * 0.7 * move;
      knees[1].rotation.x = sitting ? 1.5 : Math.max(0, -Math.sin(phase)) * 0.7 * move;
      const holding = cup.visible || plate.visible;
      arms[0].rotation.x = holding ? -0.9 : sitting ? -0.45 : -swing * 0.9;
      arms[1].rotation.x = waving ? 0 : sitting ? -0.45 : swing * 0.9;
      arms[1].rotation.z = waving ? -2.6 + Math.sin(t * 9) * 0.3 : 0.1;
      bounce = Math.max(0, bounce - dt * 2.5);
      const hopY = Math.sin(bounce * Math.PI);
      body.position.y = (sitting ? -0.21 : 0) + Math.abs(Math.sin(phase)) * 0.04 * move + hopY * 0.32;
      body.scale.set(1 + hopY * 0.05, 1 - hopY * 0.06 + Math.sin(t * 2.2) * 0.005, 1 + hopY * 0.05);
      head.rotation.z = Math.sin(t * 1.6) * 0.035 * (1 - move);
      head.position.y = HEAD_Y + Math.sin(t * 2.2) * 0.006;
      blinkAt -= dt;
      const closed = blinkAt < 0.13 && blinkAt > 0;
      const map = closed ? faceClosed : faceOpen;
      if (faceMat.map !== map) faceMat.map = map;
      if (blinkAt < 0) blinkAt = 2.5 + Math.random() * 3;
    },
  };
}
