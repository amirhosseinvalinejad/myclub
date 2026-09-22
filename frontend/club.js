const setupPanel = document.getElementById("setup-panel");
const setupShell = document.getElementById("setup-shell");
const clubWrap = document.getElementById("club-wrap");
const stepClub = document.getElementById("step-club");
const stepManager = document.getElementById("step-manager");
const stepSquad = document.getElementById("step-squad");
const clubNameInput = document.getElementById("club-name");
const clubShortInput = document.getElementById("club-short");
const managerNameInput = document.getElementById("manager-name");
const clubTitle = document.getElementById("club-title");
const prizeList = document.getElementById("prize-list");
const statusEl = document.getElementById("status");
const nameGrid = document.getElementById("name-grid");
const previewEl = document.getElementById("setup-club-preview");

const PRESET_CLUBS = [
  { name: "Northgate Athletic", short: "NGA" },
  { name: "Riverbank United", short: "RBU" },
  { name: "Harbor City FC", short: "HCF" },
  { name: "Elmwood Rovers", short: "ELM" },
  { name: "Crown Hill Town", short: "CHT" },
  { name: "Westbridge Wanderers", short: "WBW" },
];

const DASH_TABS = ["club", "players", "stadium", "academy", "transfer", "cup", "pm", "store"];
const HQ_PANES = ["overview", "logo", "kits"];
const KIT_DEFS = [
  { id: "home", label: "Home kit" },
  { id: "away", label: "Away kit" },
  { id: "gkHome", label: "GK home" },
  { id: "gkAway", label: "GK away" },
];
const STAFF_CATALOG = [
  { id: "scout", role: "Chief scout", cost: 80, bonus: "Finds extra youth at intake." },
  { id: "physio", role: "Physio", cost: 60, bonus: "Keeps the medical room moving." },
  { id: "analyst", role: "Match analyst", cost: 70, bonus: "Slight edge on match and cup days." },
];
const STADIUM_SERVICES = [
  { id: "hospitality", name: "Away hospitality", blurb: "Tickets, welcome, and a base for travelling supporters." },
  { id: "catering", name: "Away catering", blurb: "Food and drink for the away end so fans stay with the team." },
  { id: "medical", name: "Away medical", blurb: "Care for supporters on the road, not only the squad." },
  { id: "media", name: "Away coverage", blurb: "Travel updates and match reports that rally the away following." },
  { id: "security", name: "Away stewards", blurb: "Safe travel and a louder, better organised away section." },
];
const STORE_CATALOG = [
  { id: "kit", name: "Home kit drop", cost: 45, blurb: "A new strip. +40 fans." },
  { id: "lights", name: "Floodlight rig", cost: 90, blurb: "Night matches. Stadium condition +8." },
  { id: "network", name: "Scout network", cost: 55, blurb: "One extra academy prospect." },
  { id: "sponsor", name: "Sleeve sponsor", cost: 35, blurb: "Immediate board cash. +$70." },
];
const PITCH_ORDER = ["ST", "CM", "CB", "GK"];
const MAX_SUBS = 7;

const PRIZE_KEYS = {
  "first-win": "prizeFirst",
  "local-cup": "prizeLocal",
  "city-shield": "prizeCity",
  "league-trophy": "prizeLeague",
  "crowd-roar": "prizeCrowd",
  "training-badge": "prizeTrain",
  "champions-cup": "prizeChamp",
};

let club = null;
let setupMode = "create";
let inSetupFlow = false;
let selectedSlot = null;
let lookDirty = false;
let lookDraft = null;
let hqPane = "overview";
let playersPane = "first";
let stadiumPane = "capacity";

function copy(key, fallback) {
  if (typeof t !== "function") {
    return fallback;
  }
  const value = t(key);
  return !value || value === key ? fallback : value;
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function shortFromName(name) {
  const letters = name.replace(/[^A-Za-z0-9]/g, "");
  if (letters.length >= 3) {
    return letters.slice(0, 3).toUpperCase();
  }
  return (letters + "FC").slice(0, 3).toUpperCase();
}

function playerById(playerId) {
  return (club.players || []).concat(club.academy?.youth || []).find((player) => player.id === playerId);
}

function emptyLineup() {
  return { GK: [null], CB: [null, null, null, null], CM: [null, null, null, null], ST: [null, null], SUB: [] };
}

function showStep(which) {
  const map = { club: stepClub, manager: stepManager, squad: stepSquad };
  const entering = map[which];
  setupStep = which;
  document.getElementById("progress-1").className = which === "club" ? "is-active" : "is-done";
  document.getElementById("progress-2").className =
    which === "manager" ? "is-active" : which === "squad" ? "is-done" : "";
  document.getElementById("progress-3").className = which === "squad" ? "is-active" : "";

  window.clearTimeout(stepTimer);
  for (const [name, el] of Object.entries(map)) {
    if (name === which) {
      continue;
    }
    el.hidden = true;
    el.classList.remove("is-out", "is-in");
  }
  entering.hidden = false;
  entering.classList.remove("is-out");
  entering.classList.add("is-in");
  stepTimer = window.setTimeout(() => entering.classList.remove("is-in"), 420);

  if (which === "manager") {
    const name = clubNameInput.value.trim();
    const short = (clubShortInput.value.trim() || shortFromName(name)).toUpperCase();
    previewEl.textContent = name ? `${name} (${short}) is ready for a manager.` : "";
    window.setTimeout(() => managerNameInput.focus(), 40);
  }
  if (which === "squad") {
    renderMarket(document.getElementById("setup-market"), true);
    document.getElementById("squad-hint").textContent =
      `${(club.players || []).length} signed · funds $${club.funds}. Sign a balanced group, then continue.`;
  }
}

function renderPrizes(prizes) {
  if (!prizeList) {
    return;
  }
  prizeList.innerHTML = "";
  if (!prizes.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = copy("noPrizes", "No prizes yet. Win a match to start the cabinet.");
    prizeList.append(empty);
    return;
  }
  for (const prize of prizes) {
    const item = document.createElement("li");
    item.textContent = copy(PRIZE_KEYS[prize.id], prize.title);
    prizeList.append(item);
  }
}

function cardEl(player, options) {
  const card = document.createElement("article");
  card.className = "player-card";
  if (options.selected) {
    card.classList.add("is-selected");
  }
  const title = document.createElement("header");
  const pos = document.createElement("span");
  pos.className = `pos-badge pos-${player.position}`;
  pos.textContent = player.position;
  const name = document.createElement("h3");
  name.textContent = player.name;
  title.append(pos, name);
  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = `${player.nationality} · Age ${player.age} · OVR ${player.rating}`;
  const stats = document.createElement("ul");
  stats.className = "card-stats";
  const rows = [
    ["Value", `$${player.value}`],
    ["Wage", `$${player.salary}/wk`],
    ["Pot.", player.potential],
    ["Pace", player.pace],
    ["Pass", player.passing],
    ["Shot", player.shooting],
    ["Def", player.defending],
    ["Stam", player.stamina],
  ];
  if (player.position === "GK") {
    rows.push(["Hands", player.handling]);
  }
  for (const [label, value] of rows) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${label}</span><strong></strong>`;
    li.querySelector("strong").textContent = String(value);
    stats.append(li);
  }
  card.append(title, meta, stats);
  if (options.onSelect) {
    card.addEventListener("click", () => options.onSelect(player));
  }
  if (options.actions) {
    const row = document.createElement("div");
    row.className = "card-actions";
    for (const action of options.actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        action.run(player);
      });
      row.append(btn);
    }
    card.append(row);
  }
  return card;
}

function renderMarket(container, signing) {
  if (!container || !club) {
    return;
  }
  container.innerHTML = "";
  const list = club.market || [];
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "The market is empty.";
    container.append(empty);
    return;
  }
  for (const player of list) {
    const fee = Math.max(8, Math.round(player.value * 0.4));
    container.append(
      cardEl(player, {
        actions: signing
          ? [{ label: `Sign · $${fee}`, run: (item) => signPlayer(item.id) }]
          : [{ label: `Sign · $${fee}`, run: (item) => signPlayer(item.id) }],
      })
    );
  }
}

function renderAssignGrid() {
  const grid = document.getElementById("assign-grid");
  if (!grid) {
    return;
  }
  grid.innerHTML = "";
  for (const player of club.players || []) {
    grid.append(
      cardEl(player, {
        selected: Boolean(selectedSlot),
        onSelect: (item) => assignPlayer(item),
      })
    );
  }
  if (!club.players?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Sign players in Transfer, then place them here.";
    grid.append(empty);
  }
}

function renderRoster() {
  const grid = document.getElementById("roster-grid");
  grid.innerHTML = "";
  for (const player of club.players || []) {
    grid.append(
      cardEl(player, {
        selected: Boolean(selectedSlot),
        onSelect: (item) => assignPlayer(item),
        actions: [
          {
            label: `Sell · $${Math.max(6, Math.round(player.value * 0.55))}`,
            run: (item) => sellPlayer(item.id),
          },
        ],
      })
    );
  }
  if (!club.players?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No first-team players yet. Sign from the market.";
    grid.append(empty);
  }
}

function renderPitch() {
  const pitch = document.getElementById("pitch");
  if (!pitch) {
    return;
  }
  pitch.innerHTML = "";
  const lineup = club.lineup || emptyLineup();
  for (const pos of PITCH_ORDER) {
    const row = document.createElement("div");
    row.className = "pitch-row";
    lineup[pos].forEach((playerId, index) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "pitch-slot";
      if (selectedSlot && selectedSlot.pos === pos && selectedSlot.index === index) {
        slot.classList.add("is-on");
      }
      const player = playerId ? club.players.find((item) => item.id === playerId) : null;
      slot.innerHTML = `<span>${pos}</span><strong></strong>`;
      slot.querySelector("strong").textContent = player ? player.name.split(" ").pop() : "—";
      slot.addEventListener("click", () => {
        selectedSlot = { pos, index };
        renderPitch();
        renderSubs();
        renderRoster();
      });
      row.append(slot);
    });
    pitch.append(row);
  }
}

function renderSubs() {
  const row = document.getElementById("sub-row");
  if (!row) {
    return;
  }
  row.innerHTML = "";
  const subs = (club.lineup && club.lineup.SUB) || [];
  for (let i = 0; i < MAX_SUBS; i += 1) {
    const playerId = subs[i];
    const player = playerId ? club.players.find((item) => item.id === playerId) : null;
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "pitch-slot sub-slot";
    if (selectedSlot && selectedSlot.pos === "SUB" && selectedSlot.index === i) {
      slot.classList.add("is-on");
    }
    slot.textContent = player ? player.name.split(" ").pop() : `Sub ${i + 1}`;
    slot.addEventListener("click", () => {
      selectedSlot = { pos: "SUB", index: i };
      renderPitch();
      renderSubs();
      renderRoster();
    });
    row.append(slot);
  }
}

function assignPlayer(player) {
  if (!selectedSlot) {
    setStatus("Select a pitch or substitute slot first.");
    return;
  }
  if (!club.lineup) {
    club.lineup = emptyLineup();
  }
  if (selectedSlot.pos !== "SUB" && player.position !== selectedSlot.pos) {
    setStatus(`${player.name} plays ${player.position}, not ${selectedSlot.pos}.`);
    return;
  }
  const used = new Set(
    [...club.lineup.GK, ...club.lineup.CB, ...club.lineup.CM, ...club.lineup.ST, ...club.lineup.SUB].filter(Boolean)
  );
  used.delete(club.lineup[selectedSlot.pos]?.[selectedSlot.index]);
  if (used.has(player.id)) {
    setStatus("That player is already in the lineup.");
    return;
  }
  if (selectedSlot.pos === "SUB") {
    const next = club.lineup.SUB.slice();
    while (next.length < MAX_SUBS) {
      next.push(null);
    }
    next[selectedSlot.index] = player.id;
    club.lineup.SUB = next.filter((id, index) => id || index < MAX_SUBS);
  } else {
    club.lineup[selectedSlot.pos][selectedSlot.index] = player.id;
  }
  renderPitch();
  renderSubs();
  renderAssignGrid();
  setStatus(`${player.name} placed in ${selectedSlot.pos}. Save the lineup when ready.`);
}

function renderAcademy() {
  document.getElementById("ac-level").textContent = `${club.academy.level} / 5`;
  document.getElementById("ac-facilities").textContent = `${club.academy.facilities} / 5`;
  document.getElementById("ac-coaches").textContent = `${club.academy.coaches} / 5`;
  const grid = document.getElementById("youth-grid");
  grid.innerHTML = "";
  for (const player of club.academy.youth || []) {
    grid.append(
      cardEl(player, {
        actions: [
          { label: "Develop · $16", run: (item) => academyAct("/api/academy/develop", item.id) },
          { label: "Promote", run: (item) => academyAct("/api/academy/promote", item.id) },
        ],
      })
    );
  }
  if (!club.academy.youth?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    grid.append(empty);
  }
}

function meterEl(label, value) {
  const wrap = document.createElement("article");
  wrap.className = "pl-meter";
  const ready = value >= 75 ? "is-good" : value >= 55 ? "is-ok" : "is-low";
  wrap.classList.add(ready);
  wrap.innerHTML = `<span>${label}</span><div class="pl-bar"><i style="width:${value}%"></i></div><strong>${value}</strong>`;
  return wrap;
}

function avgPlayerStat(list, key) {
  if (!list.length) {
    return 0;
  }
  return Math.round(list.reduce((sum, player) => sum + (player[key] || 0), 0) / list.length);
}

function lineupRole(playerId) {
  const lu = club.lineup || emptyLineup();
  if ((lu.GK || []).includes(playerId) || (lu.CB || []).includes(playerId) || (lu.CM || []).includes(playerId) || (lu.ST || []).includes(playerId)) {
    return "XI";
  }
  if ((lu.SUB || []).includes(playerId)) {
    return "Sub";
  }
  return "Squad";
}

function setPlayersPane(name) {
  playersPane = name === "academy" ? "academy" : "first";
  const first = document.getElementById("pl-pane-first");
  const academy = document.getElementById("pl-pane-academy");
  if (first) {
    first.hidden = playersPane !== "first";
  }
  if (academy) {
    academy.hidden = playersPane !== "academy";
  }
  document.querySelectorAll("[data-pl]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.pl === playersPane);
  });
}

function renderPlayers() {
  const firstPane = document.getElementById("pl-pane-first");
  if (!firstPane) {
    return;
  }
  const squad = club.players || [];
  const youth = club.academy?.youth || [];
  const fitness = avgPlayerStat(squad, "fitness");
  const morale = avgPlayerStat(squad, "morale");
  const form = avgPlayerStat(squad, "form");
  const condition = avgPlayerStat(squad, "condition");
  const sharpness = avgPlayerStat(squad, "sharpness");
  const readiness = squad.length ? Math.round((fitness + morale + form + condition + sharpness) / 5) : 0;
  const ready = document.getElementById("pl-ready");
  ready.innerHTML = "";
  ready.append(
    meterEl("Fitness", fitness),
    meterEl("Morale", morale),
    meterEl("Form", form),
    meterEl("Readiness", readiness)
  );

  const starters = [...(club.lineup?.GK || []), ...(club.lineup?.CB || []), ...(club.lineup?.CM || []), ...(club.lineup?.ST || [])].filter(Boolean).length;
  document.getElementById("pl-formation-label").textContent =
    `Formation 1-4-4-2 · ${starters}/11 in the XI · ${squad.length} in the first team`;

  const focus = document.getElementById("pl-focus");
  const individual = document.getElementById("pl-individual");
  if (focus && document.activeElement !== focus) {
    focus.value = club.training?.firstFocus || "general";
  }
  if (individual && document.activeElement !== individual) {
    const current = individual.value;
    individual.innerHTML = `<option value="">Whole squad · 22 coins</option>`;
    for (const player of squad) {
      const opt = document.createElement("option");
      opt.value = player.id;
      opt.textContent = `${player.name} · 12 coins`;
      individual.append(opt);
    }
    if ([...individual.options].some((opt) => opt.value === current)) {
      individual.value = current;
    }
  }

  const body = document.querySelector("#pl-squad tbody");
  body.innerHTML = "";
  if (!squad.length) {
    body.innerHTML = `<tr><td colspan="9">No first-team players yet. Sign names in Transfer.</td></tr>`;
  } else {
    const sorted = squad.slice().sort((a, b) => (a.position > b.position ? 1 : a.position < b.position ? -1 : b.rating - a.rating));
    for (const player of sorted) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td></td><td>${player.position}</td><td>${player.rating}</td><td>${lineupRole(player.id)}</td>
        <td>${player.condition}</td><td>${player.fitness}</td><td>${player.morale}</td><td>${player.form}</td>
        <td><div class="pl-mini"><i style="width:${player.progress}%"></i></div></td>`;
      tr.querySelector("td").textContent = player.name;
      body.append(tr);
    }
  }

  const acFit = avgPlayerStat(youth, "fitness");
  const acProg = avgPlayerStat(youth, "progress");
  const acCond = avgPlayerStat(youth, "condition");
  const acReady = document.getElementById("pl-ac-ready");
  acReady.innerHTML = "";
  acReady.append(meterEl("Academy fitness", acFit), meterEl("Condition", acCond), meterEl("Training progress", acProg));
  document.getElementById("pl-ac-meta").textContent =
    `${youth.length} youth players · academy level ${club.academy?.level || 1}`;
  const acFocus = document.getElementById("pl-ac-focus");
  if (acFocus && document.activeElement !== acFocus) {
    acFocus.value = club.training?.academyFocus || "development";
  }
  const acBody = document.querySelector("#pl-academy tbody");
  acBody.innerHTML = "";
  if (!youth.length) {
    acBody.innerHTML = `<tr><td colspan="9">No academy players. Hold an intake on the Academy board.</td></tr>`;
  } else {
    for (const player of youth) {
      const tr = document.createElement("tr");
      const develop = document.createElement("button");
      develop.type = "button";
      develop.textContent = "Develop";
      develop.addEventListener("click", () => academyAct("/api/academy/develop", player.id));
      tr.innerHTML = `<td></td><td>${player.position}</td><td>${player.age}</td><td>${player.rating}</td>
        <td>${player.potential}</td><td>${player.condition}</td><td>${player.fitness}</td>
        <td><div class="pl-mini"><i style="width:${player.progress}%"></i></div></td><td></td>`;
      tr.querySelector("td").textContent = player.name;
      tr.lastElementChild.append(develop);
      acBody.append(tr);
    }
  }
  setPlayersPane(playersPane);
}

function wageBill() {
  return (club.players || []).reduce((sum, player) => sum + (player.salary || 0), 0);
}

function identityOf() {
  return club.identity || {
    crest: { primary: "#c8102e", secondary: "#ffffff", accent: "#9c824a", motif: "cannon" },
    kits: {},
  };
}

function syncLookDraft() {
  if (lookDirty && lookDraft) {
    return;
  }
  lookDraft = JSON.parse(JSON.stringify(identityOf()));
}

function motifMark(motif, accent, secondary) {
  if (motif === "ball") {
    return `<circle cx="50" cy="46" r="14" fill="${secondary}" stroke="${accent}" stroke-width="2"/>
      <path d="M50 32 v28 M36 46 h28" stroke="${accent}" fill="none" stroke-width="2"/>`;
  }
  if (motif === "star") {
    return `<polygon points="50,30 54,42 66,42 56,50 60,62 50,54 40,62 44,50 34,42 46,42" fill="${accent}"/>`;
  }
  if (motif === "shield") {
    return `<path d="M38 34 h24 v16 c0 10-12 18-12 18s-12-8-12-18z" fill="${accent}"/>`;
  }
  return `<path d="M28 48 h28 l18-10 v10 c-8 14-22 16-34 8z" fill="${accent}"/>
    <circle cx="68" cy="38" r="6" fill="${secondary}"/>`;
}

function crestSvg(crest, shortName) {
  const c = crest || {};
  const primary = c.primary || "#c8102e";
  const secondary = c.secondary || "#ffffff";
  const accent = c.accent || "#9c824a";
  const letters = (shortName || "FC").slice(0, 4);
  return `<svg class="crest-svg" viewBox="0 0 100 118" role="img" aria-label="Club crest">
    <path d="M50 6 L90 22 v38 c0 28-18 44-40 52 C28 104 10 88 10 60 V22z" fill="${primary}" stroke="${accent}" stroke-width="3"/>
    <path d="M50 18 L78 28 v30 c0 20-12 32-28 38 C30 90 22 78 22 58 V28z" fill="${secondary}" opacity="0.18"/>
    ${motifMark(c.motif, accent, secondary)}
    <text x="50" y="96" text-anchor="middle" fill="${secondary}" font-size="14" font-family="Source Sans 3, Segoe UI, sans-serif" font-weight="700">${letters}</text>
  </svg>`;
}

function kitPattern(id, kit) {
  const p = kit.primary;
  const s = kit.secondary;
  if (kit.pattern === "stripes") {
    return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="${p}"/><rect width="6" height="12" fill="${s}"/></pattern>`;
  }
  if (kit.pattern === "hoops") {
    return `<pattern id="${id}" width="12" height="14" patternUnits="userSpaceOnUse">
      <rect width="12" height="14" fill="${p}"/><rect y="7" width="12" height="7" fill="${s}"/></pattern>`;
  }
  if (kit.pattern === "halves") {
    return `<pattern id="${id}" width="80" height="80" patternUnits="userSpaceOnUse">
      <rect width="40" height="80" fill="${p}"/><rect x="40" width="40" height="80" fill="${s}"/></pattern>`;
  }
  if (kit.pattern === "sash") {
    return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
      <rect width="40" height="40" fill="${p}"/><rect x="14" width="12" height="40" fill="${s}"/></pattern>`;
  }
  return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="${p}"/></pattern>`;
}

function kitSvg(kit, key) {
  const k = kit || {};
  const trim = k.trim || "#1b261f";
  const number = k.number || "10";
  const patId = `kitpat-${key}`;
  const cut = k.style === "retro" ? "M18 30 L6 46 L24 62 L24 126 L96 126 L96 62 L114 46 L102 30 L76 42 Q60 30 44 42 Z"
    : k.style === "modern" ? "M22 26 L10 40 L24 54 L26 126 L94 126 L96 54 L110 40 L98 26 L74 34 Q60 24 46 34 Z"
    : "M20 28 L8 42 L22 58 L22 128 L98 128 L98 58 L112 42 L100 28 L78 38 Q60 28 42 38 Z";
  return `<svg class="kit-svg" viewBox="0 0 120 140" role="img" aria-label="${key} kit">
    <defs>${kitPattern(patId, k)}</defs>
    <path d="${cut}" fill="url(#${patId})" stroke="${trim}" stroke-width="2.4"/>
    <path d="M42 30 Q60 42 78 30" fill="none" stroke="${trim}" stroke-width="3"/>
    <text x="60" y="88" text-anchor="middle" fill="${trim}" font-size="28" font-family="Source Sans 3, Segoe UI, sans-serif" font-weight="700">${number}</text>
  </svg>`;
}

function setHqPane(name) {
  hqPane = HQ_PANES.includes(name) ? name : "overview";
  HQ_PANES.forEach((pane) => {
    const el = document.getElementById(`hq-pane-${pane}`);
    if (el) {
      el.hidden = pane !== hqPane;
    }
  });
  document.querySelectorAll(".hq-subnav [data-hq]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.hq === hqPane);
  });
}

function readLookForm() {
  syncLookDraft();
  const crestPrimary = document.getElementById("crest-primary");
  if (crestPrimary) {
    lookDraft.crest.primary = crestPrimary.value;
    lookDraft.crest.secondary = document.getElementById("crest-secondary").value;
    lookDraft.crest.accent = document.getElementById("crest-accent").value;
    lookDraft.crest.motif = document.getElementById("crest-motif").value;
  }
  for (const def of KIT_DEFS) {
    const root = document.getElementById(`kit-card-${def.id}`);
    if (!root) {
      continue;
    }
    lookDraft.kits[def.id] = {
      primary: root.querySelector("[data-f=primary]").value,
      secondary: root.querySelector("[data-f=secondary]").value,
      trim: root.querySelector("[data-f=trim]").value,
      pattern: root.querySelector("[data-f=pattern]").value,
      style: root.querySelector("[data-f=style]").value,
      number: root.querySelector("[data-f=number]").value.replace(/\D/g, "").slice(0, 2) || "1",
    };
  }
}

function paintLookPreviews() {
  syncLookDraft();
  const short = club.shortName || "FC";
  const logo = document.getElementById("logo-preview");
  if (logo) {
    logo.innerHTML = crestSvg(lookDraft.crest, short);
  }
  const ovLogo = document.getElementById("ov-logo");
  if (ovLogo) {
    ovLogo.innerHTML = crestSvg(lookDraft.crest, short);
  }
  const nextKit = document.getElementById("ov-next-kit");
  if (nextKit && lookDraft.kits) {
    const kitKey = club.league?.nextMatch?.kit === "away" ? "away" : "home";
    nextKit.innerHTML = kitSvg(lookDraft.kits[kitKey], `next-${kitKey}`);
  }
  for (const def of KIT_DEFS) {
    const stage = document.getElementById(`kit-preview-${def.id}`);
    if (stage) {
      stage.innerHTML = kitSvg(lookDraft.kits[def.id], def.id);
    }
  }
}

function ensureKitStudio() {
  const studio = document.getElementById("kit-studio");
  if (!studio || studio.dataset.ready === "1") {
    return;
  }
  studio.innerHTML = KIT_DEFS.map(
    (def) => `<article class="glass-card kit-card" id="kit-card-${def.id}">
      <h3>${def.label}</h3>
      <div class="kit-preview" id="kit-preview-${def.id}"></div>
      <label>Primary <input data-f="primary" type="color" /></label>
      <label>Secondary <input data-f="secondary" type="color" /></label>
      <label>Trim <input data-f="trim" type="color" /></label>
      <label>Number <input data-f="number" type="text" maxlength="2" /></label>
      <label>Pattern
        <select data-f="pattern">
          <option value="solid">Solid</option>
          <option value="stripes">Stripes</option>
          <option value="hoops">Hoops</option>
          <option value="halves">Halves</option>
          <option value="sash">Sash</option>
        </select>
      </label>
      <label>Style
        <select data-f="style">
          <option value="classic">Classic</option>
          <option value="modern">Modern</option>
          <option value="retro">Retro</option>
        </select>
      </label>
    </article>`
  ).join("");
  studio.dataset.ready = "1";
  studio.addEventListener("input", () => {
    lookDirty = true;
    readLookForm();
    paintLookPreviews();
  });
}

function fillLookForm() {
  syncLookDraft();
  ensureKitStudio();
  const crest = lookDraft.crest;
  const p = document.getElementById("crest-primary");
  if (p && document.activeElement !== p) {
    p.value = crest.primary;
    document.getElementById("crest-secondary").value = crest.secondary;
    document.getElementById("crest-accent").value = crest.accent;
    document.getElementById("crest-motif").value = crest.motif;
  }
  for (const def of KIT_DEFS) {
    const kit = lookDraft.kits[def.id];
    const root = document.getElementById(`kit-card-${def.id}`);
    if (!root || !kit) {
      continue;
    }
    const focused = root.contains(document.activeElement);
    if (focused) {
      continue;
    }
    root.querySelector("[data-f=primary]").value = kit.primary;
    root.querySelector("[data-f=secondary]").value = kit.secondary;
    root.querySelector("[data-f=trim]").value = kit.trim;
    root.querySelector("[data-f=pattern]").value = kit.pattern;
    root.querySelector("[data-f=style]").value = kit.style;
    root.querySelector("[data-f=number]").value = kit.number;
  }
  paintLookPreviews();
}

function renderOverview() {
  document.getElementById("ov-name").textContent = club.shortName
    ? `${club.name} · ${club.shortName}`
    : club.name || "Your club";
  const morale = avgPlayerStat(club.players || [], "morale");
  document.getElementById("ov-morale-value").textContent = String(morale);
  const stad = club.stadium || {};
  const photo = document.getElementById("ov-stad-photo");
  photo.src = stadiumPhoto(stad.level);
  photo.alt = stad.name || "Home stadium";
  document.getElementById("ov-stad-caption").textContent = stad.name
    ? `${stad.name} · ${Number(stad.capacity || 0).toLocaleString()} capacity`
    : "Home stadium";

  const league = club.league || {};
  document.getElementById("ov-league-title").textContent = league.name
    ? `${league.name} · ${league.season}`
    : "League table";
  const body = document.querySelector("#ov-table tbody");
  body.innerHTML = "";
  for (const row of league.table || []) {
    const tr = document.createElement("tr");
    if (row.isUser) {
      tr.className = "is-user";
    }
    tr.innerHTML = `<td>${row.pos}</td><td></td><td>${row.played}</td><td>${row.won}</td>
      <td>${row.drawn}</td><td>${row.lost}</td><td>${row.gd}</td><td>${row.pts}</td>`;
    tr.querySelectorAll("td")[1].textContent = row.short ? `${row.name} (${row.short})` : row.name;
    body.append(tr);
  }

  const next = league.nextMatch;
  if (!next) {
    document.getElementById("ov-next-comp").textContent = "";
    document.getElementById("ov-next-vs").textContent = "No fixture scheduled.";
    document.getElementById("ov-next-meta").textContent = "";
    document.getElementById("ov-next-kit-label").textContent = "Match kit";
  } else {
    const when = new Date(next.kickoff);
    document.getElementById("ov-next-comp").textContent = next.competition;
    document.getElementById("ov-next-vs").textContent = next.home
      ? `${club.name} vs ${next.opponent}`
      : `${next.opponent} vs ${club.name}`;
    document.getElementById("ov-next-meta").textContent =
      `${next.home ? "Home" : "Away"} · ${next.venue} · ${when.toLocaleString()}`;
    document.getElementById("ov-next-kit-label").textContent =
      next.kit === "away" ? "Away kit" : "Home kit";
  }

  const squadEl = document.getElementById("ov-squad");
  squadEl.innerHTML = "";
  const squad = club.players || [];
  if (!squad.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No first-team players yet.";
    squadEl.append(empty);
  } else {
    const sorted = squad.slice().sort((a, b) => (a.position > b.position ? 1 : a.position < b.position ? -1 : b.rating - a.rating));
    for (const player of sorted) {
      const card = document.createElement("article");
      card.className = "ov-player";
      const pos = document.createElement("span");
      pos.className = `pos-badge pos-${player.position}`;
      pos.textContent = player.position;
      const name = document.createElement("strong");
      name.textContent = player.name;
      const meta = document.createElement("span");
      meta.textContent = `OVR ${player.rating} · ${lineupRole(player.id)}`;
      card.append(pos, name, meta);
      squadEl.append(card);
    }
  }
}

function renderClubOffice() {
  fillLookForm();
  renderOverview();
  setHqPane(hqPane);
}

function stadiumPhoto(level) {
  const n = Math.max(1, Math.min(10, Number(level) || 1));
  return `/stadium-level-${n}.png`;
}

function stadiumCapacityForLevel(level) {
  const n = Math.max(1, Math.min(10, Number(level) || 1));
  if (n === 1) {
    return 0;
  }
  if (n === 10) {
    return 100000;
  }
  return (n - 1) * 10000;
}

function setStadiumPane(name) {
  stadiumPane = name === "services" ? "services" : "capacity";
  const cap = document.getElementById("st-pane-capacity");
  const serv = document.getElementById("st-pane-services");
  if (cap) {
    cap.hidden = stadiumPane !== "capacity";
  }
  if (serv) {
    serv.hidden = stadiumPane !== "services";
  }
  document.querySelectorAll("[data-st]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.st === stadiumPane);
  });
}

function renderStadium() {
  const stad = club.stadium || {};
  const level = Math.max(1, Math.min(10, stad.level || 1));
  const cap = stadiumCapacityForLevel(level);
  document.getElementById("stad-level-label").textContent = `Level ${level} / 10`;
  document.getElementById("stad-cap").textContent =
    cap === 0 ? "0 spectators" : `${cap.toLocaleString()} spectators`;
  const photo = document.getElementById("stad-photo");
  photo.src = stadiumPhoto(level);
  photo.alt = `Level ${level} stadium, ${cap.toLocaleString()} spectators`;
  document.getElementById("stad-photo-cap").textContent =
    cap === 0 ? "Empty ground · no spectators" : `${cap.toLocaleString()} spectator capacity`;
  const btn = document.getElementById("stad-upgrade");
  if (level >= 10) {
    document.getElementById("stad-cap-meta").textContent = "Maximum capacity reached.";
    btn.hidden = true;
  } else {
    const next = level + 1;
    const nextCap = stadiumCapacityForLevel(next);
    const cost = 40 + level * 55;
    document.getElementById("stad-cap-meta").textContent =
      `Next: level ${next} · ${nextCap.toLocaleString()} spectators · ${cost} coins`;
    btn.hidden = false;
  }
  const grid = document.getElementById("stad-services");
  grid.innerHTML = "";
  const services = stad.services || {};
  for (const item of STADIUM_SERVICES) {
    const level = services[item.id] || 1;
    const card = document.createElement("article");
    card.className = "staff-card";
    const h = document.createElement("h4");
    h.textContent = item.name;
    const p = document.createElement("p");
    p.textContent = `${item.blurb} · Level ${level} / 5`;
    card.append(h, p);
    if (level < 5) {
      const cost = 30 + level * 35;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `Upgrade · ${cost} coins`;
      btn.addEventListener("click", () =>
        act("/api/stadium/service", { serviceId: item.id }).catch((error) => setStatus(error.message))
      );
      card.append(btn);
    }
    grid.append(card);
  }
  setStadiumPane(stadiumPane);
}

function renderCup() {
  const cup = club.cup || {};
  document.getElementById("cup-name").textContent = cup.name || "Regional Cup";
  document.getElementById("cup-round").textContent = cup.round || "Round of 32";
  document.getElementById("cup-record").textContent = `Cup record ${cup.wins || 0}–${cup.losses || 0}`;
}

function renderInbox() {
  const list = document.getElementById("inbox-list");
  list.innerHTML = "";
  const mail = club.inbox || [];
  const unread = mail.filter((note) => !note.read).length;
  const dot = document.getElementById("pm-dot");
  if (dot) {
    dot.hidden = unread === 0;
    dot.textContent = unread > 9 ? "9+" : String(unread);
  }
  if (!mail.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No messages yet.";
    list.append(empty);
    return;
  }
  for (const note of mail) {
    const article = document.createElement("article");
    article.className = note.read ? "mail-card" : "mail-card is-new";
    const h = document.createElement("h3");
    h.textContent = note.subject;
    const meta = document.createElement("p");
    meta.className = "hint";
    meta.textContent = `${note.from} · ${new Date(note.at).toLocaleString()}`;
    const body = document.createElement("p");
    body.textContent = note.body;
    article.append(h, meta, body);
    if (!note.read) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Mark read";
      btn.addEventListener("click", () =>
        act("/api/inbox/read", { id: note.id }).catch((error) => setStatus(error.message))
      );
      article.append(btn);
    }
    list.append(article);
  }
}

function renderStore() {
  const grid = document.getElementById("store-grid");
  grid.innerHTML = "";
  for (const item of STORE_CATALOG) {
    const card = document.createElement("article");
    card.className = "glass-card";
    const h = document.createElement("h3");
    h.textContent = item.name;
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = item.blurb;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Buy · $${item.cost}`;
    btn.addEventListener("click", () =>
      act("/api/store/buy", { itemId: item.id }).catch((error) => setStatus(error.message))
    );
    card.append(h, p, btn);
    grid.append(card);
  }
}

function renderOps() {
  document.getElementById("club-title").textContent = club.shortName
    ? `${club.name} · ${club.shortName}`
    : club.name;
  document.getElementById("manager-line").textContent = `Manager: ${club.managerName}`;
  document.getElementById("stat-funds").textContent = `${club.funds} coins`;
  document.getElementById("stat-skill").textContent = club.skill;
  document.getElementById("stat-fans").textContent = club.fans;
  document.getElementById("stat-record").textContent = `${club.wins}-${club.draws}-${club.losses}`;
  renderClubOffice();
  renderPitch();
  renderSubs();
  renderAssignGrid();
  renderRoster();
  renderMarket(document.getElementById("market-grid"), true);
  renderAcademy();
  renderStadium();
  renderCup();
  renderInbox();
  renderStore();
  renderPrizes(club.prizes || []);
  renderPlayers();
}

function setupComplete(data) {
  return Boolean(data && data.name && data.managerName);
}

function renderClub(data) {
  club = data;
  if (!club.lineup) {
    club.lineup = emptyLineup();
  }
  if (!setupComplete(data) || inSetupFlow) {
    setupPanel.hidden = false;
    if (setupShell) {
      setupShell.hidden = false;
    }
    clubWrap.hidden = true;
    document.body.classList.remove("is-dashboard");
    document.querySelector(".shell")?.classList.toggle("wide", inSetupFlow || setupStep === "squad");
    if (data.name) {
      clubNameInput.value = data.name;
      clubShortInput.value = data.shortName || shortFromName(data.name);
    }
    if (data.managerName) {
      managerNameInput.value = data.managerName;
    }
    if (inSetupFlow && setupComplete(data)) {
      showStep("squad");
    } else if (setupStep === "manager" || setupStep === "squad") {
      showStep(setupStep);
    } else {
      showStep("club");
    }
    return;
  }

  setupPanel.hidden = true;
  if (setupShell) {
    setupShell.hidden = true;
  }
  clubWrap.hidden = false;
  document.body.classList.add("is-dashboard");
  clubWrap.classList.add("board-in");
  renderOps();
  applyClubHash();
}

async function loadClub() {
  setStatus("Loading club…");
  const data = await request("/api/club");
  renderClub(data);
  setStatus(setupComplete(data) && !inSetupFlow ? "Match day operations are open." : "");
}

async function act(path, body) {
  const result = await request(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
  club = result.club;
  if (inSetupFlow) {
    renderMarket(document.getElementById("setup-market"), true);
    document.getElementById("squad-hint").textContent =
      `${(club.players || []).length} signed · funds $${club.funds}.`;
  } else if (setupComplete(club)) {
    setupPanel.hidden = true;
    if (setupShell) {
      setupShell.hidden = true;
    }
    clubWrap.hidden = false;
    document.body.classList.add("is-dashboard");
    renderOps();
  }
  setStatus(result.log || "Update saved.");
}

async function signPlayer(playerId) {
  try {
    await act("/api/club/sign", { playerId });
  } catch (error) {
    setStatus(error.message);
  }
}

async function academyAct(path, playerId) {
  try {
    await act(path, { playerId });
  } catch (error) {
    setStatus(error.message);
  }
}

function setMode(mode) {
  setupMode = mode;
  document.getElementById("mode-create").classList.toggle("is-on", mode === "create");
  document.getElementById("mode-select").classList.toggle("is-on", mode === "select");
  document.getElementById("create-block").hidden = mode !== "create";
  document.getElementById("select-block").hidden = mode !== "select";
}

function fillPresets() {
  nameGrid.innerHTML = "";
  for (const preset of PRESET_CLUBS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "name-card";
    const strong = document.createElement("strong");
    strong.textContent = preset.name;
    const span = document.createElement("span");
    span.textContent = preset.short;
    button.append(strong, span);
    button.addEventListener("click", () => {
      clubNameInput.value = preset.name;
      clubShortInput.value = preset.short;
      nameGrid.querySelectorAll(".name-card").forEach((card) => card.classList.remove("is-picked"));
      button.classList.add("is-picked");
      setMode("create");
    });
    nameGrid.append(button);
  }
}

function applyClubHash() {
  const name = (window.location.hash || "#club").replace("#", "") || "club";
  if (!DASH_TABS.includes(name)) {
    setTab("club", true);
    return;
  }
  if (clubWrap && !clubWrap.hidden) {
    setTab(name, true);
  }
}

function setTab(name, fromHash) {
  DASH_TABS.forEach((tab) => {
    const panel = document.getElementById(`tab-panel-${tab}`);
    if (panel) {
      panel.hidden = tab !== name;
    }
  });
  document.querySelectorAll(".dash-rail a[data-tab]").forEach((link) => {
    link.classList.toggle("is-on", link.dataset.tab === name);
  });
  if (!fromHash && DASH_TABS.includes(name)) {
    const next = `#${name}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }
  closeDashMenu();
}

function openDashMenu() {
  const rail = document.getElementById("dash-rail");
  const scrim = document.getElementById("dash-scrim");
  const toggle = document.getElementById("dash-toggle");
  rail?.classList.add("is-open");
  if (scrim) {
    scrim.hidden = false;
  }
  toggle?.setAttribute("aria-expanded", "true");
}

function closeDashMenu() {
  const rail = document.getElementById("dash-rail");
  const scrim = document.getElementById("dash-scrim");
  const toggle = document.getElementById("dash-toggle");
  rail?.classList.remove("is-open");
  if (scrim) {
    scrim.hidden = true;
  }
  toggle?.setAttribute("aria-expanded", "false");
}

async function sellPlayer(playerId) {
  try {
    await act("/api/club/sell", { playerId });
  } catch (error) {
    setStatus(error.message);
  }
}

window.onLanguageChange = function onLanguageChange() {
  if (club) {
    renderClub(club);
  }
};

initChrome();
fillPresets();

clubNameInput.addEventListener("input", () => {
  if (!clubShortInput.dataset.locked) {
    clubShortInput.value = shortFromName(clubNameInput.value);
  }
});
clubShortInput.addEventListener("input", () => {
  clubShortInput.dataset.locked = "1";
});

document.getElementById("mode-create").addEventListener("click", () => setMode("create"));
document.getElementById("mode-select").addEventListener("click", () => setMode("select"));
document.getElementById("to-manager").addEventListener("click", () => {
  const name = clubNameInput.value.trim();
  if (name.length < 3) {
    setStatus("Enter or select a club name of at least 3 characters.");
    return;
  }
  if (!clubShortInput.value.trim()) {
    clubShortInput.value = shortFromName(name);
  }
  inSetupFlow = true;
  setStatus("");
  showStep("manager");
});
document.getElementById("back-club").addEventListener("click", () => showStep("club"));
document.getElementById("back-manager").addEventListener("click", () => showStep("manager"));

async function saveManagerAndContinue() {
  const name = clubNameInput.value.trim();
  const shortName = clubShortInput.value.trim();
  const managerName = managerNameInput.value.trim();
  if (name.length < 3) {
    showStep("club");
    setStatus("Enter or select a club name of at least 3 characters.");
    return;
  }
  if (managerName.length < 2) {
    setStatus("Enter your manager name.");
    managerNameInput.focus();
    return;
  }
  try {
    const data = await request("/api/club", {
      method: "POST",
      body: JSON.stringify({ name, shortName, managerName }),
    });
    inSetupFlow = true;
    club = data;
    showStep("squad");
    document.getElementById("squad-hint").textContent =
      `${(club.players || []).length} signed · funds $${club.funds}.`;
    setStatus(`${data.name} is under ${data.managerName}. Now build the squad.`);
  } catch (error) {
    setStatus(error.message);
  }
}

document.getElementById("finish-setup").addEventListener("click", () => {
  saveManagerAndContinue();
});
managerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveManagerAndContinue();
  }
});

document.getElementById("to-board").addEventListener("click", () => {
  inSetupFlow = false;
  renderClub(club);
  setStatus("Set your starting XI, then open the academy when you are ready.");
});

document.getElementById("save-lineup").addEventListener("click", () => {
  act("/api/club/lineup", {
    lineup: {
      ...club.lineup,
      SUB: (club.lineup.SUB || []).filter(Boolean),
    },
  }).catch((error) => setStatus(error.message));
});

document.getElementById("train-btn")?.addEventListener("click", () => {
  act("/api/club/train").catch((error) => setStatus(error.message));
});
document.getElementById("recruit-btn")?.addEventListener("click", () => {
  act("/api/club/recruit").catch((error) => setStatus(error.message));
});
document.getElementById("match-btn")?.addEventListener("click", () => {
  act("/api/club/match").catch((error) => setStatus(error.message));
});
document.getElementById("youth-intake").addEventListener("click", () => {
  act("/api/academy/intake").catch((error) => setStatus(error.message));
});
document.querySelectorAll("[data-upgrade]").forEach((btn) => {
  btn.addEventListener("click", () => {
    act("/api/academy/upgrade", { field: btn.dataset.upgrade }).catch((error) => setStatus(error.message));
  });
});
document.querySelectorAll(".dash-rail a[data-tab]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setTab(link.dataset.tab);
  });
});
document.querySelectorAll("[data-pl]").forEach((btn) => {
  btn.addEventListener("click", () => setPlayersPane(btn.dataset.pl));
});
document.getElementById("pl-train-btn")?.addEventListener("click", () => {
  act("/api/players/train", {
    group: "first",
    focus: document.getElementById("pl-focus").value,
    playerId: document.getElementById("pl-individual").value || undefined,
  }).catch((error) => setStatus(error.message));
});
document.getElementById("pl-ac-train-btn")?.addEventListener("click", () => {
  act("/api/players/train", {
    group: "academy",
    focus: document.getElementById("pl-ac-focus").value,
  }).catch((error) => setStatus(error.message));
});
document.getElementById("dash-toggle")?.addEventListener("click", () => {
  const rail = document.getElementById("dash-rail");
  if (rail?.classList.contains("is-open")) {
    closeDashMenu();
  } else {
    openDashMenu();
  }
});
document.getElementById("dash-scrim")?.addEventListener("click", closeDashMenu);
document.getElementById("logout-btn")?.addEventListener("click", async () => {
  try {
    await request("/api/logout", { method: "POST" });
  } catch {
    // leave anyway
  }
  window.location.href = "/";
});
document.getElementById("rename-btn")?.addEventListener("click", () => {
  act("/api/club/rename", {
    name: document.getElementById("rename-club").value.trim(),
    shortName: document.getElementById("rename-short").value.trim(),
  }).catch((error) => setStatus(error.message));
});
function saveClubLook() {
  lookDirty = true;
  readLookForm();
  act("/api/club/look", {
    crest: lookDraft.crest,
    kits: lookDraft.kits,
  })
    .then(() => {
      lookDirty = false;
    })
    .catch((error) => setStatus(error.message));
}
document.getElementById("save-look")?.addEventListener("click", saveClubLook);
document.getElementById("save-kits")?.addEventListener("click", saveClubLook);
["crest-primary", "crest-secondary", "crest-accent", "crest-motif"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => {
    lookDirty = true;
    readLookForm();
    paintLookPreviews();
  });
});
document.querySelectorAll(".hq-subnav [data-hq]").forEach((btn) => {
  btn.addEventListener("click", () => setHqPane(btn.dataset.hq));
});
document.querySelectorAll("[data-st]").forEach((btn) => {
  btn.addEventListener("click", () => setStadiumPane(btn.dataset.st));
});
document.getElementById("stad-upgrade")?.addEventListener("click", () => {
  act("/api/stadium/upgrade").catch((error) => setStatus(error.message));
});
document.getElementById("stad-rename-btn")?.addEventListener("click", () => {
  act("/api/stadium/name", { name: document.getElementById("stad-rename").value.trim() }).catch((error) =>
    setStatus(error.message)
  );
});
document.getElementById("ticket-btn")?.addEventListener("click", () => {
  act("/api/stadium/tickets", { ticketPrice: Number(document.getElementById("ticket-price").value) }).catch((error) =>
    setStatus(error.message)
  );
});
document.getElementById("cup-play")?.addEventListener("click", () => {
  act("/api/cup/play").catch((error) => setStatus(error.message));
});
window.addEventListener("hashchange", applyClubHash);

request("/api/me")
  .then(() => loadClub())
  .catch((error) => {
    if (error.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    setStatus(error.message);
  });
