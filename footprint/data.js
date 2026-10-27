// Footprint 小岛的内容：每一站一条，按时间顺序（也是访客走的顺序）。
// 改文字直接改这里：name 全名，city 城市，period 时间，role 身份，text 介绍，line 走到这里时 Jennie 说的话。
// angle 是这一站在岛上的方位（角度，90 = 码头那一边），dist 是建筑离小岛中心多远，一般不用动。

export const STATIONS = [
  {
    id: "gdufs",
    angle: 125,
    dist: 21,
    short: "GDUFS",
    name: "Guangdong University of Foreign Studies",
    city: "Guangzhou",
    period: "2017 – 2021",
    role: "B.A. in Translation · B.Ec. in International Economics and Trade",
    text: "My undergraduate years: consecutive and simultaneous interpreting, legal and practical translation, plus a second degree in international economics and trade.",
    line: "This is GDUFS! I studied Translation and Economics here from 2017 to 2021.",
  },
  {
    id: "gdrtv",
    angle: 175,
    dist: 20,
    short: "Guangdong Radio & TV",
    name: "Guangdong Radio and Television International Channel",
    city: "Guangzhou",
    period: "Jul – Sep 2018",
    role: "Intern Translator",
    text: "Interpreted for foreign sponsors at meetings and conferences, proofread Chinese and English subtitles, and translated press releases.",
    line: "My first internship, in the summer of 2018: interpreting and subtitles at the International Channel.",
  },
  {
    id: "gac",
    angle: 220,
    dist: 21,
    short: "GAC R&D Center",
    name: "GAC R&D Center",
    city: "Guangzhou",
    period: "Mar – Jul 2021",
    role: "Intern Translator",
    text: "Translated materials on concept cars, vehicle testing laboratories and new technologies such as hydrogen cells, and joined technical meetings with engineers and designers.",
    line: "At the GAC R&D Center I translated everything from concept cars to hydrogen cells.",
  },
  {
    id: "hkust",
    angle: 270,
    dist: 21,
    short: "HKUST",
    name: "The Hong Kong University of Science and Technology",
    city: "Hong Kong",
    period: "2021 – 2022",
    role: "M.A. in International Language Education (TESL)",
    text: "My master's degree, where I developed my interest in language education and psycholinguistics.",
    line: "HKUST, by the sea. This is where I got interested in psycholinguistics.",
  },
  {
    id: "hkustgz",
    angle: 318,
    dist: 19.5,
    short: "HKUST (GZ)",
    name: "The Hong Kong University of Science and Technology (Guangzhou)",
    city: "Guangzhou",
    period: "Aug 2022 – Dec 2023",
    role: "Assistant Officer",
    text: "Supported the curriculum and registration services for the campus community, and generated reports from the student information system.",
    line: "Back to Guangzhou: I worked at HKUST (Guangzhou) as an Assistant Officer.",
  },
  {
    id: "polyu",
    angle: 365,
    dist: 21,
    short: "PolyU",
    name: "The Hong Kong Polytechnic University",
    city: "Hong Kong",
    period: "2024 – present",
    role: "Research Assistant (2024 – 2025) → PhD Candidate (2025 – present)",
    text: "Department of Language Science and Technology. Research on cognitive approaches to interpreting, interpreting training, and neurolinguistics.",
    line: "And here we are: PolyU. Research assistant first, and a PhD candidate since 2025.",
  },
];

// 咖啡师 Calvin 随机说的话（走到他旁边点 "Talk to Calvin"）
export const CALVIN_LINES = [
  "Hi, I'm Calvin, the barista here. Coffee, tea or cake?",
  "Have you tried this season's special? It's my favourite on the menu.",
  "The egg tarts come out of the oven warm. Perfect with a milk tea.",
  "If I'm not at the café, I'm probably out feeding the fish. Just walk over and I'll come back!",
  "The ginger cat and I are best friends. The black cat is still thinking about it.",
  "I water the flowers by the Flower House every day. They're a thirsty bunch.",
  "There's no rush on this island. Take a seat on a bench and enjoy your drink.",
];
// 走到 Calvin 旁边时他会主动打招呼（随机一句）
export const CALVIN_GREETINGS = [
  "Hi there! Welcome to the Island Café. Fancy a drink?",
  "Oh, hello! Come in, come in. Coffee, tea or cake today?",
  "Hey! Good timing, the egg tarts just came out of the oven.",
];
// Calvin 正在做别的事情的时候说的话
export const CALVIN_ACTIVITY_LINES = {
  cat: "Shh, she's almost asleep.",
  fish: "Just a little snack for the fish. Don't tell the cats!",
  flowers: "A little water and they'll bloom all week.",
  bench: "Just taking a short break. The café is still open, walk over anytime!",
};

// 刚上岛时 Jennie 说的话
export const INTRO_LINES = [
  "Hi, welcome to my little island! I'm Jennie.",
  "Every building here is a stop on my journey.",
  "Follow the path to visit them in order. I'll walk with you!",
  "Use the joystick or WASD to walk. When you reach a stop, press E or tap the button.",
];

// 六站都走完以后
export const FINISH_LINE =
  "That's my whole footprint so far. Thanks for walking it with me! Feel free to send flowers or feed the fish before you go.";

// 和 Jennie 聊天时随机说的话
export const CHAT_LINES = [
  "The island follows your clock: come back at night to see the lights!",
  "The seasons change with your calendar too.",
  "Have you tried feeding the fish by the beach?",
  "The café in the middle of the island makes a lovely latte.",
  "Draw a lucky note at the little red stall!",
  "The Flower House shows which places got the most flowers.",
  "The bulletin board near the pier has a few notes for visitors.",
  "There's a wishing well hidden in the little woods. Toss a coin!",
  "Tired? Take a seat on one of the benches.",
];

// 抽签小摊的好运字条：[签的等级, 内容]
export const LUCKY_NOTES = [
  ["Great luck", "Great things are brewing. Keep going!"],
  ["Great luck", "Something you planted will bloom very soon."],
  ["Great luck", "Big luck today: try something bold!"],
  ["Good luck", "Your next experiment will surprise you in a good way."],
  ["Good luck", "A kind word is coming your way today."],
  ["Good luck", "You will find exactly the paper you need."],
  ["Good luck", "Your curiosity will open a new door."],
  ["Good luck", "Good news arrives by the sea."],
  ["Good luck", "Your words will reach further than you think."],
  ["Good luck", "Today is a good day to start something new."],
  ["Small luck", "The data will make sense soon. Be patient."],
  ["Small luck", "Rest is productive too. Take a break."],
  ["Small luck", "Small steps every day add up to a long journey."],
  ["Small luck", "A cup of coffee and a fresh idea make a perfect pair."],
  ["Small luck", "Take a deep breath. You are doing great."],
  ["Blessing", "Every footprint counts, including yours."],
  ["Blessing", "Someone is proud of you today."],
  ["Blessing", "Adventure is closer than it looks."],
];

// 咖啡店的菜单：咖啡、茶、蛋糕三类 + 每个季节一款限定（按北京时间）。
// cup 决定画出来的杯子样子（hot 热饮杯 / iced 冰饮 / glass 玻璃杯 / tea 玻璃茶杯 / boba 珍珠奶茶），蛋糕用 kind: "cake"
export const CAFE_MENU = {
  coffee: [
    { id: "cappuccino", name: "Cappuccino", desc: "Espresso, steamed milk and a cloud of foam.", cup: "hot", coffee: "#8a5a3b", foam: "#f3e3cf", art: "heart" },
    { id: "iced-americano", name: "Iced Americano", desc: "Bold espresso poured over ice.", cup: "iced", drink: "#4a2c1d" },
    { id: "velvet-latte", name: "Velvet Milk Latte", desc: "Smooth and creamy, with a hint of vanilla.", cup: "glass", coffee: "#b98a60", milk: "#f6ead8" },
  ],
  tea: [
    { id: "pearl-milk-tea", name: "Pearl Milk Tea", desc: "Silky milk tea with chewy brown-sugar pearls.", cup: "boba", drink: "#c9a07a" },
    { id: "iced-lemon-tea", name: "Iced Lemon Tea", desc: "A Hong Kong café classic, with plenty of lemon.", cup: "iced", drink: "#d9963a", lemon: true },
    { id: "osmanthus-oolong", name: "Osmanthus Oolong", desc: "Roasted oolong with a sweet osmanthus aroma.", cup: "tea", drink: "#c98a3e" },
    { id: "jasmine-latte", name: "Jasmine Blossom Latte", desc: "Floral jasmine tea with silky milk.", cup: "hot", coffee: "#e3cda6", foam: "#fbf3e4", art: "flower" },
    { id: "matcha-latte", name: "Matcha Latte", desc: "Stone-ground matcha with steamed milk.", cup: "hot", coffee: "#9cbf6a", foam: "#eef4dd", art: "leaf" },
  ],
  cake: [
    { id: "strawberry-shortcake", name: "Strawberry Shortcake", desc: "Fluffy sponge, fresh cream and strawberries.", kind: "cake", cake: "shortcake", top: "#f05a6e" },
    { id: "egg-tart", name: "Egg Tart", desc: "Flaky, buttery and still warm from the oven.", kind: "cake", cake: "tart", top: "#f6c945" },
    { id: "basque-cheesecake", name: "Basque Cheesecake", desc: "Burnt on top, creamy in the middle.", kind: "cake", cake: "cheesecake", top: "#7a4220" },
    { id: "macarons", name: "Macarons", desc: "Three little macarons in pastel colours.", kind: "cake", cake: "macaron", top: "#f6b6c8" },
  ],
  spring: [{ id: "sakura-latte", name: "Sakura Latte", desc: "Spring special: cherry blossom and pink foam.", cup: "hot", coffee: "#f0bfcb", foam: "#fde8ee", art: "flower" }],
  summer: [{ id: "mango-smoothie", name: "Mango Smoothie", desc: "Summer special: sunshine in a cup.", cup: "iced", drink: "#f6b54a" }],
  autumn: [{ id: "maple-latte", name: "Maple Latte", desc: "Autumn special: maple syrup and cinnamon.", cup: "hot", coffee: "#b9824f", foam: "#f0dcc0", art: "leaf" }],
  winter: [{ id: "hot-chocolate", name: "Hot Chocolate", desc: "Winter special: topped with marshmallows.", cup: "hot", coffee: "#6b4030", foam: "#ffffff", art: "marsh" }],
};

const ring = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

// 每一站的停靠点（在小路上）和建筑位置
for (const s of STATIONS) {
  s.stop = ring(s.angle, 13);
  s.pos = ring(s.angle, s.dist);
}

// 环岛小路：从码头出发，按顺序经过每一站，再回到码头
export const PATH_POINTS = [
  [0, 26.5],
  [-4.5, 18.5],
  ...[125, 150, 175, 197, 220, 245, 270, 294, 318, 341, 365, 390, 415].map((a) => ring(a, 13)),
  [4.5, 18.5],
];
