// 咖啡店的小插画（SVG）：热饮杯 + 拉花、冰饮杯 + 冰块吸管、玻璃杯分层拿铁、
// 玻璃茶杯、小熊珍珠奶茶杯，还有四种蛋糕（草莓奶油蛋糕、蛋挞、巴斯克芝士蛋糕、马卡龙）

function art(d) {
  const f = d.foam || "#fff";
  if (d.art === "heart") return `<path d="M60 47 c-6 -7 -16 -3 -12 4 c2 4 12 9 12 9 s10 -5 12 -9 c4 -7 -6 -11 -12 -4z" fill="${f}"/>`;
  if (d.art === "flower")
    return [0, 72, 144, 216, 288].map((a) => `<ellipse cx="60" cy="44" rx="4" ry="8" fill="${f}" transform="rotate(${a} 60 51)"/>`).join("") + `<circle cx="60" cy="51" r="3.5" fill="#f2c94c"/>`;
  if (d.art === "leaf") return `<path d="M48 52 q12 -16 24 -2 q-12 10 -24 2z" fill="${f}"/><path d="M50 52 q10 -4 20 -2" stroke="${d.coffee}" stroke-width="1.2" fill="none"/>`;
  if (d.art === "marsh") return [[52, 49], [63, 47], [69, 53], [57, 55]].map(([x, y]) => `<rect x="${x - 4}" y="${y - 3}" width="8" height="6" rx="2" fill="#fff" stroke="#f1e4e8"/>`).join("");
  return "";
}

const steam = `<g class="fp-steam" stroke="#d9cfc4" stroke-width="2.5" fill="none" stroke-linecap="round">
  <path d="M50 30 q-5 -8 0 -14 q5 -6 0 -12"/><path d="M62 28 q-5 -8 0 -14 q5 -6 0 -12"/><path d="M74 30 q-5 -8 0 -14 q5 -6 0 -12"/></g>`;

const plate = `<ellipse cx="60" cy="96" rx="44" ry="10" fill="#ffffff" stroke="#e6ddd2" stroke-width="2"/><ellipse cx="60" cy="94" rx="32" ry="6" fill="#f6f1ea"/>`;

function cakeSVG(d) {
  if (d.cake === "tart") {
    return `${plate}
      <path d="M26 78 q4 -14 34 -14 q30 0 34 14 l-6 12 q-28 8 -56 0 z" fill="#d9a35a" stroke="#c48a42" stroke-width="2"/>
      ${[30, 40, 50, 60, 70, 80, 90].map((x) => `<path d="M${x - 5} 88 q5 4 10 0" stroke="#c48a42" stroke-width="1.5" fill="none"/>`).join("")}
      <ellipse cx="60" cy="74" rx="28" ry="8" fill="${d.top}"/>
      <ellipse cx="52" cy="72" rx="6" ry="2" fill="#e59a2f" opacity="0.6"/><ellipse cx="68" cy="75" rx="4" ry="1.6" fill="#e59a2f" opacity="0.5"/>`;
  }
  if (d.cake === "macaron") {
    const one = (x, y, c) =>
      `<ellipse cx="${x}" cy="${y + 9}" rx="15" ry="6" fill="${c}"/><rect x="${x - 14}" y="${y + 2}" width="28" height="6" rx="3" fill="#fff8ee"/><ellipse cx="${x}" cy="${y}" rx="15" ry="7" fill="${c}"/><ellipse cx="${x - 4}" cy="${y - 2}" rx="6" ry="2" fill="#ffffff" opacity="0.5"/>`;
    return `${plate}${one(42, 76, "#c8e6c0")}${one(78, 76, "#cdbdf0")}${one(60, 62, d.top)}`;
  }
  // 三角形的一块蛋糕：正面看得见夹层
  const cheese = d.cake === "cheesecake";
  const sponge = cheese ? "#f6e3b8" : "#f9e2a6";
  const layer = cheese ? "" : `<rect x="24" y="72" width="72" height="7" fill="#ffffff"/><g fill="#f05a6e">${[32, 46, 60, 74, 88].map((x) => `<ellipse cx="${x}" cy="75.5" rx="4" ry="3"/>`).join("")}</g>`;
  const top = cheese
    ? `<path d="M24 58 L96 66" stroke="#5e2f12" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M24 58 L96 66" stroke="#f3ece4" stroke-width="5" stroke-linecap="round"/><path d="M54 46 q6 -14 16 -4 q-2 12 -16 4z" fill="${d.top}"/><path d="M58 40 l4 -6 l4 6" stroke="#5c9a4f" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `${plate}
    <path d="M24 92 L24 58 L96 66 L96 92 Z" fill="${sponge}"/>${layer}
    <path d="M24 58 L58 44 L96 66 Z" fill="${cheese ? d.top : "#ffffff"}"/>
    <path d="M96 66 L96 92" stroke="#e7d3a8" stroke-width="2"/>${top}`;
}

export function drinkSVG(d, size = 96) {
  let body;
  if (d.kind === "cake") {
    body = cakeSVG(d);
  } else if (d.cup === "boba") {
    // 珍珠奶茶：透明杯 + 奶茶 + 黑珍珠 + 粗吸管 + 杯子上的小熊
    const pearls = [[50, 100], [60, 102], [70, 100], [55, 94], [66, 95], [48, 92], [74, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#3b2a26"/>`).join("");
    body = `
      <rect x="64" y="6" width="9" height="56" rx="4" fill="#3b2f2f" transform="rotate(10 68 34)"/>
      <path d="M36 30 L84 30 L78 108 Q77 112 72 112 L48 112 Q43 112 42 108 Z" fill="#f4efe9" stroke="#ddd3c7" stroke-width="2"/>
      <path d="M38.5 42 L81.5 42 L78 106 Q77 109 72 109 L48 109 Q43 109 42 106 Z" fill="${d.drink}"/>${pearls}
      <circle cx="60" cy="66" r="13" fill="#f6ead8"/><circle cx="50" cy="56" r="5" fill="#f6ead8"/><circle cx="70" cy="56" r="5" fill="#f6ead8"/>
      <circle cx="55" cy="65" r="1.8" fill="#4a3a33"/><circle cx="65" cy="65" r="1.8" fill="#4a3a33"/><ellipse cx="60" cy="70" rx="3" ry="2" fill="#4a3a33"/>
      <ellipse cx="60" cy="30" rx="25" ry="4" fill="#ffffff" stroke="#ddd3c7" stroke-width="2"/>`;
  } else if (d.cup === "tea") {
    // 玻璃茶杯：琥珀色的茶，飘着几朵小桂花
    const petals = [[52, 55], [63, 57], [70, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#f7c84a"/>`).join("");
    body = `
      <ellipse cx="60" cy="98" rx="36" ry="8" fill="#f2ece4" stroke="#e1d6c8" stroke-width="2"/>
      <path d="M84 58 q15 0 13 13 q-2 11 -15 9" stroke="#e8eef0" stroke-width="6" fill="none"/>
      <path d="M34 46 L86 46 L82 84 Q80 95 69 95 L51 95 Q40 95 38 84 Z" fill="#eef5f6" stroke="#d5e3e6" stroke-width="2"/>
      <path d="M36.5 56 L83.5 56 L81 83 Q79 92 69 92 L51 92 Q41 92 39 83 Z" fill="${d.drink}" opacity="0.88"/>
      <ellipse cx="60" cy="56" rx="23.5" ry="4" fill="#e9b35c"/>${petals}
      ${steam}`;
  } else if (d.cup === "iced") {
    body = `
      <path d="M38 34 L82 34 L76 104 Q75 108 71 108 L49 108 Q45 108 44 104 Z" fill="#eaf4f6" stroke="#cfdfe3" stroke-width="2"/>
      <path d="M40.5 52 L79.5 52 L76 102 Q75 105 71 105 L49 105 Q45 105 44 102 Z" fill="${d.drink}" opacity="0.92"/>
      <rect x="47" y="56" width="13" height="13" rx="3" fill="#ffffff" opacity="0.55" transform="rotate(-12 53 62)"/>
      <rect x="60" y="66" width="13" height="13" rx="3" fill="#ffffff" opacity="0.5" transform="rotate(10 66 72)"/>
      <rect x="50" y="78" width="12" height="12" rx="3" fill="#ffffff" opacity="0.45"/>
      <rect x="69" y="12" width="5" height="62" rx="2.5" fill="#d9604f" transform="rotate(12 71 40)"/>
      ${d.lemon ? `<circle cx="46" cy="44" r="11" fill="#f7e27a" stroke="#f2c94c" stroke-width="2"/><path d="M46 34 v20 M36 44 h20 M39 37 l14 14 M53 37 l-14 14" stroke="#fff4b8" stroke-width="1.5"/>` : ""}
      <rect x="36" y="30" width="48" height="6" rx="3" fill="#f6f9fa" stroke="#cfdfe3" stroke-width="1.5"/>`;
  } else if (d.cup === "glass") {
    body = `
      <path d="M40 36 L80 36 L77 102 Q76 106 72 106 L48 106 Q44 106 43 102 Z" fill="#eef5f6" stroke="#d5e3e6" stroke-width="2"/>
      <path d="M42 66 L78 66 L77 100 Q76 103 72 103 L48 103 Q44 103 43 100 Z" fill="${d.milk}"/>
      <path d="M41.2 44 L78.8 44 L78 66 L42 66 Z" fill="${d.coffee}"/>
      <path d="M41 44 Q60 38 79 44 L78.8 48 Q60 42 41.2 48 Z" fill="#fbf3e6"/>
      ${steam}`;
  } else {
    body = `
      <ellipse cx="60" cy="98" rx="38" ry="9" fill="#f2ece4" stroke="#e1d6c8" stroke-width="2"/>
      <path d="M86 58 q16 0 14 14 q-2 12 -16 10" stroke="#f6f1ea" stroke-width="7" fill="none"/>
      <path d="M32 46 L88 46 L84 84 Q82 96 70 96 L50 96 Q38 96 36 84 Z" fill="#fbf8f3" stroke="#e8dfd3" stroke-width="2"/>
      <ellipse cx="60" cy="49" rx="27" ry="7.5" fill="${d.coffee}"/>
      <ellipse cx="60" cy="49" rx="20" ry="5" fill="${d.foam || "#f3e3cf"}" opacity="0.55"/>
      ${art(d)}
      <path d="M38 74 Q60 80 82 74" stroke="#d9604f" stroke-width="5" fill="none"/>
      ${steam}`;
  }
  return `<svg class="fp-drink" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">${body}</svg>`;
}

// 手上那杯的颜色
export const cupColor = (d) => (d.kind === "cake" ? d.top : d.drink || d.coffee);
