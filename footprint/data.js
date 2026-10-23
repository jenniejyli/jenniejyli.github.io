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

// 刚上岛时 Jennie 说的话
export const INTRO_LINES = [
  "Hi, welcome to my little island! I'm Jennie.",
  "Every building here is a stop on my journey.",
  "Follow the stone path to visit them in order. I'll walk with you!",
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

// 咖啡店的菜单（跟着季节换）：[名字, 一句介绍]
export const CAFE_MENU = {
  always: [["Classic Latte", "Smooth espresso with steamed milk."]],
  spring: [
    ["Sakura Latte", "Cherry blossom and a little pink foam."],
    ["Honey Lemon Tea", "Bright and gentle, like a spring morning."],
  ],
  summer: [
    ["Iced Coconut Latte", "Cold brew over coconut milk and ice."],
    ["Mango Smoothie", "Sunshine in a cup."],
  ],
  autumn: [
    ["Maple Latte", "Warm maple syrup and a hint of cinnamon."],
    ["Hot Apple Cider", "Spiced apples for a crisp afternoon."],
  ],
  winter: [
    ["Hot Chocolate", "Thick, warm and topped with marshmallows."],
    ["Gingerbread Latte", "Cosy spices for a snowy day."],
  ],
};

const ring = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

// 每一站的停靠点（在石板路上）和建筑位置
for (const s of STATIONS) {
  s.stop = ring(s.angle, 13);
  s.pos = ring(s.angle, s.dist);
}

// 石板路：从码头出发，按顺序经过每一站，再回到码头
export const PATH_POINTS = [
  [0, 26.5],
  [-4.5, 18.5],
  ...[125, 150, 175, 197, 220, 245, 270, 294, 318, 341, 365, 390, 415].map((a) => ring(a, 13)),
  [4.5, 18.5],
];
