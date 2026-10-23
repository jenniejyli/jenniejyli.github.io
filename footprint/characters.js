import * as THREE from "three";
import { canvasTexture, smoothstep, smoothNormals } from "./util.js";

// 照着 KIVO 潮玩小人做的 Q 版小人：大圆头、画出来的大眼睛、一缕一缕的头发、细细的胳膊腿、厚鞋子。
// jennie：黑色长直发 + 白色连衣裙 + 圆眼镜 + 黄色渔夫帽；boy / girl 是访客可以选的样子（女生和 Jennie 同款，裙子是粉色）。

const SKIN = "#ffdccb";
const HEAD_R = 0.33;
const HEAD_Y = 1.16;
const HEAD_SCALE = 0.84; // 整个头（连头发、帽子、眼镜）缩小一点，身体比例不那么"大头"

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
    hat: "#d8c4a0",
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
  },
};

// ---------- 头的形状：圆顶，脸颊稍微鼓一点，下巴收一点
function headShape(x, y, z) {
  const t = y / HEAD_R;
  const cheek = 1 + 0.06 * smoothstep(0.3, -0.5, t) - 0.12 * smoothstep(-0.55, -1.0, t);
  return [x * 1.05 * cheek, y * 0.97, z * cheek];
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
    parts.push(
      surface(60, 26, (u, v) => {
        const gap = 0.95 + 0.7 * smoothstep(0.3, 0.6, v);
        const off = gap + u * (Math.PI * 2 - gap * 2);
        const phi = Math.PI / 2 + off;
        const y = 0.02 - v * 0.7 + 0.025 * Math.sin(phi * 9) * v;
        const R = HEAD_R + 0.03 - 0.06 * smoothstep(0, 0.45, v) + 0.02 * smoothstep(0.85, 1, v);
        return [-R * Math.cos(phi) * 1.08, y, R * Math.sin(phi) * 1.02 - 0.03];
      }),
    );
    for (const side of [-1, 1]) {
      for (const dz of [0.02, -0.06]) {
        const x = side * (HEAD_R + 0.01);
        parts.push(strand([new THREE.Vector3(x * 0.95, 0.05, 0.12 + dz), new THREE.Vector3(x * 1.08, -0.2, 0.1 + dz), new THREE.Vector3(x * 1.02, -0.45, 0.12 + dz), new THREE.Vector3(x * 0.92, -0.62, 0.13 + dz)], 0.06, 0.6));
      }
    }
  } else if (look.style === "bob") {
    // 齐下巴的波波头
    parts.push(
      surface(60, 16, (u, v) => {
        const gap = 0.92;
        const off = gap + u * (Math.PI * 2 - gap * 2);
        const phi = Math.PI / 2 + off;
        const y = 0.02 - v * 0.36;
        const R = HEAD_R + 0.035 + 0.035 * smoothstep(0.6, 1, v);
        return [-R * Math.cos(phi) * 1.1, y, R * Math.sin(phi) * 1.04 - 0.02];
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

function stripeTexture(a, b) {
  const t = canvasTexture(64, 64, (g) => {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(0, i * 16, 64, 16);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  return t;
}

export function makeCharacter(kind) {
  const look = LOOKS[kind];
  const root = new THREE.Group();
  root.scale.setScalar(1.12);
  const body = new THREE.Group();
  root.add(body);

  // 皮肤带一点点自发光，阴影里也不会发灰（软胶玩具的感觉）
  const skin = soft(SKIN, { roughness: 0.5, emissive: "#ffb9a0", emissiveIntensity: 0.08 });
  const socks = soft(look.socks);
  const shoes = soft(look.shoes, { roughness: 0.4 });
  const bottoms = look.bottoms ? soft(look.bottoms, { roughness: 0.8 }) : null;

  // ---------- 腿（屁股处转动）
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.075, 0.56, 0);
    add(leg, new THREE.CapsuleGeometry(0.058, 0.36, 6, 14), skin, [0, -0.22, 0]);
    add(leg, new THREE.CylinderGeometry(0.062, 0.058, 0.16, 14), socks, [0, -0.4, 0]);
    if (look.outfit === "tee") add(leg, new THREE.CylinderGeometry(0.078, 0.086, 0.15, 14), bottoms, [0, -0.05, 0]);
    const shoe = new THREE.Group();
    shoe.position.set(0, -0.5, 0.025);
    add(shoe, new THREE.SphereGeometry(0.085, 18, 12), shoes, [0, 0.0, 0.0], { scale: [0.95, 0.62, 1.45] });
    add(shoe, new THREE.CylinderGeometry(0.088, 0.088, 0.03, 18), soft(look.shoeAccent || "#2a2328"), [0, -0.035, 0.0], { scale: [0.95, 1, 1.45] });
    if (look.outfit === "dress") add(shoe, new THREE.TorusGeometry(0.06, 0.009, 6, 16, Math.PI), shoes, [0, 0.03, 0.02], { rot: [0, Math.PI / 2, 0] });
    leg.add(shoe);
    body.add(leg);
    legs.push(leg);
  }

  // ---------- 衣服
  if (look.outfit === "dress") {
    const dress = soft(look.dress, { roughness: 0.75 });
    add(body, lathe([[0.001, 0.97], [0.1, 0.96], [0.16, 0.9], [0.175, 0.82], [0.16, 0.73], [0.19, 0.66], [0.26, 0.54], [0.31, 0.44], [0.3, 0.42], [0.001, 0.42]], 36), dress);
    add(body, new THREE.TorusGeometry(0.305, 0.018, 8, 40), soft("#f3efe8"), [0, 0.435, 0], { rot: [Math.PI / 2, 0, 0] });
    for (const side of [-1, 1]) {
      add(body, new THREE.SphereGeometry(0.075, 16, 12), dress, [side * 0.175, 0.89, 0], { scale: [1.05, 0.85, 1] });
      add(body, new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), soft("#f3efe8"), [side * 0.06, 0.95, 0.09], { rot: [0.9, side * 0.4, 0], scale: [1.2, 0.5, 1] });
      add(body, new THREE.SphereGeometry(0.035, 12, 10), soft(look.bow), [side * 0.04, 0.86, 0.165], { scale: [1.3, 0.8, 0.6] });
    }
    add(body, new THREE.SphereGeometry(0.018, 10, 8), soft(look.bow), [0, 0.86, 0.17]);
  } else {
    const topMat = look.outfit === "stripes" ? new THREE.MeshStandardMaterial({ map: stripeTexture(look.top, look.stripe), roughness: 0.75 }) : soft(look.top, { roughness: 0.75 });
    add(body, new THREE.CapsuleGeometry(0.15, 0.2, 8, 24), topMat, [0, 0.78, 0], { scale: [1.05, 1, 0.85] });
    for (const side of [-1, 1]) add(body, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 14), topMat, [side * 0.185, 0.86, 0], { rot: [0, 0, side * 0.5] });
    if (look.print) add(body, new THREE.CircleGeometry(0.06, 20), soft(look.print), [0, 0.8, 0.13]);
    if (look.outfit === "stripes") add(body, lathe([[0.001, 0.68], [0.15, 0.68], [0.2, 0.58], [0.24, 0.5], [0.001, 0.5]], 32), bottoms);
    else add(body, new THREE.CylinderGeometry(0.15, 0.16, 0.12, 20), bottoms, [0, 0.62, 0], { scale: [1, 1, 0.85] });
  }

  // ---------- 手臂（肩膀处转动）
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.19, 0.88, 0);
    add(arm, new THREE.CapsuleGeometry(0.042, 0.28, 6, 12), skin, [0, -0.18, 0]);
    add(arm, new THREE.SphereGeometry(0.052, 14, 10), skin, [0, -0.36, 0]);
    arm.rotation.z = side * 0.12;
    body.add(arm);
    arms.push(arm);
  }
  add(body, new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), skin, [0, 0.98, 0]);

  // ---------- 头
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  head.scale.setScalar(HEAD_SCALE);
  body.add(head);
  add(head, smoothNormals(headGeometry(HEAD_R, [48, 36])), skin);
  for (const side of [-1, 1]) add(head, new THREE.SphereGeometry(0.06, 14, 10), skin, [side * HEAD_R * 1.07, -0.04, 0.0], { scale: [0.45, 0.75, 0.6] });
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
    add(head, new THREE.SphereGeometry(HEAD_R + 0.05, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), hat, [0, 0.03, -0.01], { scale: [1.07, 0.95, 1.03] });
    add(head, new THREE.CylinderGeometry(HEAD_R + 0.17, HEAD_R + 0.19, 0.025, 36), hat, [0, 0.07, 0.0], { rot: [-0.08, 0, 0], scale: [1.05, 1, 1] });
    add(head, new THREE.TorusGeometry(HEAD_R + 0.055, 0.014, 6, 36), soft("#8a6a4a"), [0, 0.1, 0.0], { rot: [Math.PI / 2 - 0.08, 0, 0], scale: [1.07, 1, 1] });
  }
  if (look.glasses) {
    // 圆圆的细框眼镜：两个镜框 + 鼻梁 + 镜腿（挂到耳朵上）
    const frame = soft(look.glasses, { roughness: 0.35 });
    const glasses = new THREE.Group();
    for (const side of [-1, 1]) {
      add(glasses, new THREE.TorusGeometry(0.078, 0.0075, 8, 32), frame, [side * 0.127, -0.035, 0.338], { rot: [0, side * 0.36, 0] });
      const from = new THREE.Vector3(side * 0.2, -0.025, 0.31);
      const to = new THREE.Vector3(side * 0.345, -0.02, 0.04);
      const temple = add(glasses, new THREE.CylinderGeometry(0.0055, 0.0055, from.distanceTo(to), 6), frame, from.clone().lerp(to, 0.5).toArray());
      temple.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
    add(glasses, new THREE.TorusGeometry(0.05, 0.006, 6, 12, Math.PI), frame, [0, -0.05, 0.352], { scale: [1, 0.55, 1] });
    head.add(glasses);
  }
  if (look.clip) {
    const clip = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      add(clip, new THREE.SphereGeometry(0.026, 8, 6), soft(look.clip), [Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0]);
    }
    add(clip, new THREE.SphereGeometry(0.018, 8, 6), soft("#ffd34d"), [0, 0, 0.012]);
    clip.position.set(0.25, 0.17, 0.25);
    clip.rotation.y = 0.75;
    head.add(clip);
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.material !== faceMat;
      o.receiveShadow = false;
    }
  });

  // 拿在手上的咖啡杯
  const cup = new THREE.Group();
  const cupBody = add(cup, new THREE.CylinderGeometry(0.05, 0.04, 0.11, 14), soft("#fbf7ef"));
  const cupBand = add(cup, new THREE.CylinderGeometry(0.051, 0.051, 0.035, 14), soft("#d9604f"), [0, -0.01, 0]);
  add(cup, new THREE.CylinderGeometry(0.052, 0.052, 0.02, 14), soft("#8a5a3b"), [0, 0.06, 0]);
  cup.position.set(0, -0.36, 0.06);
  cup.visible = false;
  arms[0].add(cup);

  let phase = 0;
  let blinkAt = 2 + Math.random() * 3;
  let waving = false;
  let bounce = 0;
  let sitting = false;

  return {
    root,
    cup,
    setCupColor(c) {
      cupBand.material.color.set(c);
      cupBody.material.color.set("#fbf7ef");
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
    update(dt, t, speed) {
      const move = sitting ? 0 : Math.min(speed, 1);
      phase += dt * (6 + 5 * move) * (move > 0.05 ? 1 : 0);
      const swing = Math.sin(phase) * 0.6 * move;
      legs[0].rotation.x = sitting ? -1.45 : swing;
      legs[1].rotation.x = sitting ? -1.45 : -swing;
      arms[0].rotation.x = cup.visible ? -0.9 : sitting ? -0.5 : -swing * 0.9;
      arms[1].rotation.x = waving ? 0 : sitting ? -0.5 : swing * 0.9;
      arms[1].rotation.z = waving ? -2.6 + Math.sin(t * 9) * 0.3 : 0.12;
      bounce = Math.max(0, bounce - dt * 2.5);
      const hopY = Math.sin(bounce * Math.PI);
      body.position.y = (sitting ? -0.1 : 0) + Math.abs(Math.sin(phase)) * 0.05 * move + hopY * 0.35;
      body.scale.set(1 + hopY * 0.06, 1 - hopY * 0.08 + Math.sin(t * 2.2) * 0.006, 1 + hopY * 0.06);
      head.rotation.z = Math.sin(t * 1.6) * 0.04 * (1 - move);
      head.position.y = HEAD_Y + Math.sin(t * 2.2) * 0.01;
      blinkAt -= dt;
      const closed = blinkAt < 0.13 && blinkAt > 0;
      const map = closed ? faceClosed : faceOpen;
      if (faceMat.map !== map) faceMat.map = map;
      if (blinkAt < 0) blinkAt = 2.5 + Math.random() * 3;
    },
  };
}
