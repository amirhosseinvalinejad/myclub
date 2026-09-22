const LANG_KEY = "daylist-lang";

function applyStaticCopy() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = t(el.dataset.i18n);
    if (value && value !== el.dataset.i18n) {
      el.textContent = value;
    }
  });
  const clubNameInput = document.getElementById("club-name");
  if (clubNameInput) {
    const placeholder = t("clubPlaceholder");
    if (placeholder && placeholder !== "clubPlaceholder") {
      clubNameInput.placeholder = placeholder;
    }
  }
  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) {
    const title = t(titleEl.dataset.i18n);
    if (title && title !== titleEl.dataset.i18n) {
      document.title = title;
    }
  }
  updateDates();
}

function applyLanguage(code) {
  const lang = code || "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  localStorage.setItem(LANG_KEY, lang);
  applyStaticCopy();
  if (typeof window.onLanguageChange === "function") {
    window.onLanguageChange();
  }
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
  return (calendarSelect.value || "gregory|Most countries").split("|")[0];
}

function updateDates() {
  const gregorianDateEl = document.getElementById("gregorian-date");
  const convertedDateEl = document.getElementById("converted-date");
  if (!gregorianDateEl) {
    return;
  }
  const now = new Date();
  const locale = currentLocale();
  gregorianDateEl.dateTime = now.toISOString().slice(0, 10);
  const slim = document.body.classList.contains("landing-page");
  gregorianDateEl.textContent = slim ? formatSlimDate(now, locale) : formatGregorian(now, locale);

  if (convertedDateEl) {
    const converted = formatConverted(now, currentCalendar(), locale);
    convertedDateEl.textContent = converted;
    convertedDateEl.hidden = !converted;
  }
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
}
