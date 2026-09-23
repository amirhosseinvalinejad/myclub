const LANG_KEY = "daylist-lang";

function applyStaticCopy() {
  document.querySelectorAll("[data-i18n]").forEach((el) => applyI18nElement(el));
  const clubNameInput = document.getElementById("club-name");
  if (clubNameInput) {
    clubNameInput.placeholder = t("clubPlaceholder");
  }
  const managerInput = document.getElementById("manager-name");
  if (managerInput) {
    managerInput.placeholder = t("managerPlaceholder");
  }
  updateDates();
}

async function applyLanguage(code) {
  const lang = code || "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  localStorage.setItem(LANG_KEY, lang);
  const picker = document.getElementById("language-select");
  if (picker) {
    picker.disabled = true;
  }
  const refresh = () => {
    applyStaticCopy();
    if (typeof window.onLanguageChange === "function") {
      window.onLanguageChange();
    }
  };
  refresh();
  try {
    await ensureTranslations(lang, refresh);
  } finally {
    if (picker) {
      picker.disabled = false;
    }
  }
  refresh();
}

function fillLanguageSelect() {
  const languageSelect = document.getElementById("language-select");
  languageSelect.innerHTML = "";
  for (const { country, languages } of COUNTRY_LANGUAGES) {
    const group = document.createElement("optgroup");
    group.label = country;
    for (const [code, native, name] of languages) {
      const option = document.createElement("option");
      option.value = `${code}|${country}`;
      option.textContent = native === name ? native : `${native} · ${name}`;
      group.append(option);
    }
    languageSelect.append(group);
  }
}

function restoreLanguage() {
  const languageSelect = document.getElementById("language-select");
  const saved = localStorage.getItem(LANG_KEY) || "en";
  const match = [...languageSelect.options].find((option) =>
    option.value.startsWith(`${saved}|`)
  );
  languageSelect.value = match ? match.value : "en|United States";
  applyLanguage(languageSelect.value.split("|")[0]);
}

function currentLocale() {
  return document.documentElement.lang || "en";
}

function currentCalendar() {
  const calendarSelect = document.getElementById("calendar-select");
  if (!calendarSelect) {
    return "gregory";
  }
  return (calendarSelect.value || "gregory|Most countries").split("|")[0];
}

function startOfLocalDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function renderDateStrip() {
  const root = document.getElementById("date-strip");
  if (!root) {
    return;
  }
  const locale = currentLocale();
  const today = startOfLocalDay(new Date());
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const fullFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  root.setAttribute("aria-label", t("dateStripLabel"));
  root.replaceChildren();
  for (let offset = -10; offset <= 10; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    const cell = document.createElement("div");
    cell.className = "date-strip-day";
    cell.setAttribute("role", "listitem");
    cell.title = fullFmt.format(day);
    if (offset === -1) {
      cell.classList.add("is-yesterday");
    }
    if (offset === 0) {
      cell.classList.add("is-today");
      cell.setAttribute("aria-current", "date");
    }
    if (offset === 1) {
      cell.classList.add("is-tomorrow");
    }
    const relKey = offset === -1 ? "yesterdayLabel" : offset === 0 ? "todayLabel" : offset === 1 ? "tomorrowLabel" : "";
    if (relKey) {
      const mark = document.createElement("span");
      mark.className = "date-strip-rel";
      mark.textContent = t(relKey);
      cell.append(mark);
    }
    const dateEl = document.createElement("span");
    dateEl.className = "date-strip-date";
    dateEl.textContent = dateFmt.format(day);
    const weekEl = document.createElement("span");
    weekEl.className = "date-strip-week";
    weekEl.textContent = weekdayFmt.format(day);
    cell.append(dateEl, weekEl);
    root.append(cell);
  }
  const todayCell = root.querySelector(".is-today");
  if (todayCell) {
    const left = todayCell.offsetLeft - root.clientWidth / 2 + todayCell.offsetWidth / 2;
    root.scrollLeft = Math.max(0, left);
  }
}

function scheduleDateRollover() {
  if (scheduleDateRollover.timer) {
    window.clearTimeout(scheduleDateRollover.timer);
  }
  const now = new Date();
  const next = startOfLocalDay(now);
  next.setDate(next.getDate() + 1);
  next.setMinutes(next.getMinutes() + 1);
  scheduleDateRollover.timer = window.setTimeout(() => {
    updateDates();
    scheduleDateRollover();
  }, Math.max(1000, next.getTime() - now.getTime()));
}

function updateDates() {
  const now = new Date();
  const locale = currentLocale();
  const gregorianDateEl = document.getElementById("gregorian-date");
  const convertedDateEl = document.getElementById("converted-date");
  if (gregorianDateEl) {
    gregorianDateEl.dateTime = now.toISOString().slice(0, 10);
    const slim = Boolean(document.querySelector(".glass-topbar"));
    gregorianDateEl.textContent = slim ? formatSlimDate(now, locale) : formatGregorian(now, locale);
  }
  if (convertedDateEl) {
    const converted = formatConverted(now, currentCalendar(), locale);
    convertedDateEl.textContent = converted;
    convertedDateEl.hidden = !converted;
  }
  renderDateStrip();
}

function restoreCalendar() {
  const calendarSelect = document.getElementById("calendar-select");
  if (!calendarSelect) {
    return;
  }
  const saved = localStorage.getItem(CAL_KEY) || "gregory";
  const match = [...calendarSelect.options].find((option) =>
    option.value.startsWith(`${saved}|`)
  );
  calendarSelect.value = match ? match.value : "gregory|Most countries";
  updateDates();
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = t("failed");
    try {
      const body = await response.json();
      message = translateServerError(body.error || message);
    } catch {
      // keep default
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function currentPath() {
  return (window.location.pathname || "/").replace(/\\/g, "/");
}

function isPublicSurface() {
  const path = currentPath();
  return (
    path === "/" ||
    /\/(index|login|create|forgot|reset)\.html$/.test(path)
  );
}

function initChrome() {
  if (isPublicSurface()) {
    document.body.classList.add("is-public");
  }
  const languageSelect = document.getElementById("language-select");
  const calendarSelect = document.getElementById("calendar-select");
  if (languageSelect) {
    fillLanguageSelect();
    restoreLanguage();
    languageSelect.addEventListener("change", () => {
      applyLanguage(languageSelect.value.split("|")[0]);
    });
  }
  if (calendarSelect) {
    fillCalendarSelect(calendarSelect);
    restoreCalendar();
    calendarSelect.addEventListener("change", () => {
      localStorage.setItem(CAL_KEY, currentCalendar());
      updateDates();
    });
  }
  scheduleDateRollover();
}
