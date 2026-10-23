import * as THREE from "three";
import { canvasTexture, smoothstep, smoothNormals, mergeShaded } from "./util.js";

// ===== 小岛上的小人：POP MART 风格的真人定制手办 =====
// 头大一点（大约占身高的三分之一多一点），身体纤细；全部哑光（像搪胶 / 树脂）。
// 脸不是一个球：正面是比较平的一张脸，有脸颊、尖尖圆圆的小下巴、立体的小鼻子、细细的脖子；
// 大大的眼睛画在平平的脸上（深棕色的大眼珠、上眼皮压下来一点、粗眼线带一点眼尾），小小的嘟嘴，很淡的腮红。
// 头发是一块一块实心、圆润的雕塑发束。衣服是厚厚的、圆润的玩具体块。
// 四个人照着 Jennie 给的照片做：
//   jennie  黑长直 + 齐刘海，米白色摇粒绒外套（带帽子、口袋），灰色短上衣，蓝色喇叭牛仔裤，白球鞋
//   boy     短黑发 + 圆框眼镜，藏青短袖衬衫敞开 + 白 T，卡其阔腿短裤，白袜白球鞋，黑色斜挎包，手里一杯冰饮
//   girl    浅棕色波波头 + 斜刘海，黑色荷叶边吊带 + 黑色阔腿裤，小黑包 + 手机
//   barista 侧分短发，卡其色立领衬衫，棕色长围裙，棕色阔腿裤，黑色大头靴

const SKIN = "#f5d8c4";
const HEAD_R = 0.4; // 头部建模用的半径（整颗头再整体缩小到 HEAD_SCALE）
const HEAD_SCALE = 0.68;
const HEAD_Y = 1.36;
const HIP = 0.56;
const SHOULDER_Y = 0.95;

// ---------- 捏脸参数（studio.html 里可以用滑块调，调好的数字填回这里就是网站默认的样子）
export const SHAPE_DEFAULTS = {
  headSize: 1.0, // 整颗头的大小
  faceWidth: 0.94, // 脸宽
  headTop: 1.0, // 头顶高度
  faceFlat: 0.32, // 脸的正面有多平
  cheeks: 0.06, // 眼睛下面的脸颊肉
  chin: 0.3, // 下巴往里收多少（越大越尖）
  chinLength: 1.04, // 下半张脸的长短
  faceDepth: 1.0, // 脸的前后厚度
  neckLength: 0, // 脖子长短（头往上 / 往下挪）
  neckWidth: 0.042, // 脖子粗细
  eyeSize: 1.12, // 眼睛大小
  eyeSpacing: 0.155, // 两只眼睛离中间多远
  eyeHeight: 0, // 眼睛高低（正数往下）
  mouthHeight: 0, // 嘴巴高低（正数往下）
  blush: 0.3, // 腮红深浅
};
export const SHAPE = { ...SHAPE_DEFAULTS };
export function setShape(values) {
  for (const k of Object.keys(SHAPE_DEFAULTS)) {
    const v = Number(values?.[k]);
    SHAPE[k] = Number.isFinite(v) ? v : SHAPE_DEFAULTS[k];
  }
}

// iris 眼珠颜色，brow 眉毛，scarf 冬天的围巾颜色
const LOOKS = {
  jennie: { hair: "#3b3438", brow: "#3a3034", iris: "#4a3128", style: "long", outfit: "fleece", scarf: "#c9a27a", lashes: true },
  boy: { hair: "#302a27", brow: "#3a302a", iris: "#3f2c24", style: "short", outfit: "shirt", glasses: "#2a2626", scarf: "#8a9a6a" },
  girl: { hair: "#8a6550", brow: "#7a5a48", iris: "#4a3226", style: "bob", outfit: "black", scarf: "#e8d6c0", lashes: true },
  barista: { hair: "#3a2f2a", brow: "#3a2e28", iris: "#3f2c24", style: "side", outfit: "apron", scarf: "#b07a4a" },
};

// 哑光材质（搪胶 / 树脂的感觉：不反光）
const vinyl = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

// ---------- 头的形状：脸的正面压平（眼睛在平平的脸上），眼睛下面有脸颊，下巴越往下越窄、尖尖圆圆，还稍微往前一点
function headShape(x, y, z) {
  const t = y / HEAD_R;
  const f = Math.max(0, z / HEAD_R);
  const low = smoothstep(-0.2, -1.0, t);
  let w = SHAPE.faceWidth * (1 - SHAPE.chin * low ** 1.5);
  w *= 1 + SHAPE.cheeks * Math.exp(-(((t + 0.32) / 0.42) ** 2)) * f;
  const flat = 1 - SHAPE.faceFlat * smoothstep(0.15, 1.0, f) * (1 - 0.45 * low);
  const zz = z * flat * SHAPE.faceDepth + HEAD_R * 0.07 * low * f;
  return [x * w, y * (t < 0 ? SHAPE.chinLength : SHAPE.headTop), zz];
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
const sph = (R, phi, theta) => headShape(-R * Math.cos(phi) * Math.sin(theta), R * Math.cos(theta), R * Math.sin(phi) * Math.sin(theta));
// 头上的一个点：dphi 是离正前方往左右转了多少，th 是从头顶往下的角度
const P = (rr, dphi, th) => new THREE.Vector3(...sph(rr, Math.PI / 2 + dphi, th));

// ---------- 脸（手绘喷涂的感觉，画在贴图上贴在脸的正面）
const FACE = { phi: 1.9, t0: 0.32 * Math.PI, t1: 0.82 * Math.PI, W: 1024, H: 700 };
const eyeV = () => 0.42 + SHAPE.eyeHeight;
const faceTheta = (v) => FACE.t0 + v * (FACE.t1 - FACE.t0);

function faceTexture(look, closed) {
  const { W, H } = FACE;
  return canvasTexture(W, H, (g) => {
    g.lineCap = "round";
    g.lineJoin = "round";
    const ey = eyeV() * H;
    const ny = (0.6 + SHAPE.mouthHeight * 0.4) * H;
    const my = (0.735 + SHAPE.mouthHeight) * H;
    const es = SHAPE.eyeSize;
    // 很淡的腮红：在眼睛下面、靠外
    for (const s of [-1, 1]) {
      const x = 0.5 * W + s * (SHAPE.eyeSpacing * W + 30);
      const y = ey + 95;
      const grad = g.createRadialGradient(x, y, 0, x, y, 90);
      grad.addColorStop(0, `rgba(236,140,126,${SHAPE.blush})`);
      grad.addColorStop(1, "rgba(236,140,126,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, y, 96, 60, 0, 0, Math.PI * 2);
      g.fill();
    }
    for (const s of [-1, 1]) {
      g.save();
      g.translate(0.5 * W + s * SHAPE.eyeSpacing * W, ey);
      g.scale(es, es);
      // 眉毛：细细的、平平的，眉尾稍微往下
      g.strokeStyle = look.brow;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(-s * 52, -98);
      g.quadraticCurveTo(s * 10, -116, s * 78, -96);
      g.stroke();
      // 眼窝的一点点阴影（眼睛看起来更立体）
      const sh = g.createRadialGradient(0, -20, 10, 0, -20, 110);
      sh.addColorStop(0, "rgba(170,110,95,0.14)");
      sh.addColorStop(1, "rgba(170,110,95,0)");
      g.fillStyle = sh;
      g.beginPath();
      g.ellipse(0, -16, 112, 76, 0, 0, Math.PI * 2);
      g.fill();
      if (closed) {
        g.strokeStyle = "#2a2023";
        g.lineWidth = 12;
        g.beginPath();
        g.moveTo(-s * 84, 10);
        g.quadraticCurveTo(0, 30, s * 86, 6);
        g.lineTo(s * 102, -4);
        g.stroke();
        g.restore();
        continue;
      }
      // 眼睛的形状：上眼皮压下来一点（有点困、有点发呆），下边圆圆的
      g.save();
      g.beginPath();
      g.moveTo(-s * 86, 10);
      g.bezierCurveTo(-s * 50, -30, s * 40, -34, s * 88, -2);
      g.bezierCurveTo(s * 70, 50, -s * 50, 62, -s * 86, 10);
      g.closePath();
      g.fillStyle = "#f7f0e9";
      g.fill();
      g.clip();
      // 大大的深棕色眼珠
      const ir = g.createRadialGradient(s * 4, 18, 6, s * 4, 18, 56);
      ir.addColorStop(0, "#160e0f");
      ir.addColorStop(0.35, "#2a1a17");
      ir.addColorStop(0.75, look.iris);
      ir.addColorStop(1, "#1c1212");
      g.fillStyle = ir;
      g.beginPath();
      g.arc(s * 4, 16, 54, 0, Math.PI * 2);
      g.fill();
      // 上眼皮的阴影
      const lid = g.createLinearGradient(0, -34, 0, 14);
      lid.addColorStop(0, "rgba(40,24,24,0.55)");
      lid.addColorStop(1, "rgba(40,24,24,0)");
      g.fillStyle = lid;
      g.fillRect(-100, -40, 200, 54);
      // 两个小高光（哑光，不闪）
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.beginPath();
      g.arc(-s * 16, 2, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.45)";
      g.beginPath();
      g.arc(s * 22, 38, 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // 粗眼线 + 眼尾往外拉一点
      g.strokeStyle = "#231a1c";
      g.lineWidth = 13;
      g.beginPath();
      g.moveTo(-s * 86, 10);
      g.bezierCurveTo(-s * 50, -30, s * 40, -34, s * 88, -2);
      g.lineTo(s * 108, -12);
      g.stroke();
      if (look.lashes) {
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(s * 70, -16);
        g.lineTo(s * 84, -32);
        g.moveTo(s * 50, -24);
        g.lineTo(s * 60, -42);
        g.stroke();
      }
      // 双眼皮的褶
      g.strokeStyle = "rgba(140,88,76,0.5)";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-s * 64, -26);
      g.bezierCurveTo(-s * 30, -52, s * 40, -54, s * 82, -24);
      g.stroke();
      // 下眼睑：淡淡的一条
      g.strokeStyle = "rgba(150,96,84,0.4)";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-s * 54, 50);
      g.quadraticCurveTo(s * 10, 64, s * 72, 34);
      g.stroke();
      g.restore();
    }
    // 鼻子下面的小阴影（鼻子本身是立体的）
    g.fillStyle = "rgba(196,126,108,0.35)";
    g.beginPath();
    g.ellipse(0.5 * W, ny + 22, 18, 7, 0, 0, Math.PI * 2);
    g.fill();
    // 小小的、有一点嘟的嘴（不笑）
    const mx = 0.5 * W;
    g.save();
    g.translate(mx, my);
    g.scale(1.25, 1.25);
    g.translate(-mx, -my);
    g.fillStyle = "#cf8a82";
    g.beginPath();
    g.moveTo(mx - 26, my);
    g.quadraticCurveTo(mx - 12, my - 9, mx, my - 4);
    g.quadraticCurveTo(mx + 12, my - 9, mx + 26, my);
    g.quadraticCurveTo(mx, my + 20, mx - 26, my);
    g.fill();
    g.strokeStyle = "#9a4f4a";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(mx - 24, my + 1);
    g.quadraticCurveTo(mx, my + 5, mx + 24, my + 1);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.ellipse(mx + 4, my + 9, 7, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

// ---------- 头发：实心、圆润的一块一块发束（贴着头，横截面扁扁的，发梢圆圆地收口）
function clump(points, r0, { flat = 0.5, taper = 0.25, segs = 20, radial = 12 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pos = [];
  const idx = [];
  const T = new THREE.Vector3();
  const out = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    curve.getTangentAt(t, T);
    // "往外"的方向：从头中心指出去；垂在下面的部分只看水平方向（贴着身体垂下来）
    out.set(c.x, c.y < 0 ? c.y * 0.25 : c.y, c.z);
    if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
    out.addScaledVector(T, -out.dot(T)).normalize();
    side.crossVectors(T, out).normalize();
    let r = r0 * (1 - taper * t * t);
    if (t > 0.86) r *= Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2));
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const u = Math.cos(a) * r * flat;
      const v = Math.sin(a) * r;
      pos.push(c.x + out.x * u + side.x * v, c.y + out.y * u + side.y * v, c.z + out.z * u + side.z * v);
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

function surface(cols, rows, fn) {
  const pos = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pos.push(...fn(i / cols, j / rows));
  const idx = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a + 1, a, a + cols + 2, a, a + cols + 1, a + cols + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const fromFront = (phi) => Math.abs(((((phi - Math.PI / 2) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

function hairGeometry(look) {
  const R = HEAD_R;
  const parts = [];
  const add = (pts, r0, opts) => parts.push(clump(pts, r0, opts));
  const down = (p, dy, sx = 1, dz = 0) => new THREE.Vector3(p.x * sx, p.y - dy, p.z + dz);
  // 头皮上的一层（发束下面不会露出头皮）
  const back = look.style === "long" ? 0.66 : look.style === "bob" ? 0.62 : 0.56;
  parts.push(
    surface(60, 24, (u, v) => {
      const phi = u * Math.PI * 2;
      const k = smoothstep(0.4, 1.4, fromFront(phi));
      return sph(R + 0.02, phi, v * Math.PI * (0.3 + (back - 0.3) * k));
    }),
  );

  if (look.style === "long") {
    // 齐刘海：一排圆圆的发束，发梢齐齐地停在眉毛上面
    for (let k = 0; k < 9; k++) {
      const d = -0.82 + k * 0.205;
      add([P(R + 0.0, d * 0.55, 0.15 * Math.PI), P(R + 0.035, d * 0.85, 0.26 * Math.PI), P(R + 0.042, d * 0.97, 0.35 * Math.PI), P(R + 0.035, d, 0.42 * Math.PI)], 0.095, { flat: 0.42, taper: 0.05 });
    }
    // 两边垂下来的长发（盖住耳朵，落在肩膀外面，到胸口）
    for (const s of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const d = s * (1.02 + j * 0.24);
        const p3 = P(R + 0.05, d, 0.72 * Math.PI);
        const p4 = down(p3, 0.3, 1.06, 0.01);
        add([P(R + 0.025, d, 0.3 * Math.PI), P(R + 0.05, d, 0.52 * Math.PI), p3, p4, down(p4, 0.28, 0.97, -0.02)], 0.095, { flat: 0.45, taper: 0.2 });
      }
    }
    // 后面的长直发
    for (let k = 0; k < 9; k++) {
      const d = Math.PI + (k - 4) * 0.27;
      const p3 = P(R + 0.045, d, 0.72 * Math.PI);
      const p4 = down(p3, 0.32, 1.02, -0.03);
      add([P(R + 0.005, d, 0.22 * Math.PI), P(R + 0.045, d, 0.45 * Math.PI), p3, p4, down(p4, 0.3, 0.95, -0.01)], 0.11, { flat: 0.42, taper: 0.15 });
    }
  } else if (look.style === "bob") {
    // 斜刘海：从左边的分缝往右扫过额头
    for (let k = 0; k < 6; k++) {
      add([P(R + 0.01, 0.55 - k * 0.05, 0.08 * Math.PI), P(R + 0.05, 0.35 - k * 0.2, 0.24 * Math.PI), P(R + 0.048, 0.2 - k * 0.27, 0.36 * Math.PI), P(R + 0.035, 0.1 - k * 0.3, 0.45 * Math.PI)], 0.085, { flat: 0.45, taper: 0.2 });
    }
    // 齐下巴的波波头，发梢往里扣
    for (let k = 0; k < 14; k++) {
      const d = 0.95 + (k / 13) * (Math.PI * 2 - 1.9);
      add([P(R + 0.03, d, 0.2 * Math.PI), P(R + 0.07, d, 0.48 * Math.PI), P(R + 0.075, d, 0.7 * Math.PI), P(R + 0.02, d, 0.82 * Math.PI)], 0.1, { flat: 0.5, taper: 0.12 });
    }
  } else {
    if (look.style === "side") {
      // 店员：侧分，头发从左边的分缝往右后方梳，干干净净
      for (let k = 0; k < 8; k++) {
        add([P(R + 0.01, 0.5, 0.06 * Math.PI + k * 0.012 * Math.PI), P(R + 0.06, 0.28 - k * 0.2, 0.17 * Math.PI), P(R + 0.055, 0.08 - k * 0.22, 0.29 * Math.PI), P(R + 0.035, -0.02 - k * 0.24, 0.37 * Math.PI)], 0.095, { flat: 0.45, taper: 0.2 });
      }
    } else {
      // 男生：短短的、有点蓬的刘海盖到眉毛上面
      for (let k = 0; k < 9; k++) {
        const d = -0.72 + k * 0.18;
        add([P(R + 0.01, d * 0.3, 0.04 * Math.PI), P(R + 0.065, d * 0.8, 0.18 * Math.PI), P(R + 0.055, d, 0.3 * Math.PI), P(R + 0.035, d * 1.05, 0.4 * Math.PI)], 0.085, { flat: 0.45, taper: 0.25 });
      }
    }
    for (const s of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const d = s * (1.0 + j * 0.3);
        add([P(R + 0.02, d, 0.26 * Math.PI), P(R + 0.042, d, 0.42 * Math.PI), P(R + 0.028, d, 0.53 * Math.PI)], 0.08, { flat: 0.45, taper: 0.25 });
      }
    }
    for (let k = 0; k < 7; k++) {
      const d = Math.PI + (k - 3) * 0.32;
      add([P(R + 0.02, d, 0.14 * Math.PI), P(R + 0.05, d, 0.42 * Math.PI), P(R + 0.03, d, 0.62 * Math.PI)], 0.09, { flat: 0.45, taper: 0.25 });
    }
  }
  // 合成一个几何体：上面亮一点、下面暗一点，像手工喷涂
  const base = new THREE.Color(look.hair);
  return mergeShaded(
    parts.map((geo) => ({
      geo,
      color: (x, y, z, nx, ny) => {
        const k = 0.8 + 0.22 * ny + 0.08 * smoothstep(-0.3, 0.4, y);
        return [base.r * k, base.g * k, base.b * k];
      },
    })),
  );
}

// ---------- 衣服的小工具
function add(parent, geo, material, pos = [0, 0, 0], { rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  parent.add(m);
  return m;
}
// 轮廓点按从上到下写（[半径, 高度]）；gap > 0 就是前面开口的外套
function lathe(points, segs = 40, gap = 0) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)).reverse(),
    segs,
    gap,
    Math.PI * 2 - gap * 2,
  );
}
// 只包住前面一部分的（比如围裙）：从 start 角开始，转 length 那么多
function arcLathe(points, segs, start, length) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)).reverse(), segs, start, length);
}
// 外套前面开口那两条圆圆的边
function openEdges(parent, points, gap, r, material) {
  for (const phi of [gap, Math.PI * 2 - gap]) {
    const pts = points.map(([rr, y]) => new THREE.Vector3(rr * Math.sin(phi), y, rr * Math.cos(phi)));
    add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 8), material);
  }
}
// 摇粒绒那种毛茸茸的表面：顶点轻轻往外推一点
function fluffy(geo, amount = 0.006) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = Math.sin(x * 91 + y * 37) * Math.sin(z * 83 - y * 59) * 0.5 + 0.5;
    p.setXYZ(i, x + n.getX(i) * h * amount, y + n.getY(i) * h * amount, z + n.getZ(i) * h * amount);
  }
  geo.computeVertexNormals();
  return geo;
}
// 纤细的身体：肩膀、腰、胯
const TORSO = [[0.001, 1.0], [0.08, 0.995], [0.125, 0.96], [0.13, 0.9], [0.118, 0.82], [0.1, 0.74], [0.108, 0.66], [0.125, 0.58], [0.13, 0.54], [0.001, 0.52]];

export function makeCharacter(kind) {
  const look = LOOKS[kind];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = vinyl(SKIN, 0.7);
  // 胳膊、小腿用单独的材质：冬天换成长袖 / 长裤
  const armMat = vinyl(SKIN, 0.7);
  const shinMat = vinyl(SKIN, 0.7);
  const W = {}; // 冬天要换的颜色

  // ---------- 腿（大腿在屁股处转，小腿在膝盖处转）
  const legs = [];
  const knees = [];
  const legParts = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.068, HIP, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.26;
    const shoe = new THREE.Group();
    shoe.position.set(0, -0.25, 0.025);
    thigh.add(knee);
    knee.add(shoe);
    body.add(thigh);
    legs.push(thigh);
    knees.push(knee);
    legParts.push({ thigh, knee, shoe, side });
  }
  const legPart = (fn) => legParts.forEach(fn);
  const thighs = (mat, r = 0.058) => legPart(({ thigh }) => add(thigh, new THREE.CapsuleGeometry(r, 0.16, 6, 14), mat, [0, -0.13, 0]));
  const shins = (mat, r = 0.05) => legPart(({ knee }) => add(knee, new THREE.CapsuleGeometry(r, 0.15, 6, 14), mat, [0, -0.12, 0]));
  const wideLeg = (mat, top, bottom, len = 0.26) => legPart(({ knee }) => add(knee, new THREE.CylinderGeometry(top, bottom, len, 18), mat, [0, -len / 2 + 0.01, 0]));
  const sneaker = (color, sole, stripes = null) =>
    legPart(({ shoe, side }) => {
      add(shoe, new THREE.SphereGeometry(0.085, 20, 14), vinyl(color, 0.75), [0, 0.005, 0], { scale: [0.88, 0.6, 1.45] });
      add(shoe, new THREE.CylinderGeometry(0.08, 0.08, 0.03, 20), vinyl(sole, 0.85), [0, -0.03, 0], { scale: [0.9, 1, 1.48] });
      if (stripes) for (let k = 0; k < 3; k++) add(shoe, new THREE.BoxGeometry(0.01, 0.038, 0.01), vinyl(stripes), [side * 0.072, 0.008, -0.026 + k * 0.026], { rot: [0.5, 0, 0] });
    });

  // ---------- 手臂
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.155, SHOULDER_Y, 0);
    arm.rotation.z = side * 0.1;
    body.add(arm);
    arms.push(arm);
  }
  arms.forEach((arm) => add(arm, new THREE.SphereGeometry(0.045, 16, 12), skin, [0, -0.42, 0.005], { scale: [0.85, 1.1, 0.8] }));
  const upperArm = (mat, r = 0.04) => arms.forEach((arm) => add(arm, new THREE.CapsuleGeometry(r, 0.3, 6, 14), mat, [0, -0.2, 0]));
  const torso = (mat) => add(body, lathe(TORSO, 36), mat, [0, 0, 0], { scale: [1, 1, 0.78] });

  if (look.outfit === "fleece") {
    // Jennie：灰色短上衣 + 蓝色喇叭牛仔裤 + 米白摇粒绒外套 + 白球鞋
    const denim = vinyl("#7f9dc2", 0.86);
    const fleece = vinyl("#efe6d6", 0.95, { side: THREE.DoubleSide });
    torso(vinyl("#a9adb4"));
    add(body, new THREE.CylinderGeometry(0.13, 0.136, 0.12, 24), denim, [0, 0.56, 0], { scale: [1, 1, 0.8] });
    add(body, new THREE.TorusGeometry(0.13, 0.013, 8, 30), vinyl("#6f8db3", 0.86), [0, 0.615, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.8, 1] });
    thighs(denim, 0.06);
    wideLeg(denim, 0.054, 0.086, 0.26);
    sneaker("#f3f1ec", "#d8d2c8");
    const prof = [[0.09, 1.02], [0.16, 0.99], [0.185, 0.93], [0.19, 0.8], [0.195, 0.66], [0.19, 0.6]];
    add(body, fluffy(lathe(prof, 48, 0.42)), fleece);
    openEdges(body, prof, 0.42, 0.018, fleece);
    add(body, new THREE.TorusGeometry(0.19, 0.02, 8, 40, Math.PI * 2 - 0.84), fleece, [0, 0.6, 0], { rot: [Math.PI / 2, 0, Math.PI / 2 + 0.42] });
    add(body, fluffy(new THREE.SphereGeometry(0.12, 20, 14)), fleece, [0, 1.0, -0.12], { scale: [1.25, 0.55, 0.75] });
    add(body, new THREE.TorusGeometry(0.1, 0.03, 10, 28, Math.PI * 1.3), fleece, [0, 0.995, 0], { rot: [Math.PI / 2, 0, Math.PI * 0.85] });
    for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.08, 0.075, 0.02), fleece, [s * 0.135, 0.68, 0.14], { rot: [0, s * 0.75, 0] });
    upperArm(fleece, 0.055);
    arms.forEach((arm) => add(arm, new THREE.TorusGeometry(0.045, 0.02, 8, 20), fleece, [0, -0.37, 0], { rot: [Math.PI / 2, 0, 0] }));
  } else if (look.outfit === "shirt") {
    // 男生：白 T + 敞开的藏青短袖衬衫 + 卡其阔腿短裤 + 白袜白鞋（三条黑杠）+ 黑色斜挎包
    const navy = vinyl("#34466b", 0.86, { side: THREE.DoubleSide });
    const khaki = vinyl("#bfae8f", 0.88);
    torso(vinyl("#f2f0eb"));
    const prof = [[0.085, 1.0], [0.15, 0.98], [0.18, 0.92], [0.185, 0.78], [0.19, 0.62], [0.195, 0.55]];
    add(body, lathe(prof, 44, 0.32), navy);
    openEdges(body, prof, 0.32, 0.013, navy);
    for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.08, 0.016, 0.055), navy, [s * 0.058, 0.99, 0.085], { rot: [0.5, s * -0.5, s * 0.35] });
    for (let k = 0; k < 4; k++) add(body, new THREE.SphereGeometry(0.007, 8, 6), vinyl("#e9e6df"), [-Math.sin(0.32) * 0.19 - 0.008, 0.9 - k * 0.09, Math.cos(0.32) * 0.19 + 0.008]);
    arms.forEach((arm) => add(arm, new THREE.CylinderGeometry(0.058, 0.064, 0.11, 16), navy, [0, -0.05, 0]));
    upperArm(armMat, 0.038);
    W.arm = "#34466b";
    add(body, new THREE.CylinderGeometry(0.135, 0.142, 0.12, 24), khaki, [0, 0.56, 0], { scale: [1, 1, 0.8] });
    legPart(({ thigh }) => add(thigh, new THREE.CylinderGeometry(0.07, 0.079, 0.26, 16), khaki, [0, -0.12, 0]));
    shins(shinMat, 0.046);
    W.shin = "#bfae8f";
    legPart(({ knee }) => add(knee, new THREE.CylinderGeometry(0.051, 0.05, 0.08, 14), vinyl("#f6f4ef"), [0, -0.2, 0]));
    sneaker("#f4f2ed", "#e2ddd4", "#262323");
    const strap = new THREE.CatmullRomCurve3([new THREE.Vector3(0.12, 0.97, -0.01), new THREE.Vector3(0.04, 0.88, 0.12), new THREE.Vector3(-0.1, 0.7, 0.115), new THREE.Vector3(-0.16, 0.62, 0.06)]);
    add(body, new THREE.TubeGeometry(strap, 20, 0.009, 6), vinyl("#232122"));
    add(body, new THREE.BoxGeometry(0.1, 0.085, 0.04), vinyl("#2a2728"), [-0.17, 0.6, 0.06], { rot: [0, -0.5, 0] });
  } else if (look.outfit === "black") {
    // 女生：黑色荷叶边吊带 + 黑色阔腿裤 + 腰带 + 小黑包 + 手机
    const black = vinyl("#2c2b30", 0.86, { side: THREE.DoubleSide });
    torso(skin);
    add(body, lathe([[0.112, 0.93], [0.128, 0.88], [0.12, 0.8], [0.105, 0.72], [0.113, 0.64], [0.12, 0.6]], 36), black, [0, 0, 0], { scale: [1.04, 1, 0.82] });
    for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.035, 0.02, 0.18), black, [s * 0.085, 0.97, 0], { rot: [0, 0, s * 0.3] });
    const ruffle = lathe([[0.13, 0.93], [0.16, 0.88], [0.2, 0.79], [0.205, 0.775]], 64);
    const rp = ruffle.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i);
      const z = rp.getZ(i);
      const y = rp.getY(i);
      const w = Math.sin(Math.atan2(x, z) * 9) * 0.014 * smoothstep(0.9, 0.78, y);
      rp.setXYZ(i, x * (1 + w * 2), y + w, z * (1 + w * 2));
    }
    ruffle.computeVertexNormals();
    add(body, ruffle, black, [0, 0, 0], { scale: [1, 1, 0.84] });
    upperArm(armMat, 0.036);
    W.arm = "#2c2b30";
    add(body, new THREE.CylinderGeometry(0.128, 0.134, 0.1, 24), black, [0, 0.57, 0], { scale: [1, 1, 0.8] });
    add(body, new THREE.TorusGeometry(0.124, 0.01, 6, 30), vinyl("#1d1c20"), [0, 0.615, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.82, 1] });
    add(body, new THREE.BoxGeometry(0.028, 0.02, 0.008), vinyl("#c9a35a", 0.5), [0, 0.615, 0.104]);
    thighs(black, 0.068);
    wideLeg(black, 0.068, 0.078, 0.27);
    legPart(({ shoe }) => add(shoe, new THREE.SphereGeometry(0.075, 18, 12), vinyl("#1f1e22", 0.7), [0, -0.01, 0.01], { scale: [0.85, 0.45, 1.4] }));
  } else {
    // 店员：卡其立领衬衫 + 棕色长围裙 + 棕色阔腿裤 + 黑色大头靴
    const tan = vinyl("#c9a97c", 0.86);
    const apron = vinyl("#7b5536", 0.88, { side: THREE.DoubleSide });
    const pants = vinyl("#6c4a33", 0.88);
    torso(tan);
    add(body, new THREE.CylinderGeometry(0.058, 0.062, 0.045, 18), tan, [0, 0.99, 0]);
    add(body, new THREE.BoxGeometry(0.01, 0.26, 0.008), vinyl("#b8976a"), [0, 0.82, 0.1]);
    add(body, new THREE.CircleGeometry(0.014, 14), vinyl("#5a3e2a"), [0.065, 0.88, 0.092]);
    upperArm(tan, 0.043);
    arms.forEach((arm) => add(arm, new THREE.CylinderGeometry(0.047, 0.047, 0.03, 14), vinyl("#b8976a"), [0, -0.36, 0]));
    add(body, new THREE.CylinderGeometry(0.13, 0.138, 0.1, 24), pants, [0, 0.57, 0], { scale: [1, 1, 0.8] });
    thighs(pants, 0.066);
    wideLeg(pants, 0.066, 0.074, 0.27);
    add(body, arcLathe([[0.135, 0.62], [0.145, 0.5], [0.155, 0.38], [0.163, 0.3], [0.166, 0.28]], 36, -1.75, 3.5), apron, [0, 0, 0.004], { scale: [1, 1, 0.86] });
    add(body, new THREE.TorusGeometry(0.13, 0.014, 8, 32), apron, [0, 0.62, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.82, 1] });
    add(body, new THREE.SphereGeometry(0.022, 12, 10), apron, [0.04, 0.62, 0.11]);
    for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.022, 0.09, 0.01), apron, [0.04 + s * 0.015, 0.565, 0.115], { rot: [0, 0, s * 0.18] });
    legPart(({ shoe }) => {
      add(shoe, new THREE.SphereGeometry(0.09, 20, 14), vinyl("#242123", 0.7), [0, 0.01, 0], { scale: [0.92, 0.62, 1.42] });
      add(shoe, new THREE.CylinderGeometry(0.084, 0.084, 0.034, 20), vinyl("#141213", 0.85), [0, -0.03, 0], { scale: [0.92, 1, 1.44] });
    });
  }
  // 细细的脖子（颜色比脸深一点点，和下巴分得开）
  const neckTop = HEAD_Y + SHAPE.neckLength - 0.2;
  add(body, new THREE.CylinderGeometry(SHAPE.neckWidth, SHAPE.neckWidth * 1.15, neckTop - 0.95, 16), vinyl("#ecc6b0", 0.7), [0, (neckTop + 0.95) / 2, -0.012]);

  // 冬天的围巾
  const scarfMat = vinyl(look.scarf, 0.95);
  const scarf = new THREE.Group();
  add(scarf, new THREE.TorusGeometry(0.072, 0.034, 10, 26), scarfMat, [0, 1.0, 0.008], { rot: [Math.PI / 2, 0, 0] });
  add(scarf, new THREE.BoxGeometry(0.06, 0.16, 0.026), scarfMat, [0.045, 0.9, 0.11], { rot: [0.22, 0, 0.12] });
  scarf.visible = false;
  body.add(scarf);

  // ---------- 头
  const head = new THREE.Group();
  const headY = HEAD_Y + SHAPE.neckLength;
  head.position.y = headY;
  head.scale.setScalar(HEAD_SCALE * SHAPE.headSize);
  body.add(head);
  add(head, smoothNormals(headGeometry(HEAD_R, [64, 48])), skin);
  for (const side of [-1, 1]) add(head, new THREE.SphereGeometry(0.06, 14, 10), skin, headShape(side * HEAD_R, -0.05, -0.02), { scale: [0.45, 0.8, 0.62] });
  // 立体的小鼻子
  const noseAt = P(HEAD_R, 0, faceTheta(0.6 + SHAPE.mouthHeight * 0.4));
  add(head, new THREE.SphereGeometry(0.024, 16, 12), skin, [noseAt.x, noseAt.y + 0.014, noseAt.z - 0.012], { rot: [0.35, 0, 0], scale: [0.85, 1.3, 0.75] });
  const faceOpen = faceTexture(look, false);
  const faceClosed = faceTexture(look, true);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceOpen, transparent: true, roughness: 0.72, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  add(head, headGeometry(HEAD_R + 0.002, [64, 36, Math.PI / 2 - FACE.phi / 2, FACE.phi, FACE.t0, FACE.t1 - FACE.t0]), faceMat);
  add(head, hairGeometry(look), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, side: THREE.DoubleSide }));

  if (look.glasses) {
    // 细细的圆框眼镜（按眼睛的位置对齐）
    const frame = vinyl(look.glasses, 0.6);
    const glasses = new THREE.Group();
    const eyePhi = SHAPE.eyeSpacing * FACE.phi;
    const eyeTheta = faceTheta(eyeV() + 0.02);
    for (const side of [-1, 1]) {
      add(glasses, new THREE.TorusGeometry(0.08 * SHAPE.eyeSize, 0.008, 8, 32), frame, P(HEAD_R + 0.03, side * eyePhi, eyeTheta).toArray(), { rot: [0, side * eyePhi * 0.6, 0] });
      const from = P(HEAD_R + 0.025, side * (eyePhi + 0.22 * SHAPE.eyeSize), eyeTheta);
      const to = P(HEAD_R + 0.01, side * 1.45, eyeTheta - 0.02);
      const temple = add(glasses, new THREE.CylinderGeometry(0.006, 0.006, from.distanceTo(to), 6), frame, from.clone().lerp(to, 0.5).toArray());
      temple.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
    const mid = P(HEAD_R + 0.035, 0, eyeTheta - 0.03);
    add(glasses, new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), frame, [0, mid.y - 0.012, mid.z], { scale: [1, 0.55, 1] });
    head.add(glasses);
  }

  // ---------- 手上的东西：默认的小配件（男生的冰饮、女生的手机和小包），在咖啡店买的饮料 / 蛋糕
  const props = new THREE.Group();
  arms[0].add(props);
  if (look.outfit === "shirt") {
    add(props, new THREE.CylinderGeometry(0.038, 0.03, 0.1, 16), vinyl("#f0a24a", 0.6), [0, -0.45, 0.05]);
    add(props, new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), vinyl("#f4f2ee", 0.6), [0, -0.395, 0.05]);
    add(props, new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), vinyl("#2a2a2a"), [0.01, -0.355, 0.05]);
  } else if (look.outfit === "black") {
    add(props, new THREE.BoxGeometry(0.05, 0.09, 0.01), vinyl("#9fd8c0", 0.6), [0, -0.45, 0.06], { rot: [-0.6, 0, 0] });
    const bag = new THREE.Group();
    add(bag, new THREE.BoxGeometry(0.1, 0.075, 0.045), vinyl("#1f1e22", 0.75), [0, -0.5, 0.01]);
    add(bag, new THREE.TorusGeometry(0.034, 0.006, 6, 16, Math.PI), vinyl("#c9a35a", 0.5), [0, -0.462, 0.01]);
    arms[1].add(bag);
  }
  const cup = new THREE.Group();
  const cupBody = add(cup, new THREE.CylinderGeometry(0.04, 0.032, 0.09, 16), vinyl("#fbf7ef", 0.7));
  const cupBand = add(cup, new THREE.CylinderGeometry(0.041, 0.041, 0.03, 16), vinyl("#d9604f", 0.7), [0, -0.008, 0]);
  add(cup, new THREE.CylinderGeometry(0.042, 0.042, 0.016, 16), vinyl("#8a5a3b", 0.7), [0, 0.05, 0]);
  cup.position.set(0, -0.47, 0.05);
  cup.rotation.x = 0.75;
  cup.visible = false;
  arms[0].add(cup);
  const plate = new THREE.Group();
  add(plate, new THREE.CylinderGeometry(0.07, 0.058, 0.012, 20), vinyl("#ffffff", 0.7));
  add(plate, new THREE.CylinderGeometry(0.048, 0.048, 0.05, 16, 1, false, 0, Math.PI * 0.45), vinyl("#f6dcb4"), [-0.01, 0.031, -0.01]);
  const cakeTop = add(plate, new THREE.CylinderGeometry(0.049, 0.049, 0.012, 16, 1, false, 0, Math.PI * 0.45), vinyl("#f6a5b8"), [-0.01, 0.06, -0.01]);
  plate.position.set(0, -0.48, 0.07);
  plate.rotation.x = 0.75;
  plate.visible = false;
  arms[0].add(plate);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.material !== faceMat;
      o.receiveShadow = false;
    }
  });

  let phase = 0;
  let blinkAt = 2 + Math.random() * 3;
  let waving = false;
  let bounce = 0;
  let sitting = false;
  const hasProp = props.children.length > 0;
  const hold = (what, color) => {
    cup.visible = what === "cup";
    plate.visible = what === "cake";
    props.visible = !what;
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
    // 冬天：围巾；短袖的换长袖，短裤的换长裤
    setSeason(name) {
      const w = name === "winter";
      scarf.visible = w;
      armMat.color.set(w && W.arm ? W.arm : SKIN);
      shinMat.color.set(w && W.shin ? W.shin : SKIN);
    },
    update(dt, t, speed) {
      const move = sitting ? 0 : Math.min(speed, 1);
      phase += dt * (6.5 + 4.5 * move) * (move > 0.05 ? 1 : 0);
      const swing = Math.sin(phase) * 0.5 * move;
      legs[0].rotation.x = sitting ? -1.5 : swing;
      legs[1].rotation.x = sitting ? -1.5 : -swing;
      knees[0].rotation.x = sitting ? 1.5 : Math.max(0, Math.sin(phase)) * 0.6 * move;
      knees[1].rotation.x = sitting ? 1.5 : Math.max(0, -Math.sin(phase)) * 0.6 * move;
      const busy = cup.visible || plate.visible || hasProp;
      arms[0].rotation.x = busy ? -0.75 : sitting ? -0.4 : -swing * 0.8;
      arms[1].rotation.x = waving ? 0 : sitting ? -0.4 : swing * 0.8;
      arms[1].rotation.z = waving ? -2.6 + Math.sin(t * 9) * 0.3 : 0.1;
      bounce = Math.max(0, bounce - dt * 2.5);
      const hopY = Math.sin(bounce * Math.PI);
      body.position.y = Math.abs(Math.sin(phase)) * 0.03 * move + hopY * 0.3;
      body.scale.set(1 + hopY * 0.04, 1 - hopY * 0.05 + Math.sin(t * 2) * 0.004, 1 + hopY * 0.04);
      // 头微微低着，轻轻晃
      head.rotation.x = 0.08 + Math.sin(t * 0.7) * 0.02;
      head.rotation.z = Math.sin(t * 1.3) * 0.03 * (1 - move);
      head.position.y = headY + Math.sin(t * 2) * 0.004;
      blinkAt -= dt;
      const closed = blinkAt < 0.14 && blinkAt > 0;
      const map = closed ? faceClosed : faceOpen;
      if (faceMat.map !== map) faceMat.map = map;
      if (blinkAt < 0) blinkAt = 2.8 + Math.random() * 3.5;
    },
  };
}
