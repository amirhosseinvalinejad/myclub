const crypto = require("crypto");

const STAFF_ROSTER = [
  { id: "scout", role: "Chief scout", cost: 80, bonus: "Finds extra youth at intake." },
  { id: "physio", role: "Physio", cost: 60, bonus: "Keeps first-team ratings from dropping." },
  { id: "analyst", role: "Match analyst", cost: 70, bonus: "Slight edge on cup and league days." },
];

const STORE_ITEMS = [
  { id: "kit", name: "Home kit drop", cost: 45, blurb: "A new strip. +40 fans." },
  { id: "lights", name: "Floodlight rig", cost: 90, blurb: "Night matches. Stadium condition +8." },
  { id: "network", name: "Scout network", cost: 55, blurb: "One extra academy prospect." },
  { id: "sponsor", name: "Sleeve sponsor", cost: 35, blurb: "Immediate board cash. +$70." },
];

const CUP_ROUNDS = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final", "Champions"];

function stadiumCapacityForLevel(level) {
  const n = Math.max(1, Math.min(10, Math.round(Number(level) || 1)));
  if (n === 1) {
    return 0;
  }
  if (n === 10) {
    return 100000;
  }
  return (n - 1) * 10000;
}

function defaultStadium() {
  return {
    name: "Home Park",
    level: 1,
    capacity: stadiumCapacityForLevel(1),
    ticketPrice: 10,
    condition: 74,
    services: { hospitality: 1, catering: 1, medical: 1, media: 1, security: 1 },
  };
}

const STADIUM_SERVICES = [
  { id: "hospitality", name: "Away hospitality", blurb: "Tickets, welcome, and a base for travelling supporters." },
  { id: "catering", name: "Away catering", blurb: "Food and drink for the away end so fans stay with the team." },
  { id: "medical", name: "Away medical", blurb: "Care for supporters on the road, not only the squad." },
  { id: "media", name: "Away coverage", blurb: "Travel updates and match reports that rally the away following." },
  { id: "security", name: "Away stewards", blurb: "Safe travel and a louder, better organised away section." },
];

function awaySupportBonus(club) {
  const services = club.stadium?.services || {};
  const levels = Object.values(services);
  if (!levels.length) {
    return 0;
  }
  const avg = levels.reduce((sum, value) => sum + Number(value || 1), 0) / levels.length;
  return Math.max(0, Math.round(avg));
}

function defaultStaff(managerName) {
  return {
    managerName: managerName || null,
    hires: [],
  };
}

function defaultCup() {
  return {
    name: "Regional Cup",
    round: CUP_ROUNDS[0],
    wins: 0,
    losses: 0,
  };
}

function welcomeInbox() {
  return [
    {
      id: crypto.randomBytes(4).toString("hex"),
      from: "The Board",
      subject: "Keys to the office",
      body: "Welcome. Build the club, fill the stands, and keep the academy moving. Check PM for board notes.",
      at: new Date().toISOString(),
      read: false,
    },
  ];
}

function defaultKit(kind) {
  const presets = {
    home: { primary: "#c8102e", secondary: "#ffffff", trim: "#9c824a", pattern: "stripes", number: "10", style: "classic" },
    away: { primary: "#ffffff", secondary: "#c8102e", trim: "#1b261f", pattern: "solid", number: "7", style: "modern" },
    gkHome: { primary: "#e8c45a", secondary: "#1b261f", trim: "#ffffff", pattern: "solid", number: "1", style: "classic" },
    gkAway: { primary: "#2f6d3d", secondary: "#111111", trim: "#e8c45a", pattern: "halves", number: "1", style: "modern" },
  };
  return { ...presets[kind] };
}

function defaultIdentity() {
  return {
    crest: { primary: "#c8102e", secondary: "#ffffff", accent: "#9c824a", motif: "cannon" },
    kits: {
      home: defaultKit("home"),
      away: defaultKit("away"),
      gkHome: defaultKit("gkHome"),
      gkAway: defaultKit("gkAway"),
    },
  };
}

function pushLedger(club, type, label, amount) {
  club.ledger = Array.isArray(club.ledger) ? club.ledger : [];
  club.ledger.unshift({
    at: new Date().toISOString(),
    type,
    label,
    amount,
  });
  club.ledger = club.ledger.slice(0, 40);
}

function pushInbox(club, from, subject, body) {
  club.inbox = club.inbox || [];
  club.inbox.unshift({
    id: crypto.randomBytes(4).toString("hex"),
    from,
    subject,
    body,
    at: new Date().toISOString(),
    read: false,
  });
  club.inbox = club.inbox.slice(0, 24);
}

function hasHire(club, id) {
  return (club.staff?.hires || []).some((hire) => hire.id === id);
}

function gateReceipt(club) {
  const stadium = club.stadium || defaultStadium();
  const crowd = Math.min(stadium.capacity, Math.max(200, club.fans * 12));
  return Math.max(8, Math.round((crowd * stadium.ticketPrice) / 900));
}

function nextCupRound(round) {
  const index = CUP_ROUNDS.indexOf(round);
  if (index === -1 || index >= CUP_ROUNDS.length - 1) {
    return CUP_ROUNDS[CUP_ROUNDS.length - 1];
  }
  return CUP_ROUNDS[index + 1];
}

const LEAGUE_RIVALS = [
  { name: "Harbor City FC", short: "HCF" },
  { name: "Riverbank United", short: "RBU" },
  { name: "Elmwood Rovers", short: "ELM" },
  { name: "Crown Hill Town", short: "CHT" },
  { name: "Westbridge Wanderers", short: "WBW" },
  { name: "Northgate Athletic", short: "NGA" },
  { name: "Millfield Athletic", short: "MIL" },
  { name: "Southbank FC", short: "SFC" },
  { name: "Kingsmead United", short: "KMU" },
];

function hashSeed(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function ensureLeague(club) {
  const name = club.name || "Your Club";
  const short = club.shortName || "FC";
  const played = club.matches || 0;
  const user = {
    id: "user",
    name,
    short,
    played,
    won: club.wins || 0,
    drawn: club.draws || 0,
    lost: club.losses || 0,
    isUser: true,
  };
  user.gf = user.won * 2 + user.drawn;
  user.ga = user.lost * 2 + user.drawn;
  user.gd = user.gf - user.ga;
  user.pts = user.won * 3 + user.drawn;

  const rivals = LEAGUE_RIVALS.filter((row) => row.name !== name && row.short !== short).slice(0, 9);
  const table = rivals.map((row, index) => {
    const seed = hashSeed(`${row.short}-${played}-${index}`);
    const games = played;
    const won = games ? seed % (games + 1) : 0;
    const remain = Math.max(0, games - won);
    const drawn = remain ? (seed >> 4) % (remain + 1) : 0;
    const lost = Math.max(0, games - won - drawn);
    const gf = won * 2 + drawn + ((seed >> 8) % 3);
    const ga = lost * 2 + drawn + ((seed >> 12) % 3);
    return {
      id: row.short,
      name: row.name,
      short: row.short,
      played: games,
      won,
      drawn,
      lost,
      gf,
      ga,
      gd: gf - ga,
      pts: won * 3 + drawn,
      isUser: false,
    };
  });
  table.push(user);
  table.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  table.forEach((row, index) => {
    row.pos = index + 1;
  });

  const opponent = rivals[played % Math.max(rivals.length, 1)] || rivals[0];
  const home = played % 2 === 0;
  const kickoff = new Date();
  const day = kickoff.getDay();
  const add = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  kickoff.setDate(kickoff.getDate() + add);
  kickoff.setHours(15, 0, 0, 0);

  return {
    name: "National League",
    season: new Date().getFullYear(),
    table,
    nextMatch: opponent
      ? {
          opponent: opponent.name,
          opponentShort: opponent.short,
          home,
          venue: home ? club.stadium?.name || "Home Park" : `${opponent.name} Ground`,
          competition: "National League",
          kickoff: kickoff.toISOString(),
          kit: home ? "home" : "away",
        }
      : null,
  };
}

module.exports = {
  STAFF_ROSTER,
  STORE_ITEMS,
  CUP_ROUNDS,
  defaultStadium,
  stadiumCapacityForLevel,
  STADIUM_SERVICES,
  awaySupportBonus,
  defaultStaff,
  defaultCup,
  welcomeInbox,
  pushInbox,
  pushLedger,
  defaultIdentity,
  defaultKit,
  hasHire,
  gateReceipt,
  nextCupRound,
  ensureLeague,
};
