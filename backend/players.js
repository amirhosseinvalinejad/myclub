const crypto = require("crypto");

const POSITIONS = ["GK", "CB", "CM", "ST"];
const SLOT_COUNTS = { GK: 1, CB: 4, CM: 4, ST: 2 };
const MAX_SUBS = 7;

const FIRST_NAMES = [
  "Luca", "Omar", "Mateo", "Jonas", "Rafa", "Kenji", "Amir", "Noah", "Diego", "Leo",
  "Sami", "Ibrahim", "Hugo", "Felix", "Andre", "Yusuf", "Pavel", "Theo", "Nico", "Kai",
  "Elena", "Mira", "Sofia", "Aya", "Lina",
];
const LAST_NAMES = [
  "Voss", "Silva", "Okoye", "Berg", "Costa", "Nakamura", "Rahimi", "Dubois", "Keller", "Santos",
  "Hassan", "Petrov", "Moreau", "Walsh", "Ibrahimovic", "Tanaka", "Alvarez", "Nkosi", "Rossi", "Chen",
];
const NATIONS = [
  "England", "Spain", "Brazil", "France", "Germany", "Portugal", "Italy", "Netherlands",
  "Argentina", "Japan", "Nigeria", "United States", "Iran", "Morocco", "Belgium", "Croatia",
];

function rand(max) {
  return Math.floor(Math.random() * max);
}

function pick(list) {
  return list[rand(list.length)];
}

function id() {
  return crypto.randomBytes(4).toString("hex");
}

function makePlayer(position, youth) {
  const age = youth ? 16 + rand(4) : 20 + rand(14);
  const rating = youth ? 48 + rand(16) : 60 + rand(26);
  const potential = Math.min(94, rating + 6 + rand(youth ? 18 : 10));
  const value = Math.max(8, Math.round(rating * (youth ? 0.28 : 0.45) + rand(12)));
  const salary = Math.max(2, Math.round(rating * 0.12));
  const gk = position === "GK";
  const base = {
    id: id(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    position,
    age,
    rating,
    potential,
    value,
    salary,
    nationality: pick(NATIONS),
    pace: gk ? 38 + rand(20) : 55 + rand(40),
    passing: gk ? 40 + rand(25) : 52 + rand(40),
    shooting: gk ? 20 + rand(20) : position === "ST" ? 62 + rand(32) : 45 + rand(35),
    defending: gk ? 18 + rand(18) : position === "CB" ? 64 + rand(30) : 40 + rand(35),
    handling: gk ? 60 + rand(32) : 20 + rand(15),
    stamina: 55 + rand(40),
    youth: Boolean(youth),
  };
  return ensurePlayerStatus(base);
}

function clampStat(value) {
  return Math.max(1, Math.min(99, Math.round(Number(value) || 0)));
}

function ensurePlayerStatus(player) {
  const next = { ...player };
  if (typeof next.fitness !== "number") {
    next.fitness = 68 + rand(28);
  }
  if (typeof next.condition !== "number") {
    next.condition = 70 + rand(25);
  }
  if (typeof next.morale !== "number") {
    next.morale = 58 + rand(32);
  }
  if (typeof next.form !== "number") {
    next.form = 48 + rand(40);
  }
  if (typeof next.progress !== "number") {
    next.progress = rand(55);
  }
  if (typeof next.sharpness !== "number") {
    next.sharpness = 50 + rand(35);
  }
  next.fitness = clampStat(next.fitness);
  next.condition = clampStat(next.condition);
  next.morale = clampStat(next.morale);
  next.form = clampStat(next.form);
  next.progress = clampStat(next.progress);
  next.sharpness = clampStat(next.sharpness);
  return next;
}

function avgStat(players, key) {
  if (!players.length) {
    return 0;
  }
  return Math.round(players.reduce((sum, player) => sum + (player[key] || 0), 0) / players.length);
}

function applyFirstTeamSession(players, focus, playerId) {
  const targets = playerId ? players.filter((player) => player.id === playerId) : players;
  const extra = playerId ? 8 : 4;
  for (const player of targets) {
    player.progress = clampStat(player.progress + extra + rand(6));
    player.condition = clampStat(player.condition + 2 + rand(3));
    if (focus === "fitness") {
      player.fitness = clampStat(player.fitness + 7 + rand(4));
    } else if (focus === "attacking") {
      player.form = clampStat(player.form + 4);
      player.shooting = Math.min(99, (player.shooting || 50) + 1);
    } else if (focus === "defending") {
      player.defending = Math.min(99, (player.defending || 50) + 1);
      player.condition = clampStat(player.condition + 3);
    } else if (focus === "tactics") {
      player.sharpness = clampStat(player.sharpness + 6);
      player.passing = Math.min(99, (player.passing || 50) + 1);
    } else {
      player.fitness = clampStat(player.fitness + 3);
      player.morale = clampStat(player.morale + 3);
      player.sharpness = clampStat(player.sharpness + 2);
    }
  }
}

function applyAcademySession(youth, focus) {
  for (const player of youth) {
    player.progress = clampStat(player.progress + 6 + rand(8));
    player.morale = clampStat(player.morale + 2);
    if (focus === "fitness") {
      player.fitness = clampStat(player.fitness + 6);
    } else if (focus === "technical") {
      player.passing = Math.min(99, (player.passing || 48) + 1);
      player.pace = Math.min(99, (player.pace || 48) + 1);
    } else if (focus === "tactical") {
      player.sharpness = clampStat(player.sharpness + 5);
    } else {
      player.rating = Math.min(player.potential || 90, player.rating + (rand(3) === 0 ? 1 : 0));
      player.condition = clampStat(player.condition + 3);
    }
  }
}

function applyMatchWear(club, result) {
  const starters = new Set(starterIds(club.lineup));
  for (const player of club.players || []) {
    const starter = starters.has(player.id);
    const wear = starter ? 9 + rand(8) : 2 + rand(4);
    player.fitness = clampStat(player.fitness - wear);
    player.condition = clampStat(player.condition - wear + 1);
    if (result === "win") {
      player.morale = clampStat(player.morale + (starter ? 6 : 2));
      player.form = clampStat(player.form + (starter ? 5 : 2));
    } else if (result === "loss") {
      player.morale = clampStat(player.morale - (starter ? 5 : 1));
      player.form = clampStat(player.form - (starter ? 4 : 1));
    } else {
      player.form = clampStat(player.form + 1);
    }
  }
}

function generateMarket() {
  const mix = { GK: 3, CB: 6, CM: 6, ST: 5 };
  const list = [];
  for (const pos of POSITIONS) {
    for (let i = 0; i < mix[pos]; i += 1) {
      list.push(makePlayer(pos, false));
    }
  }
  return list;
}

function generateYouth(count) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push(makePlayer(POSITIONS[rand(POSITIONS.length)], true));
  }
  return list;
}

function emptyLineup() {
  return { GK: [null], CB: [null, null, null, null], CM: [null, null, null, null], ST: [null, null], SUB: [] };
}

function starterIds(lineup) {
  const lu = lineup || emptyLineup();
  return [...lu.GK, ...lu.CB, ...lu.CM, ...lu.ST].filter(Boolean);
}

function defaultAcademy() {
  return {
    level: 1,
    facilities: 1,
    coaches: 1,
    youth: generateYouth(3),
  };
}

module.exports = {
  POSITIONS,
  SLOT_COUNTS,
  MAX_SUBS,
  makePlayer,
  generateMarket,
  generateYouth,
  emptyLineup,
  starterIds,
  defaultAcademy,
  ensurePlayerStatus,
  avgStat,
  applyFirstTeamSession,
  applyAcademySession,
  applyMatchWear,
};
