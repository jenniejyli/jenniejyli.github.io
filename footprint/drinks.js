// 咖啡店饮料的小插画（SVG）：热饮杯 + 拉花、冰饮杯 + 冰块吸管、玻璃杯分层拿铁

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

export function drinkSVG(d, size = 96) {
  let body;
  if (d.cup === "iced") {
    body = `
      <path d="M38 34 L82 34 L76 104 Q75 108 71 108 L49 108 Q45 108 44 104 Z" fill="#eaf4f6" stroke="#cfdfe3" stroke-width="2"/>
      <path d="M40.5 52 L79.5 52 L76 102 Q75 105 71 105 L49 105 Q45 105 44 102 Z" fill="${d.drink}" opacity="0.92"/>
      <rect x="47" y="56" width="13" height="13" rx="3" fill="#ffffff" opacity="0.55" transform="rotate(-12 53 62)"/>
      <rect x="60" y="66" width="13" height="13" rx="3" fill="#ffffff" opacity="0.5" transform="rotate(10 66 72)"/>
      <rect x="50" y="78" width="12" height="12" rx="3" fill="#ffffff" opacity="0.45"/>
      <rect x="69" y="12" width="5" height="62" rx="2.5" fill="#d9604f" transform="rotate(12 71 40)"/>
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
export const cupColor = (d) => (d.cup === "iced" ? d.drink : d.coffee);
