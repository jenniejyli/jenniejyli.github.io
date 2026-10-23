import * as THREE from "three";
import { FISH_ZONE, FISH_SCHOOLS, terrainHeight } from "./world.js";
import { rng, mergeShaded, m4, mat } from "./util.js";

// 沙滩边浅水里的锦鲤：平时在水面下慢慢游，有鱼食就冲过去，吃的时候跳出水面"啪"一下

const KOI = [
  { base: [1.0, 0.55, 0.25], patch: [1.0, 0.98, 0.95] },
  { base: [1.0, 0.82, 0.3], patch: [1.0, 0.9, 0.55] },
  { base: [0.98, 0.97, 0.94], patch: [0.92, 0.3, 0.25] },
  { base: [0.98, 0.97, 0.94], patch: [1.0, 0.6, 0.3] },
];
// 海里其他地方的小鱼（蓝色、黄色、小丑鱼橙色）
const SMALL = [
  { base: [0.3, 0.62, 0.98], patch: [1.0, 0.92, 0.4] },
  { base: [1.0, 0.82, 0.25], patch: [0.3, 0.55, 0.95] },
  { base: [1.0, 0.5, 0.18], patch: [1.0, 1.0, 1.0] },
  { base: [0.55, 0.85, 0.95], patch: [0.95, 0.55, 0.75] },
];

function koiGeometry(look, seed) {
  const r = rng(seed);
  const spots = Array.from({ length: 4 }, () => [(r() - 0.5) * 0.25, (r() - 0.3) * 0.35, r() * 0.12 + 0.07]);
  const skin = (x, y, z) => {
    for (const [sx, sz, rad] of spots) if (Math.hypot(x - sx, z - sz) < rad && y > -0.02) return look.patch;
    return look.base;
  };
  const fin = (x, y, z) => look.base.map((c) => Math.min(1, c * 0.95 + 0.08));
  return mergeShaded([
    { geo: new THREE.SphereGeometry(0.2, 16, 12), matrix: m4(0, 0, 0, 0, 0, 0, 0.55, 0.62, 1.35), color: skin },
    { geo: new THREE.ConeGeometry(0.17, 0.32, 4), matrix: m4(0, 0, -0.38, Math.PI / 2, 0, 0, 0.25, 1, 1), color: fin },
    { geo: new THREE.ConeGeometry(0.07, 0.2, 3), matrix: m4(0, 0.12, -0.02, -0.9, 0, 0, 0.2, 1, 1), color: fin },
    { geo: new THREE.SphereGeometry(0.06, 8, 6), matrix: m4(0.11, -0.05, 0.08, 0, 0, 0.6, 1, 0.2, 0.7), color: fin },
    { geo: new THREE.SphereGeometry(0.06, 8, 6), matrix: m4(-0.11, -0.05, 0.08, 0, 0, -0.6, 1, 0.2, 0.7), color: fin },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), matrix: m4(0.085, 0.04, 0.2), color: [0.1, 0.08, 0.1] },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), matrix: m4(-0.085, 0.04, 0.2), color: [0.1, 0.08, 0.1] },
  ]);
}

export function createFish(scene, { onEat, onSplash } = {}) {
  const r = rng(31);
  const randomPoint = (out = new THREE.Vector3(), c = FISH_ZONE, rad = c.r ?? FISH_ZONE.r) => {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * rad;
    return out.set(c.x + Math.cos(a) * rr, 0, c.z + Math.sin(a) * rr);
  };
  const swimY = (x, z) => Math.min(-0.22, Math.max(terrainHeight(x, z) + 0.28, -0.38));

  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
  const geos = KOI.map((k, i) => koiGeometry(k, 40 + i));
  const smallGeos = SMALL.map((k, i) => koiGeometry(k, 60 + i));
  const fish = [];
  const spawn = (geo, scale, zone) => {
    const g = new THREE.Mesh(geo, fishMat);
    g.scale.setScalar(scale);
    const pos = randomPoint(new THREE.Vector3(), zone);
    g.position.set(pos.x, swimY(pos.x, pos.z), pos.z);
    scene.add(g);
    fish.push({ g, target: randomPoint(new THREE.Vector3(), zone), vel: new THREE.Vector3(), phase: r() * 10, jump: 0, home: zone, zone });
  };
  for (let i = 0; i < 16; i++) spawn(geos[i % geos.length], 1.3 + r() * 0.6, FISH_ZONE);
  FISH_SCHOOLS.forEach((zone, k) => {
    for (let i = 0; i < 5; i++) spawn(smallGeos[(k + i) % smallGeos.length], 0.95 + r() * 0.35, zone);
  });

  const pellets = [];
  const pelletGeo = new THREE.SphereGeometry(0.085, 8, 6);
  const pelletMat = mat("#d99a52", { roughness: 0.6 });

  // 往 target 附近扔鱼食（不给 target 就扔到鱼群那里）
  function feed(from, target = null) {
    const center = target ? { x: target.x, z: target.z } : FISH_ZONE;
    for (let k = 0; k < 7; k++) {
      const mesh = new THREE.Mesh(pelletGeo, pelletMat);
      const start = new THREE.Vector3(from.x, from.y + 1.1, from.z);
      const end = randomPoint(new THREE.Vector3(), center, target ? 0.9 : 1.6);
      mesh.position.copy(start);
      scene.add(mesh);
      pellets.push({ mesh, start, end, t: -k * 0.06, state: "fly", life: 12 });
    }
    // 附近的鱼都游过来
    for (const f of fish) if (Math.hypot(f.g.position.x - center.x, f.g.position.z - center.z) < 12) f.home = { x: center.x, z: center.z, r: f.zone.r };
  }

  function nearFish(x, z, range = 9) {
    return fish.some((f) => Math.hypot(f.g.position.x - x, f.g.position.z - z) < range);
  }

  const tmp = new THREE.Vector3();
  function update(dt, t) {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      if (p.state === "fly") {
        p.t += dt / 0.8;
        const k = Math.max(0, Math.min(p.t, 1));
        p.mesh.position.lerpVectors(p.start, p.end, k);
        p.mesh.position.y = THREE.MathUtils.lerp(p.start.y, 0.03, k) + Math.sin(k * Math.PI) * 1.4;
        if (p.t >= 1) {
          p.state = "water";
          onSplash?.(p.end.x, p.end.z);
        }
      } else {
        p.life -= dt;
        p.mesh.position.y = 0.03 + Math.sin(t * 2 + i) * 0.02;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          pellets.splice(i, 1);
        }
      }
    }

    for (const f of fish) {
      const pos = f.g.position;
      let goal = f.target;
      let speed = 0.8;
      let nearest = null;
      let best = 10;
      for (const p of pellets) {
        if (p.state !== "water") continue;
        const d = Math.hypot(p.mesh.position.x - pos.x, p.mesh.position.z - pos.z);
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
      if (nearest) {
        goal = nearest.mesh.position;
        speed = 3.2;
        if (best < 0.35) {
          scene.remove(nearest.mesh);
          pellets.splice(pellets.indexOf(nearest), 1);
          f.jump = 1;
          onSplash?.(pos.x, pos.z);
          onEat?.();
        }
      } else if (Math.hypot(goal.x - pos.x, goal.z - pos.z) < 0.4) {
        randomPoint(f.target, f.home);
      }
      tmp.set(goal.x - pos.x, 0, goal.z - pos.z);
      const len = tmp.length();
      if (len > 0.001) tmp.multiplyScalar(speed / len);
      f.vel.lerp(tmp, 1 - Math.exp(-dt * 3));
      const nx = pos.x + f.vel.x * dt;
      const nz = pos.z + f.vel.z * dt;
      if (terrainHeight(nx, nz) < -0.45) {
        pos.x = nx;
        pos.z = nz;
      } else {
        randomPoint(f.target, f.home);
        f.vel.multiplyScalar(-0.5);
      }
      f.jump = Math.max(0, f.jump - dt * 1.6);
      const hop = Math.sin(f.jump * Math.PI);
      pos.y = swimY(pos.x, pos.z) + Math.sin(t * 2 + f.phase) * 0.03 + hop * 0.75;
      if (f.vel.lengthSq() > 0.0004) f.heading = Math.atan2(f.vel.x, f.vel.z);
      f.g.rotation.y = (f.heading ?? 0) + Math.sin(t * (6 + f.vel.length() * 5) + f.phase) * 0.14;
      f.g.rotation.x = -hop * 0.9 * Math.cos(f.jump * Math.PI);
    }
  }

  return { feed, update, nearFish };
}
