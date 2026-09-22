const COUNTRY_CALENDARS = [
  { country: "Most countries", calendars: [["gregory", "Gregorian"]] },
  { country: "Saudi Arabia", calendars: [["islamic-umalqura", "Islamic (Umm al-Qura)"]] },
  { country: "United Arab Emirates", calendars: [["islamic-umalqura", "Islamic (Hijri)"]] },
  { country: "Egypt", calendars: [["islamic-civil", "Islamic (civil)"], ["coptic", "Coptic"]] },
  { country: "Iran", calendars: [["persian", "Persian (Solar Hijri)"]] },
  { country: "Afghanistan", calendars: [["persian", "Persian (Solar Hijri)"], ["islamic-umalqura", "Islamic (Hijri)"]] },
  { country: "Israel", calendars: [["hebrew", "Hebrew"]] },
  { country: "Thailand", calendars: [["buddhist", "Buddhist"]] },
  { country: "Cambodia", calendars: [["buddhist", "Buddhist"]] },
  { country: "Laos", calendars: [["buddhist", "Buddhist"]] },
  { country: "Myanmar", calendars: [["buddhist", "Buddhist"]] },
  { country: "Japan", calendars: [["japanese", "Japanese era"]] },
  { country: "China", calendars: [["chinese", "Chinese"]] },
  { country: "Taiwan", calendars: [["roc", "Minguo (ROC)"], ["chinese", "Chinese"]] },
  { country: "India", calendars: [["indian", "Indian National (Saka)"]] },
  { country: "South Korea", calendars: [["dangi", "Korean (Dangi)"]] },
  { country: "North Korea", calendars: [["dangi", "Korean (Dangi)"]] },
  { country: "Ethiopia", calendars: [["ethiopic", "Ethiopian"]] },
  { country: "Eritrea", calendars: [["ethiopic", "Ethiopian"]] },
  { country: "Eastern Orthodox churches", calendars: [["julian", "Julian"]] },
];

const CAL_KEY = "daylist-calendar";

function julianOffset(year) {
  if (year < 1700) return 10;
  if (year < 1800) return 11;
  if (year < 1900) return 12;
  if (year < 2100) return 13;
  return 14;
}

function formatGregorian(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    calendar: "gregory",
  }).format(date);
}

function formatSlimDate(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    calendar: "gregory",
  }).format(date);
}

function formatConverted(date, calendar, locale) {
  if (calendar === "gregory") {
    return "";
  }

  if (calendar === "julian") {
    const julian = new Date(date);
    julian.setDate(julian.getDate() - julianOffset(date.getFullYear()));
    return `${new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      calendar: "gregory",
    }).format(julian)} (Julian)`;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      calendar,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      calendar,
    }).format(date);
  }
}

function fillCalendarSelect(select) {
  select.innerHTML = "";
  for (const { country, calendars } of COUNTRY_CALENDARS) {
    const group = document.createElement("optgroup");
    group.label = country;
    for (const [id, label] of calendars) {
      const option = document.createElement("option");
      option.value = `${id}|${country}`;
      option.textContent = label;
      group.append(option);
    }
    select.append(group);
  }
}
