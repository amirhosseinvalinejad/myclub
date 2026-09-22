const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  SLOT_COUNTS,
  MAX_SUBS,
  generateMarket,
  generateYouth,
  emptyLineup,
  starterIds,
  defaultAcademy,
  ensurePlayerStatus,
  applyFirstTeamSession,
  applyAcademySession,
  applyMatchWear,
} = require("./players");
const { sendPasswordResetEmail } = require("./mail");
const {
  STAFF_ROSTER,
  STORE_ITEMS,
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
  hasHire,
  gateReceipt,
  nextCupRound,
  ensureLeague,
} = require("./office");

const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const DATA_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "myclub") : __dirname;
if (process.env.VERCEL) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DATA_FILE = path.join(DATA_DIR, "club.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

app.use(express.json());
app.use(express.static(FRONTEND_DIR));
app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

const sessions = new Map();
const captchaChallenges = new Map();
const captchaTokens = new Map();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
const CAPTCHA_TTL_MS = 10 * 60 * 1000;

const CAPTCHA_TARGET = { kind: "ball", emoji: "⚽", bg: "#1b7a3a" };
const CAPTCHA_DECOYS = [
  { kind: "basket", emoji: "🏀", bg: "#c45c12" },
  { kind: "tennis", emoji: "🎾", bg: "#7aa31a" },
  { kind: "football", emoji: "🏈", bg: "#6b3a12" },
  { kind: "volley", emoji: "🏐", bg: "#2f6f9a" },
  { kind: "eight", emoji: "🎱", bg: "#2a2a2a" },
  { kind: "rugby", emoji: "🏉", bg: "#8a4b12" },
  { kind: "target", emoji: "🎯", bg: "#8b1e1e" },
  { kind: "dice", emoji: "🎲", bg: "#3d4f7a" },
];

function tileImage(tile) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="8" fill="${tile.bg}"/><text x="48" y="62" text-anchor="middle" font-size="44">${tile.emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makeCaptchaChallenge() {
  const targetCount = 3 + Math.floor(Math.random() * 3);
  const tiles = [];
  for (let i = 0; i < 9; i += 1) {
    tiles.push(i < targetCount ? { ...CAPTCHA_TARGET } : CAPTCHA_DECOYS[i % CAPTCHA_DECOYS.length]);
  }
  const mixed = shuffle(tiles).map((tile, index) => ({
    id: String(index),
    kind: tile.kind,
    image: tileImage(tile),
  }));
  return mixed;
}

function pruneMap(map, ttl) {
  const now = Date.now();
  for (const [key, value] of map) {
    const createdAt = typeof value === "number" ? value : value.createdAt;
    if (now - createdAt > ttl) {
      map.delete(key);
    }
  }
}

function userEmail(user) {
  return String(user.email || user.username || "").trim().toLowerCase();
}

const PRIZE_DEFS = [
  { id: "first-win", title: "First Victory", test: (club) => club.wins >= 1 },
  { id: "local-cup", title: "Local Cup", test: (club) => club.wins >= 3 },
  { id: "city-shield", title: "City Shield", test: (club) => club.wins >= 5 },
  { id: "league-trophy", title: "League Trophy", test: (club) => club.wins >= 8 },
  { id: "crowd-roar", title: "Crowd Roar", test: (club) => club.fans >= 250 },
  { id: "training-badge", title: "Training Ground Badge", test: (club) => club.skill >= 35 },
  { id: "champions-cup", title: "Champions Cup", test: (club) => club.wins >= 12 && club.skill >= 50 },
];

function defaultClub() {
  return {
    name: null,
    shortName: null,
    managerName: null,
    funds: 100,
    skill: 10,
    fans: 50,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    prizes: [],
    players: [],
    market: [],
    lineup: emptyLineup(),
    academy: defaultAcademy(),
    stadium: defaultStadium(),
    staff: defaultStaff(null),
    cup: defaultCup(),
    inbox: welcomeInbox(),
    storeOwned: [],
    identity: defaultIdentity(),
    ledger: [],
    training: { firstFocus: "general", academyFocus: "development" },
  };
}

function ensureClub(club) {
  const next = { ...defaultClub(), ...club };
  if (!Array.isArray(next.players)) {
    next.players = [];
  }
  if (!Array.isArray(next.market) || next.market.length === 0) {
    next.market = generateMarket();
  }
  if (!next.lineup) {
    next.lineup = emptyLineup();
  }
  next.academy = { ...defaultAcademy(), ...(next.academy || {}) };
  if (!Array.isArray(next.academy.youth)) {
    next.academy.youth = generateYouth(3);
  }
  next.stadium = { ...defaultStadium(), ...(next.stadium || {}) };
  next.stadium.services = { ...defaultStadium().services, ...(next.stadium.services || {}) };
  next.stadium.level = Math.max(1, Math.min(10, next.stadium.level || 1));
  next.stadium.capacity = stadiumCapacityForLevel(next.stadium.level);
  next.staff = { ...defaultStaff(next.managerName), ...(next.staff || {}) };
  if (!Array.isArray(next.staff.hires)) {
    next.staff.hires = [];
  }
  next.cup = { ...defaultCup(), ...(next.cup || {}) };
  if (!Array.isArray(next.inbox) || next.inbox.length === 0) {
    next.inbox = welcomeInbox();
  }
  if (!Array.isArray(next.storeOwned)) {
    next.storeOwned = [];
  }
  next.identity = {
    ...defaultIdentity(),
    ...(next.identity || {}),
    crest: { ...defaultIdentity().crest, ...((next.identity && next.identity.crest) || {}) },
    kits: { ...defaultIdentity().kits, ...((next.identity && next.identity.kits) || {}) },
  };
  for (const key of ["home", "away", "gkHome", "gkAway"]) {
    next.identity.kits[key] = { ...defaultIdentity().kits[key], ...(next.identity.kits[key] || {}) };
  }
  if (!Array.isArray(next.ledger)) {
    next.ledger = [];
  }
  next.training = { firstFocus: "general", academyFocus: "development", ...(next.training || {}) };
  next.players = next.players.map(ensurePlayerStatus);
  next.academy.youth = next.academy.youth.map(ensurePlayerStatus);
  next.league = ensureLeague(next);
  return next;
}

function readClub() {
  try {
    return { ...defaultClub(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
  } catch {
    return defaultClub();
  }
}

function getClub() {
  return ensureClub(readClub());
}

function writeClub(club) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(club, null, 2));
  } catch (error) {
    console.error("Could not write club data:", error.message);
  }
}

function awardPrizes(club) {
  const held = new Set(club.prizes.map((prize) => prize.id));
  const won = [];
  for (const def of PRIZE_DEFS) {
    if (!held.has(def.id) && def.test(club)) {
      const prize = { id: def.id, title: def.title, wonAt: new Date().toISOString() };
      club.prizes.push(prize);
      won.push(prize);
    }
  }
  return won;
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      continue;
    }
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("Could not write users:", error.message);
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
  );
}

function currentUser(req) {
  const sessionId = parseCookies(req).session;
  if (!sessionId) {
    return null;
  }
  return sessions.get(sessionId) || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Please log in." });
  }
  req.user = user;
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "club" });
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Please log in." });
  }
  res.json({ email: user.email || user.username, username: user.username });
});

app.get("/api/captcha", (_req, res) => {
  pruneMap(captchaChallenges, CAPTCHA_TTL_MS);
  const captchaId = crypto.randomBytes(16).toString("hex");
  const tiles = makeCaptchaChallenge();
  captchaChallenges.set(captchaId, {
    createdAt: Date.now(),
    answers: tiles.filter((tile) => tile.kind === "ball").map((tile) => tile.id).sort(),
    tries: 0,
  });
  res.json({
    captchaId,
    prompt: "Select every square with a soccer ball",
    tiles: tiles.map((tile) => ({ id: tile.id, image: tile.image })),
  });
});

app.post("/api/captcha/verify", (req, res) => {
  const captchaId = typeof req.body.captchaId === "string" ? req.body.captchaId : "";
  const selected = Array.isArray(req.body.selected) ? req.body.selected.map(String).sort() : null;
  const challenge = captchaChallenges.get(captchaId);
  if (!challenge) {
    return res.status(400).json({ error: "Captcha expired. Try again." });
  }
  if (Date.now() - challenge.createdAt > CAPTCHA_TTL_MS) {
    captchaChallenges.delete(captchaId);
    return res.status(400).json({ error: "Captcha expired. Try again." });
  }
  if (!selected) {
    return res.status(400).json({ error: "Captcha failed. Confirm you are not a robot." });
  }

  const expected = challenge.answers.join(",");
  const given = selected.join(",");
  if (expected !== given) {
    challenge.tries += 1;
    if (challenge.tries >= 3) {
      captchaChallenges.delete(captchaId);
      return res.status(400).json({ error: "Captcha failed. Confirm you are not a robot." });
    }
    return res.status(400).json({ error: "Captcha failed. Confirm you are not a robot." });
  }

  captchaChallenges.delete(captchaId);
  pruneMap(captchaTokens, CAPTCHA_TTL_MS);
  const captchaToken = crypto.randomBytes(16).toString("hex");
  captchaTokens.set(captchaToken, Date.now());
  res.json({ captchaToken, ok: true });
});

function consumeCaptchaToken(token) {
  if (!token || !captchaTokens.has(token)) {
    return false;
  }
  const createdAt = captchaTokens.get(token);
  captchaTokens.delete(token);
  return Date.now() - createdAt <= CAPTCHA_TTL_MS;
}

app.post("/api/signup", (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const website = typeof req.body.website === "string" ? req.body.website.trim() : "";
  const captchaToken = typeof req.body.captchaToken === "string" ? req.body.captchaToken : "";

  if (website) {
    return res.status(400).json({ error: "Registration failed." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!PASSWORD_RE.test(password)) {
    return res.status(400).json({
      error: "Password must be at least 8 characters and include a letter, a number, and a special character.",
    });
  }
  if (!consumeCaptchaToken(captchaToken)) {
    return res.status(400).json({ error: "Confirm you are not a robot." });
  }

  const users = readUsers();
  if (users.some((user) => userEmail(user) === email)) {
    return res.status(400).json({ error: "That email is already registered." });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: crypto.randomBytes(8).toString("hex"),
    email,
    username: email,
    salt,
    hash: hashPassword(password, salt),
  };
  users.push(user);
  writeUsers(users);

  const sessionId = crypto.randomBytes(16).toString("hex");
  sessions.set(sessionId, { id: user.id, email: user.email, username: user.email });
  setSessionCookie(res, sessionId);
  res.status(201).json({ email: user.email });
});

app.post("/api/login", (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const username = typeof req.body.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const loginId = email || username;
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const users = readUsers();
  const user = users.find((item) => userEmail(item) === loginId);
  if (!user) {
    return res.status(400).json({ error: "Incorrect email or password." });
  }

  const hash = hashPassword(password, user.salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(user.hash, "hex");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return res.status(400).json({ error: "Incorrect email or password." });
  }

  const sessionId = crypto.randomBytes(16).toString("hex");
  const display = user.email || user.username;
  sessions.set(sessionId, { id: user.id, email: display, username: display });
  setSessionCookie(res, sessionId);
  res.json({ email: display });
});

function publicOrigin(req) {
  const host = req.get("host") || `localhost:${PORT}`;
  const proto = req.protocol || "http";
  return `${proto}://${host}`;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

app.post("/api/forgot-password", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const users = readUsers();
  const user = users.find((item) => userEmail(item) === email);
  const okMessage = "If that email is registered, we sent a link to set a new password.";
  if (!user) {
    return res.json({ ok: true, message: okMessage });
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.resetTokenHash = hashToken(token);
  user.resetTokenExpires = Date.now() + 60 * 60 * 1000;
  writeUsers(users);

  const resetUrl = `${publicOrigin(req)}/reset.html?token=${token}`;
  try {
    const sent = await sendPasswordResetEmail({ to: userEmail(user), resetUrl });
    res.json({ ok: true, message: okMessage, previewUrl: sent.previewUrl || undefined });
  } catch (error) {
    console.error("Reset email failed:", error.message);
    res.status(500).json({ error: "Could not send the reset email. Try again in a moment." });
  }
});

app.post("/api/reset-password", (req, res) => {
  const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!token) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }
  if (!PASSWORD_RE.test(password)) {
    return res.status(400).json({
      error: "Password must be at least 8 characters and include a letter, a number, and a special character.",
    });
  }

  const tokenHash = hashToken(token);
  const users = readUsers();
  const user = users.find(
    (item) => item.resetTokenHash === tokenHash && item.resetTokenExpires > Date.now()
  );
  if (!user) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  user.salt = crypto.randomBytes(16).toString("hex");
  user.hash = hashPassword(password, user.salt);
  delete user.resetTokenHash;
  delete user.resetTokenExpires;
  writeUsers(users);
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  const sessionId = parseCookies(req).session;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.setHeader("Set-Cookie", "session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/club", requireAuth, (_req, res) => {
  const club = getClub();
  writeClub(club);
  res.json(club);
});

app.post("/api/club", requireAuth, (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const shortName = typeof req.body.shortName === "string" ? req.body.shortName.trim().toUpperCase() : "";
  const managerName = typeof req.body.managerName === "string" ? req.body.managerName.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "Club name is required." });
  }
  if (name.length < 3 || name.length > 40) {
    return res.status(400).json({ error: "Club name must be 3 to 40 characters." });
  }
  if (!managerName) {
    return res.status(400).json({ error: "Manager name is required." });
  }
  if (managerName.length < 2 || managerName.length > 40) {
    return res.status(400).json({ error: "Manager name must be 2 to 40 characters." });
  }

  const club = getClub();
  const firstTime = !club.managerName;
  if (!club.name) {
    Object.assign(club, defaultClub());
  }
  club.name = name;
  club.shortName = (shortName || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3) || "FC").toUpperCase().slice(0, 4);
  club.managerName = managerName;
  club.staff = club.staff || defaultStaff(managerName);
  club.staff.managerName = managerName;
  if (firstTime) {
    club.funds = Math.max(club.funds, 450);
    if (!club.market.length) {
      club.market = generateMarket();
    }
    if (!club.academy || !club.academy.youth.length) {
      club.academy = defaultAcademy();
    }
  }
  writeClub(ensureClub(club));
  res.status(201).json(getClub());
});

function requireReady(club, res) {
  if (!club.name || !club.managerName) {
    res.status(400).json({ error: "Complete club setup first." });
    return false;
  }
  return true;
}

function squadRating(club) {
  const ids = starterIds(club.lineup);
  const starters = club.players.filter((player) => ids.includes(player.id));
  if (!starters.length) {
    return club.skill || 10;
  }
  return Math.round(starters.reduce((sum, player) => sum + player.rating, 0) / starters.length);
}

app.post("/api/club/sign", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const playerId = typeof req.body.playerId === "string" ? req.body.playerId : "";
  const index = club.market.findIndex((player) => player.id === playerId);
  if (index === -1) {
    return res.status(400).json({ error: "That player is not on the market." });
  }
  const player = club.market[index];
  const fee = Math.max(8, Math.round(player.value * 0.4));
  if (club.funds < fee) {
    return res.status(400).json({ error: `Not enough funds to sign ${player.name} ($${fee}).` });
  }
  club.funds -= fee;
  club.market.splice(index, 1);
  club.players.push(player);
  club.skill = squadRating(club);
  writeClub(club);
  res.json({ club, log: `${player.name} signed for $${fee}.` });
});

app.post("/api/club/lineup", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const lineup = req.body.lineup || {};
  const used = new Set();
  const next = emptyLineup();
  const roster = new Map(club.players.map((player) => [player.id, player]));

  for (const pos of Object.keys(SLOT_COUNTS)) {
    const slots = Array.isArray(lineup[pos]) ? lineup[pos] : [];
    next[pos] = [];
    for (let i = 0; i < SLOT_COUNTS[pos]; i += 1) {
      const playerId = slots[i] || null;
      if (!playerId) {
        next[pos].push(null);
        continue;
      }
      const player = roster.get(playerId);
      if (!player || player.position !== pos || used.has(playerId)) {
        return res.status(400).json({ error: "Lineup is invalid. Check positions and duplicates." });
      }
      used.add(playerId);
      next[pos].push(playerId);
    }
  }

  const subs = Array.isArray(lineup.SUB) ? lineup.SUB.filter(Boolean) : [];
  next.SUB = [];
  for (const playerId of subs.slice(0, MAX_SUBS)) {
    if (!roster.has(playerId) || used.has(playerId)) {
      return res.status(400).json({ error: "Substitute list is invalid." });
    }
    used.add(playerId);
    next.SUB.push(playerId);
  }

  club.lineup = next;
  club.skill = squadRating(club);
  writeClub(club);
  res.json({ club, log: "Starting XI and substitutes saved." });
});

app.post("/api/academy/upgrade", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const field = req.body.field;
  if (!["level", "facilities", "coaches"].includes(field)) {
    return res.status(400).json({ error: "Choose academy level, facilities, or coaches." });
  }
  if (club.academy[field] >= 5) {
    return res.status(400).json({ error: "That academy area is already maxed." });
  }
  const cost = 40 + club.academy[field] * 50;
  if (club.funds < cost) {
    return res.status(400).json({ error: `Upgrade costs $${cost}.` });
  }
  club.funds -= cost;
  club.academy[field] += 1;
  writeClub(club);
  res.json({ club, log: `Academy ${field} raised to ${club.academy[field]}.` });
});

app.post("/api/academy/intake", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const cap = 3 + club.academy.facilities;
  if (club.academy.youth.length >= cap) {
    return res.status(400).json({ error: "No academy beds left. Upgrade facilities." });
  }
  const cost = 28;
  if (club.funds < cost) {
    return res.status(400).json({ error: `Youth intake costs $${cost}.` });
  }
  const count = Math.min(
    (club.academy.level >= 3 ? 2 : 1) + (hasHire(club, "scout") ? 1 : 0),
    cap - club.academy.youth.length
  );
  const newcomers = generateYouth(count);
  club.funds -= cost;
  club.academy.youth.push(...newcomers);
  writeClub(club);
  res.json({ club, log: `${count} youth player${count > 1 ? "s" : ""} joined the academy.` });
});

app.post("/api/academy/develop", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const playerId = typeof req.body.playerId === "string" ? req.body.playerId : "";
  const player = club.academy.youth.find((item) => item.id === playerId);
  if (!player) {
    return res.status(400).json({ error: "Youth player not found." });
  }
  const cost = 16;
  if (club.funds < cost) {
    return res.status(400).json({ error: `Development session costs $${cost}.` });
  }
  const gain = 1 + Math.floor((club.academy.coaches + club.academy.facilities) / 2);
  club.funds -= cost;
  player.rating = Math.min(player.potential, player.rating + gain);
  player.pace = Math.min(99, player.pace + 1);
  player.passing = Math.min(99, player.passing + 1);
  player.progress = Math.min(99, (player.progress || 40) + 12);
  player.condition = Math.min(99, (player.condition || 70) + 4);
  writeClub(club);
  res.json({ club, log: `${player.name} developed to rating ${player.rating}.` });
});

app.post("/api/academy/promote", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const playerId = typeof req.body.playerId === "string" ? req.body.playerId : "";
  const index = club.academy.youth.findIndex((item) => item.id === playerId);
  if (index === -1) {
    return res.status(400).json({ error: "Youth player not found." });
  }
  const player = club.academy.youth[index];
  if (player.rating < 58) {
    return res.status(400).json({ error: `${player.name} is not ready for the first team yet.` });
  }
  club.academy.youth.splice(index, 1);
  player.youth = false;
  club.players.push(player);
  writeClub(club);
  res.json({ club, log: `${player.name} promoted to the first team.` });
});

app.post("/api/club/train", requireAuth, (_req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  if (club.funds < 25) {
    return res.status(400).json({ error: "Not enough funds to train." });
  }

  club.funds -= 25;
  pushLedger(club, "out", "Squad training", -25);
  applyFirstTeamSession(club.players, club.training?.firstFocus || "general", null);
  for (const player of club.players) {
    player.rating = Math.min(player.potential || 92, player.rating + 1);
  }
  club.skill = squadRating(club);
  const newPrizes = awardPrizes(club);
  writeClub(club);
  res.json({ club, log: `Squad trained. Skill is now ${club.skill}.`, newPrizes });
});

app.post("/api/players/train", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const group = req.body.group === "academy" ? "academy" : "first";
  const playerId = typeof req.body.playerId === "string" ? req.body.playerId : "";
  const firstFocuses = ["general", "fitness", "tactics", "attacking", "defending"];
  const academyFocuses = ["development", "fitness", "technical", "tactical"];

  if (group === "academy") {
    const focus = academyFocuses.includes(req.body.focus) ? req.body.focus : club.training.academyFocus;
    const cost = 14;
    if (club.funds < cost) {
      return res.status(400).json({ error: `Academy training costs ${cost} coins.` });
    }
    if (!(club.academy.youth || []).length) {
      return res.status(400).json({ error: "No academy players to train." });
    }
    club.funds -= cost;
    applyAcademySession(club.academy.youth, focus);
    club.training.academyFocus = focus;
    pushLedger(club, "out", "Academy training", -cost);
    writeClub(club);
    return res.json({ club, log: `Academy ${focus} session complete.` });
  }

  const focus = firstFocuses.includes(req.body.focus) ? req.body.focus : club.training.firstFocus;
  const cost = playerId ? 12 : 22;
  if (club.funds < cost) {
    return res.status(400).json({ error: `Training costs ${cost} coins.` });
  }
  if (playerId && !club.players.some((player) => player.id === playerId)) {
    return res.status(400).json({ error: "That player is not in the first team." });
  }
  if (!club.players.length) {
    return res.status(400).json({ error: "Sign first-team players before training." });
  }
  club.funds -= cost;
  applyFirstTeamSession(club.players, focus, playerId || null);
  club.training.firstFocus = focus;
  club.skill = squadRating(club);
  pushLedger(club, "out", playerId ? "Individual training" : "First-team training", -cost);
  const newPrizes = awardPrizes(club);
  writeClub(club);
  res.json({ club, log: playerId ? "Individual session complete." : `First-team ${focus} session complete.`, newPrizes });
});

app.post("/api/club/recruit", requireAuth, (_req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  if (club.funds < 20) {
    return res.status(400).json({ error: "Not enough funds to recruit." });
  }

  club.funds -= 20;
  club.fans += 45;
  const newPrizes = awardPrizes(club);
  writeClub(club);
  res.json({ club, log: `New supporters joined. Fans: ${club.fans}.`, newPrizes });
});

app.post("/api/club/match", requireAuth, (_req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  if (starterIds(club.lineup).length < 11) {
    return res.status(400).json({ error: "Set a starting XI of 11 players before match day." });
  }
  if (club.funds < 10) {
    return res.status(400).json({ error: "Not enough funds to travel to a match." });
  }

  club.funds -= 10;
  pushLedger(club, "out", "Matchday travel", -10);
  club.matches += 1;
  club.skill = squadRating(club);
  const analyst = hasHire(club, "analyst") ? 3 : 0;
  const isAway = (club.matches - 1) % 2 === 1;
  const support = isAway ? awaySupportBonus(club) : 0;
  const opponent = 8 + Math.floor(Math.random() * (club.skill + 12));
  const roll = club.skill + analyst + support + Math.floor(Math.random() * 12);
  const tickets = gateReceipt(club);
  club.funds += tickets;
  pushLedger(club, "in", "Matchday gate", tickets);
  let result = "draw";
  let log;

  if (roll > opponent + 2) {
    result = "win";
    club.wins += 1;
    club.funds += 55;
    pushLedger(club, "in", "Match prize", 55);
    club.fans += 25;
    log = `Match ${club.matches}: win. Gate $${tickets}, prize +$55.`;
  } else if (roll < opponent - 2) {
    result = "loss";
    club.losses += 1;
    log = `Match ${club.matches}: loss. Gate still took $${tickets}.`;
  } else {
    club.draws += 1;
    club.funds += 20;
    pushLedger(club, "in", "Draw bonus", 20);
    log = `Match ${club.matches}: draw. Gate $${tickets}, +$20.`;
  }

  if (isAway && support) {
    log += ` Away support +${support}.`;
  }

  applyMatchWear(club, result);
  const newPrizes = awardPrizes(club);
  writeClub(club);
  res.json({ club, result, log, newPrizes });
});

app.post("/api/club/rename", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const shortName = typeof req.body.shortName === "string" ? req.body.shortName.trim().toUpperCase() : "";
  if (name.length < 3 || name.length > 40) {
    return res.status(400).json({ error: "Club name must be 3 to 40 characters." });
  }
  club.name = name;
  club.shortName = (shortName || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3) || "FC").toUpperCase().slice(0, 4);
  writeClub(club);
  res.json({ club, log: `Club identity set to ${club.name} (${club.shortName}).` });
});

app.post("/api/club/look", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const colorOk = (value) => typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
  const crestIn = req.body.crest && typeof req.body.crest === "object" ? req.body.crest : {};
  const kitsIn = req.body.kits && typeof req.body.kits === "object" ? req.body.kits : {};
  const motifs = new Set(["cannon", "ball", "shield", "star"]);
  const patterns = new Set(["solid", "stripes", "hoops", "halves", "sash"]);
  const styles = new Set(["classic", "modern", "retro"]);
  const crest = { ...club.identity.crest };
  if (colorOk(crestIn.primary)) crest.primary = crestIn.primary;
  if (colorOk(crestIn.secondary)) crest.secondary = crestIn.secondary;
  if (colorOk(crestIn.accent)) crest.accent = crestIn.accent;
  if (motifs.has(crestIn.motif)) crest.motif = crestIn.motif;
  const kits = { ...club.identity.kits };
  for (const key of ["home", "away", "gkHome", "gkAway"]) {
    const raw = kitsIn[key] && typeof kitsIn[key] === "object" ? kitsIn[key] : {};
    const next = { ...kits[key] };
    if (colorOk(raw.primary)) next.primary = raw.primary;
    if (colorOk(raw.secondary)) next.secondary = raw.secondary;
    if (colorOk(raw.trim)) next.trim = raw.trim;
    if (patterns.has(raw.pattern)) next.pattern = raw.pattern;
    if (styles.has(raw.style)) next.style = raw.style;
    if (typeof raw.number === "string" || typeof raw.number === "number") {
      next.number = String(raw.number).replace(/\D/g, "").slice(0, 2) || "1";
    }
    kits[key] = next;
  }
  club.identity = { crest, kits };
  writeClub(club);
  res.json({ club, log: "Club look saved: crest and kits updated." });
});

app.post("/api/club/sell", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const playerId = typeof req.body.playerId === "string" ? req.body.playerId : "";
  const index = club.players.findIndex((player) => player.id === playerId);
  if (index === -1) {
    return res.status(400).json({ error: "That player is not in the first team." });
  }
  const player = club.players[index];
  const fee = Math.max(6, Math.round(player.value * 0.55));
  club.players.splice(index, 1);
  for (const pos of Object.keys(club.lineup || {})) {
    club.lineup[pos] = (club.lineup[pos] || []).map((id) => (id === playerId ? null : id));
  }
  club.market.push(player);
  club.funds += fee;
  club.skill = squadRating(club);
  pushLedger(club, "in", `Sale: ${player.name}`, fee);
  pushInbox(club, "Sporting director", "Sale completed", `${player.name} left for $${fee}.`);
  writeClub(club);
  res.json({ club, log: `${player.name} sold for $${fee}.` });
});

app.post("/api/staff/hire", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const roleId = typeof req.body.roleId === "string" ? req.body.roleId : "";
  const def = STAFF_ROSTER.find((item) => item.id === roleId);
  if (!def) {
    return res.status(400).json({ error: "Unknown staff role." });
  }
  if (hasHire(club, roleId)) {
    return res.status(400).json({ error: `${def.role} is already on the books.` });
  }
  if (club.funds < def.cost) {
    return res.status(400).json({ error: `${def.role} costs $${def.cost}.` });
  }
  club.funds -= def.cost;
  club.staff.hires.push({ id: def.id, role: def.role, hiredAt: new Date().toISOString() });
  pushInbox(club, "HR", "New appointment", `${def.role} has joined the staff.`);
  writeClub(club);
  res.json({ club, log: `${def.role} hired for $${def.cost}.` });
});

app.post("/api/stadium/upgrade", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  if (club.stadium.level >= 10) {
    return res.status(400).json({ error: "The stadium is already at maximum capacity." });
  }
  const cost = 40 + club.stadium.level * 55;
  if (club.funds < cost) {
    return res.status(400).json({ error: `Upgrade costs ${cost} coins.` });
  }
  club.funds -= cost;
  pushLedger(club, "out", "Stadium expansion", -cost);
  club.stadium.level += 1;
  club.stadium.capacity = stadiumCapacityForLevel(club.stadium.level);
  club.stadium.condition = Math.min(99, club.stadium.condition + 6);
  club.fans += 20;
  writeClub(club);
  res.json({
    club,
    log: `Stadium level ${club.stadium.level}. Capacity ${club.stadium.capacity.toLocaleString()} spectators.`,
  });
});

app.post("/api/stadium/service", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const serviceId = typeof req.body.serviceId === "string" ? req.body.serviceId : "";
  const def = STADIUM_SERVICES.find((item) => item.id === serviceId);
  if (!def) {
    return res.status(400).json({ error: "Choose a stadium service to upgrade." });
  }
  const level = club.stadium.services[serviceId] || 1;
  if (level >= 5) {
    return res.status(400).json({ error: `${def.name} is already at maximum.` });
  }
  const cost = 30 + level * 35;
  if (club.funds < cost) {
    return res.status(400).json({ error: `Upgrade costs ${cost} coins.` });
  }
  club.funds -= cost;
  club.stadium.services[serviceId] = level + 1;
  pushLedger(club, "out", `${def.name} upgrade`, -cost);
  writeClub(club);
  res.json({ club, log: `${def.name} raised to level ${club.stadium.services[serviceId]}.` });
});

app.post("/api/stadium/tickets", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const price = Number(req.body.ticketPrice);
  if (!Number.isFinite(price) || price < 5 || price > 40) {
    return res.status(400).json({ error: "Ticket price must be between $5 and $40." });
  }
  club.stadium.ticketPrice = Math.round(price);
  writeClub(club);
  res.json({ club, log: `Matchday tickets set to $${club.stadium.ticketPrice}.` });
});

app.post("/api/stadium/name", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (name.length < 3 || name.length > 40) {
    return res.status(400).json({ error: "Stadium name must be 3 to 40 characters." });
  }
  club.stadium.name = name;
  writeClub(club);
  res.json({ club, log: `Home ground is now ${name}.` });
});

app.post("/api/cup/play", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  if (starterIds(club.lineup).length < 11) {
    return res.status(400).json({ error: "Set a starting XI before a cup tie." });
  }
  if (club.cup.round === "Champions") {
    return res.status(400).json({ error: "You already lifted this cup." });
  }
  const cost = 12;
  if (club.funds < cost) {
    return res.status(400).json({ error: `Cup travel costs $${cost}.` });
  }
  club.funds -= cost;
  club.skill = squadRating(club);
  const analyst = hasHire(club, "analyst") ? 4 : 0;
  const opponent = 12 + Math.floor(Math.random() * (club.skill + 10));
  const roll = club.skill + analyst + Math.floor(Math.random() * 14);
  if (roll >= opponent) {
    club.cup.wins += 1;
    club.cup.round = nextCupRound(club.cup.round);
    club.funds += 40;
    club.fans += 18;
    pushInbox(club, "Cup office", "Through", `You advanced to the ${club.cup.round}.`);
    writeClub(club);
    return res.json({ club, log: `Cup win. Next round: ${club.cup.round}.` });
  }
  club.cup.losses += 1;
  club.cup.round = "Round of 32";
  pushInbox(club, "Cup office", "Eliminated", "The cup run is over. You re-enter at the Round of 32.");
  writeClub(club);
  res.json({ club, log: "Cup exit. Back to the Round of 32." });
});

app.post("/api/inbox/read", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const id = typeof req.body.id === "string" ? req.body.id : "";
  const note = (club.inbox || []).find((item) => item.id === id);
  if (!note) {
    return res.status(400).json({ error: "Message not found." });
  }
  note.read = true;
  writeClub(club);
  res.json({ club, log: "Message marked read." });
});

app.get("/api/store", requireAuth, (_req, res) => {
  res.json({ items: STORE_ITEMS });
});

app.post("/api/store/buy", requireAuth, (req, res) => {
  const club = getClub();
  if (!requireReady(club, res)) {
    return;
  }
  const itemId = typeof req.body.itemId === "string" ? req.body.itemId : "";
  const item = STORE_ITEMS.find((row) => row.id === itemId);
  if (!item) {
    return res.status(400).json({ error: "Unknown store item." });
  }
  if (club.funds < item.cost) {
    return res.status(400).json({ error: `${item.name} costs $${item.cost}.` });
  }
  club.funds -= item.cost;
  club.storeOwned.push({ id: item.id, at: new Date().toISOString() });
  if (item.id === "kit") {
    club.fans += 40;
  } else if (item.id === "lights") {
    club.stadium.condition = Math.min(99, club.stadium.condition + 8);
  } else if (item.id === "network") {
    const cap = 3 + club.academy.facilities;
    if (club.academy.youth.length < cap) {
      club.academy.youth.push(...generateYouth(1));
    }
  } else if (item.id === "sponsor") {
    club.funds += 70;
  }
  pushInbox(club, "Club store", "Purchase", `You bought ${item.name}.`);
  writeClub(club);
  res.json({ club, log: `Purchased ${item.name}.` });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Club running at http://localhost:${PORT}`);
  });
}

module.exports = app;
