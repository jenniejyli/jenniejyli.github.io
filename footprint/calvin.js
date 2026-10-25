// ===== 咖啡店的店员 Calvin =====
// 有人往咖啡店走过来、或者在等饮料的时候，他站在店门口的橱窗前招呼大家。
// 一阵子没人来，他就去岛上逛逛：摸摸猫、喂喂鱼、给花浇水、在长椅上坐一会儿，
// 或者回店里休息（这时候岛上看不到他）。一有人往咖啡店走，他就赶紧回来（在店里的话直接从门口出来）。

const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// spots：{ flowers: [{x, z, face}], fish: {x, z, face}, benches: [{x, z, ry, seat}] }
// cats()：返回 [{ root, k }]；poke(k)：让猫跳一下；feed(from, to)：往水里扔鱼食；hearts / water：小特效
export function createCalvin({ figure, world, groundHeight, cafe, post, door, spots, cats, poke, feed, hearts, water, seatFree }) {
  const root = figure.root;
  const S = { mode: "post", timer: rand(18, 30), target: null, then: null, hurry: false, stuck: 0, tick: 0, activity: null, cat: null, talk: 0 };

  // 咖啡店附近（柜台、门口）可以穿过店的碰撞圈；其他地方照常绕开东西
  const walkable = (x, z) => Math.hypot(x - cafe.x, z - cafe.z) < 3.6 || world.walkable(x, z, 0.3);
  const place = (p) => root.position.set(p.x, groundHeight(p.x, p.z), p.z);
  const face = (p) => {
    const dx = p.x - root.position.x;
    const dz = p.z - root.position.z;
    if (dx * dx + dz * dz > 1e-4) root.rotation.y = Math.atan2(dx, dz);
  };

  function goTo(p, then, hurry = false) {
    S.mode = "walking";
    S.target = { x: p.x, z: p.z };
    S.then = then;
    S.hurry = hurry;
    S.stuck = 0;
  }
  function atPost() {
    S.mode = "post";
    S.activity = null;
    S.timer = rand(20, 35);
    place(post);
    root.rotation.y = post.ry;
  }
  function backToPost(hurry = false) {
    if (S.mode === "sitting") figure.sit(false);
    S.activity = null;
    goTo(post, atPost, hurry);
  }
  function appearAtDoor() {
    root.visible = true;
    place(door);
    figure.hop();
  }

  // 找点事做
  function nextActivity() {
    const choices = ["cat", "cat", "fish", "flowers", "flowers", "bench", "inside", "inside"];
    const what = pickOne(choices);
    S.activity = what;
    if (what === "cat") {
      const list = cats();
      if (!list.length) return nextActivity();
      S.cat = list.reduce((a, b) => (dist(a.root.position, root.position) < dist(b.root.position, root.position) ? a : b));
      goTo(S.cat.root.position, () => doing(8), false);
    } else if (what === "fish") {
      goTo(spots.fish, () => doing(9), false);
    } else if (what === "flowers") {
      S.spot = pickOne(spots.flowers);
      goTo(S.spot, () => doing(7), false);
    } else if (what === "bench") {
      const free = spots.benches.filter((b) => seatFree(b.seat));
      if (!free.length) return nextActivity();
      S.bench = pickOne(free);
      goTo(S.bench.front, () => {
        if (!seatFree(S.bench.seat)) return doing(3);
        S.mode = "sitting";
        S.timer = rand(10, 16);
        place(S.bench);
        root.rotation.y = S.bench.ry;
        figure.sit(true);
      });
    } else {
      // 回店里休息一会儿（看不到他）
      goTo(door, () => {
        S.mode = "inside";
        S.timer = rand(25, 45);
        root.visible = false;
      });
    }
  }
  function doing(seconds) {
    S.mode = "doing";
    S.timer = seconds;
    S.tick = 0.6;
  }

  // 有人往咖啡店走过来：回到门口
  function comeBack() {
    if (S.mode === "post" || (S.mode === "walking" && S.then === atPost)) return;
    if (S.mode === "inside") {
      appearAtDoor();
      return goTo(post, atPost, true);
    }
    if (S.mode === "sitting") figure.sit(false);
    if (dist(root.position, post) > 22) {
      // 太远了：一下子"回店里"，再从门口出来
      root.visible = false;
      S.mode = "inside";
      S.timer = 1.2;
      S.activity = "returning";
      return;
    }
    backToPost(true);
  }

  function update(dt, t, { customer, player }) {
    if (customer) comeBack();
    let speed = 0;
    S.talk = Math.max(0, S.talk - dt);

    if (S.mode === "post") {
      if (player && (customer || S.talk > 0) && dist(player.position, root.position) < 12) face(player.position);
      else root.rotation.y += ((post.ry - root.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * (1 - Math.exp(-dt * 3));
      if (!customer && S.talk <= 0 && (S.timer -= dt) <= 0) nextActivity();
    } else if (S.mode === "walking") {
      if (S.talk > 0) {
        if (player) face(player.position);
      } else {
        // 追猫的时候猫会跑，目标跟着猫走（停在猫旁边一点点）
        if (S.activity === "cat" && S.cat) {
          const c = S.cat.root.position;
          const d = Math.max(dist(c, root.position), 1e-3);
          S.target = { x: c.x + ((root.position.x - c.x) / d) * 0.8, z: c.z + ((root.position.z - c.z) / d) * 0.8 };
        }
        const p = root.position;
        const dx = S.target.x - p.x;
        const dz = S.target.z - p.z;
        const d = Math.hypot(dx, dz);
        const v = (S.hurry ? 3.2 : 1.5) * dt;
        if (d < 0.25) {
          const then = S.then;
          S.then = null;
          then?.();
        } else {
          const step = Math.min(v, d);
          const nx = p.x + (dx / d) * step;
          const nz = p.z + (dz / d) * step;
          const ox = p.x;
          const oz = p.z;
          if (walkable(nx, nz)) p.set(nx, p.y, nz);
          else if (walkable(nx, p.z)) p.x = nx;
          else if (walkable(p.x, nz)) p.z = nz;
          S.stuck = Math.hypot(p.x - ox, p.z - oz) < step * 0.3 ? S.stuck + dt : 0;
          if (S.stuck > 1.4) {
            // 被挡住了：直接"走"到目的地（一般这时候没人看着他）
            place(S.target);
            S.stuck = 0;
          }
          p.y = groundHeight(p.x, p.z);
          root.rotation.y = Math.atan2(dx, dz);
          speed = S.hurry ? 1 : 0.7;
        }
      }
    } else if (S.mode === "doing") {
      S.timer -= dt;
      S.tick -= dt;
      const pos = root.position;
      if (S.activity === "cat" && S.cat) {
        const c = S.cat.root.position;
        face(c);
        if (dist(c, pos) > 2.2) goTo(c, () => doing(Math.max(S.timer, 3)));
        else if (S.tick <= 0) {
          poke(S.cat.k);
          hearts(c.x, c.y + 0.6, c.z);
          S.tick = 2.4;
        }
      } else if (S.activity === "fish") {
        face(spots.fish.face);
        if (S.tick <= 0) {
          feed(pos, spots.fish.face);
          S.tick = 3;
        }
      } else if (S.activity === "flowers") {
        face(S.spot.face);
        if (S.tick <= 0) {
          water(S.spot.face.x, groundHeight(S.spot.face.x, S.spot.face.z) + 0.5, S.spot.face.z);
          S.tick = 1.1;
        }
      }
      if (S.timer <= 0) {
        if (Math.random() < 0.45) backToPost();
        else nextActivity();
      }
    } else if (S.mode === "sitting") {
      if ((S.timer -= dt) <= 0) {
        figure.sit(false);
        const b = S.bench;
        place({ x: b.x + Math.sin(b.ry) * 0.75, z: b.z + Math.cos(b.ry) * 0.75 });
        Math.random() < 0.5 ? backToPost() : nextActivity();
      }
    } else if (S.mode === "inside") {
      if ((S.timer -= dt) <= 0) {
        appearAtDoor();
        goTo(post, atPost, S.activity === "returning");
      }
    }
    figure.update(dt, t, speed);
  }

  atPost();
  return {
    root,
    update,
    comeBack,
    get visible() {
      return root.visible;
    },
    // 他现在在干什么（说话的时候用）
    get activity() {
      return S.mode === "post" ? "post" : S.mode === "sitting" ? "bench" : S.activity;
    },
    // 和他说话：停下来、转过来看着你
    talk() {
      S.talk = 6;
    },
  };
}
