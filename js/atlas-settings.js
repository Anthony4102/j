/* =========================================================
   ATLAS — shared settings store
   One localStorage key, read/written from anywhere.
   Include this on every page that needs theme/name/currency.
========================================================= */

const ATLAS_SETTINGS_KEY = "atlas_settings";

const ATLAS_DEFAULT_SETTINGS = {
  theme: "light",       // "light" | "dark"
  name: "",             // shown in greetings, empty = no name used
  currency: "PHP",      // "PHP" | "USD" | "EUR"
  hiddenTools: []        // array of tool ids, e.g. ["notes","goals"]
};

function getAtlasSettings() {
  try {
    const raw = localStorage.getItem(ATLAS_SETTINGS_KEY);
    return raw ? { ...ATLAS_DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...ATLAS_DEFAULT_SETTINGS };
  } catch {
    return { ...ATLAS_DEFAULT_SETTINGS };
  }
}

function saveAtlasSettings(partial) {
  const next = { ...getAtlasSettings(), ...partial };
  localStorage.setItem(ATLAS_SETTINGS_KEY, JSON.stringify(next));
  applyAtlasTheme(next.theme);
  return next;
}

function applyAtlasTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
}

function formatAtlasCurrency(value, currencyOverride) {
  const currency = currencyOverride || getAtlasSettings().currency || "PHP";
  const locale = currency === "PHP" ? "en-PH" : currency === "EUR" ? "de-DE" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

// Apply theme immediately, before first paint where possible.
applyAtlasTheme(getAtlasSettings().theme);