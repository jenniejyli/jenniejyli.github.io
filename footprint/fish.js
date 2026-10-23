import * as THREE from "three";
import { FISH_ZONE, terrainHeight } from "./world.js";
import { mat, rng } from "./util.js";

// 沙滩边浅水里的小鱼：平时慢慢游，有鱼食就游过去吃
export function createFish(scene, { onEat, onSplash } = {}) {
  const r = rng(31);
  const colors = ["#ff9f8a", "#ffd36e", "#8fd3f0", "#f6a5c0", "#ffffff", "#ffb36b", "#b9a7f2"];
  const eyeMat = mat("#1f2430");
  const randomPoint = (out = new THREE.Vector3()) => {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * FISH_ZONE.r;
    return out.set(FISH_ZONE.x + Math.cos(a) * rr, 0, FISH_ZONE.z + Math.sin(a) * rr);
  };
  const depthAt = (x, z) => Math.min(-0.22, Math.max(terrainHeight(x, z) + 0.28, -0.6));

  const fish = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const m = mat(colors[i % colors.length], { roughness: 0.45 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), m);
    body.scale.set(0.55, 0.75, 1.25);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 4), m);
    tail.rotation.x = Math.PI / 2;
    tail.scale.x = 0.3;
    tail.position.z = -0.34;
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), eyeMat);
      eye.position.set(side * 0.09, 0.04, 0.17);
      g.add(eye);
    }
    g.add(body, tail);
    const s = 0.8 + r() * 0.5;
    g.scale.setScalar(s);
    const pos = randomPoint();
    g.position.set(pos.x, depthAt(pos.x, pos.z), pos.z);
    scene.add(g);
    fish.push({ g, tail, target: randomPoint(), vel: new THREE.Vector3(), phase: r() * 10, jump: 0 });
  }

  const pellets = [];
  const pelletGeo = new THREE.SphereGeometry(0.06, 6, 5);
  const pelletMat = mat("#c98f55");

  function feed(from) {
    for (let k = 0; k < 6; k++) {
      const mesh = new THREE.Mesh(pelletGeo, pelletMat);
      const start = new THREE.Vector3(from.x, from.y + 1.1, from.z);
      const end = randomPoint();
      mesh.position.copy(start);
      scene.add(mesh);
      pellets.push({ mesh, start, end, t: -k * 0.06, state: "fly", life: 9 });
    }
  }

  const tmp = new THREE.Vector3();
  function update(dt, t) {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      if (p.state === "fly") {
        p.t += dt / 0.8;
        const k = Math.max(0, Math.min(p.t, 1));
        p.mesh.position.lerpVectors(p.start, p.end, k);
        p.mesh.position.y = THREE.MathUtils.lerp(p.start.y, 0.02, k) + Math.sin(k * Math.PI) * 1.4;
        if (p.t >= 1) {
          p.state = "water";
          onSplash?.(p.end.x, p.end.z);
        }
      } else {
        p.life -= dt;
        p.mesh.position.y = Math.max(depthAt(p.end.x, p.end.z), p.mesh.position.y - dt * 0.12);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          pellets.splice(i, 1);
        }
      }
    }

    for (const f of fish) {
      const pos = f.g.position;
      let goal = f.target;
      let speed = 0.7;
      let nearest = null;
      let best = 7;
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
        speed = 2.1;
        if (best < 0.3) {
          scene.remove(nearest.mesh);
          pellets.splice(pellets.indexOf(nearest), 1);
          f.jump = 1;
          onEat?.();
        }
      } else if (Math.hypot(goal.x - pos.x, goal.z - pos.z) < 0.3) {
        randomPoint(f.target);
      }
      tmp.set(goal.x - pos.x, 0, goal.z - pos.z);
      const len = tmp.length();
      if (len > 0.001) tmp.multiplyScalar(speed / len);
      f.vel.lerp(tmp, 1 - Math.exp(-dt * 3));
      pos.x += f.vel.x * dt;
      pos.z += f.vel.z * dt;
      f.jump = Math.max(0, f.jump - dt * 2);
      pos.y = depthAt(pos.x, pos.z) + Math.sin(t * 2 + f.phase) * 0.04 + Math.sin(f.jump * Math.PI) * 0.35;
      if (f.vel.lengthSq() > 0.0004) f.g.rotation.y = Math.atan2(f.vel.x, f.vel.z);
      f.tail.rotation.y = Math.sin(t * (6 + f.vel.length() * 6) + f.phase) * 0.5;
    }
  }

  return { feed, update };
}
