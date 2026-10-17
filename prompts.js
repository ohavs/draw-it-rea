/**
 * Curated bilingual (Hebrew + English) drawing prompts with difficulty & category tags.
 */
const PROMPTS = [
  // חיות (Animals)
  { he: "חתול חלל עם קסדה", en: "Space Cat with Helmet", category: "חיות 🐾", icon: "🐱" },
  { he: "פינגווין גולש על גלשן", en: "Surfing Penguin", category: "חיות 🐾", icon: "🐧" },
  { he: "תמנון מנגן בתופים", en: "Octopus Playing Drums", category: "חיות 🐾", icon: "🐙" },
  { he: "דרקון יורק מרשמלו", en: "Marshmallow Dragon", category: "פנטזיה ✨", icon: "🐉" },
  { he: "כלב רוכב על סקייטבורד", en: "Skateboarding Dog", category: "חיות 🐾", icon: "🐶" },
  { he: "ג'ירפה עם צעיף ארוך", en: "Giraffe with Long Scarf", category: "חיות 🐾", icon: "🦒" },
  { he: "כריש עם משקפי שמש", en: "Shark with Sunglasses", category: "חיות 🐾", icon: "🦈" },
  { he: "חד-קרן אוכל גלידה", en: "Unicorn Eating Ice Cream", category: "פנטזיה ✨", icon: "🦄" },

  // אוכל ומשקאות (Food)
  { he: "פיצה מעופפת עם כנפיים", en: "Flying Pizza with Wings", category: "אוכל 🍕", icon: "🍕" },
  { he: "המבורגר מפלצתי ענק", en: "Monster Burger", category: "אוכל 🍕", icon: "🍔" },
  { he: "אננס בחופשה בים", en: "Pineapple on Beach Vacation", category: "אוכל 🍕", icon: "🍍" },
  { he: "רובוט שמכין פנקייקים", en: "Pancake Chef Robot", category: "טכנולוגיה 🤖", icon: "🥞" },
  { he: "אבוקדו מרים משקולות", en: "Weightlifting Avocado", category: "אוכל 🍕", icon: "🥑" },
  { he: "סושי רוקד על במה", en: "Dancing Sushi", category: "אוכל 🍕", icon: "🍣" },

  // חפצים ומקומות (Objects & Places)
  { he: "טירה מרחפת על ענן", en: "Castle Floating on a Cloud", category: "פנטזיה ✨", icon: "🏰" },
  { he: "חללית חוטפת פרה", en: "UFO Abducting a Cow", category: "חלל 🚀", icon: "🛸" },
  { he: "אי בודד עם תיבת אוצר", en: "Treasure Island", category: "הרפתקאות 🗺️", icon: "🏝️" },
  { he: "מכונת זמן משוגעת", en: "Crazy Time Machine", category: "טכנולוגיה 🤖", icon: "⏳" },
  { he: "שעון מעורר עצבני", en: "Angry Alarm Clock", category: "חפצים 💡", icon: "⏰" },
  { he: "קקטוס שמחבק בלון", en: "Cactus Hugging a Balloon", category: "מצחיק 😂", icon: "🌵" },
  { he: "איש שלג בחוף הים", en: "Snowman at the Beach", category: "מצחיק 😂", icon: "⛄" },
  { he: "קוסם שולף ארנב מכובע", en: "Magician Pulling a Rabbit", category: "פנטזיה ✨", icon: "🎩" },
  { he: "פיראט מחפש Wi-Fi", en: "Pirate Looking for Wi-Fi", category: "מצחיק 😂", icon: "🏴‍☠️" },
  { he: "דינוזאור מצלם סלפי", en: "Dinosaur Taking a Selfie", category: "מצחיק 😂", icon: "🦖" }
];

function getRandomPrompt(excludeList = []) {
  const excludeSet = new Set(excludeList);
  const available = PROMPTS.filter((p) => !excludeSet.has(p.he));
  const pool = available.length > 0 ? available : PROMPTS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

function getPromptChoices(count = 3, excludeList = []) {
  const excludeSet = new Set(excludeList);
  const available = PROMPTS.filter((p) => !excludeSet.has(p.he));
  const pool = [...(available.length >= count ? available : PROMPTS)];
  const choices = [];
  while (choices.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(idx, 1)[0]);
  }
  return choices;
}

module.exports = { PROMPTS, getRandomPrompt, getPromptChoices };
