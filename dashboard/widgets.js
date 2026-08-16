/* =========================================================
   ATLAS — Trends Panel (News / Weather / YouTube / Social)

   API KEYS: put your own keys in NEWS_API_KEY / YOUTUBE_API_KEY
   below. Left empty, both cards fall back to mock data so the
   dashboard still renders cleanly. Weather uses Open-Meteo,
   which is free and needs no key at all.

   ⚠️ This is a public GitHub repo. Any key you put in this file
   is visible to anyone. NewsAPI/YouTube keys are usually low-risk
   to expose for a personal project (rate-limited, not billed),
   but never put a paid/billed API key directly in client JS.

   SUPABASE TABLE (run once):
   create table user_settings (
     id uuid primary key default gen_random_uuid(),
     setting_key text not null unique,
     location_mode text not null default 'PH',
     city text not null default 'Manila',
     updated_at timestamptz not null default now()
   );
========================================================= */

const NEWS_API_KEY = "";     // https://newsapi.org
const YOUTUBE_API_KEY = ""; // https://console.cloud.google.com (YouTube Data API v3)

const SETTINGS_ROW_KEY = "atlas_location"; // single-row upsert target, no auth in this app yet

const CITY_OPTIONS = {
  PH:   [{ name: "Manila", lat: 14.5995, lon: 120.9842 },
         { name: "Quezon City", lat: 14.6760, lon: 121.0437 },
         { name: "Cebu", lat: 10.3157, lon: 123.8854 },
         { name: "Davao", lat: 7.1907, lon: 125.4553 }],
  INTL: [{ name: "Tokyo", lat: 35.6762, lon: 139.6503 },
         { name: "New York", lat: 40.7128, lon: -74.0060 },
         { name: "London", lat: 51.5072, lon: -0.1276 },
         { name: "Singapore", lat: 1.3521, lon: 103.8198 }]
};

const WEATHER_CODES = {
  0: ["☀️", "Clear sky"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"], 48: ["🌫️", "Fog"],
  51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
  61: ["🌧️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
  71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"],
  80: ["🌦️", "Rain showers"], 81: ["🌧️", "Rain showers"], 82: ["⛈️", "Violent showers"],
  95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm + hail"], 99: ["⛈️", "Severe thunderstorm"]
};

let atlasSupabase = null;
try { atlasSupabase = typeof getAtlasSupabase === "function" ? getAtlasSupabase() : null; } catch { atlasSupabase = null; }

let state = { mode: "PH", city: "Manila" };

document.addEventListener("DOMContentLoaded", async () => {
  loadStateFromLocalStorage();
  await loadStateFromSupabase();   // Supabase wins if it has a value, keeps devices in sync
  renderToggle();
  renderCityOptions();
  refreshAll();

  document.getElementById("locationToggle").addEventListener("click", onToggleClick);
  document.getElementById("citySelect").addEventListener("change", onCityChange);
});

/* ---------------- state + sync ---------------- */

function loadStateFromLocalStorage() {
  try {
    const raw = localStorage.getItem("atlas_trends_location");
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {}
}

function saveStateToLocalStorage() {
  localStorage.setItem("atlas_trends_location", JSON.stringify(state));
}

async function loadStateFromSupabase() {
  if (!atlasSupabase) return;
  try {
    const { data, error } = await atlasSupabase
      .from("user_settings")
      .select("location_mode, city")
      .eq("setting_key", SETTINGS_ROW_KEY)
      .maybeSingle();
    if (!error && data) {
      state = { mode: data.location_mode, city: data.city };
      saveStateToLocalStorage();
    }
  } catch (err) {
    console.warn("Trends panel: could not load location from Supabase", err);
  }
}

async function saveStateToSupabase() {
  if (!atlasSupabase) return;
  try {
    await atlasSupabase.from("user_settings").upsert(
      { setting_key: SETTINGS_ROW_KEY, location_mode: state.mode, city: state.city, updated_at: new Date().toISOString() },
      { onConflict: "setting_key" }
    );
  } catch (err) {
    console.warn("Trends panel: could not sync location to Supabase", err);
  }
}

/* ---------------- toggle + city UI ---------------- */

function onToggleClick(e) {
  const btn = e.target.closest(".tp-toggle-btn");
  if (!btn) return;
  const mode = btn.dataset.mode;
  if (mode === state.mode) return;
  state.mode = mode;
  state.city = CITY_OPTIONS[mode][0].name;
  saveStateToLocalStorage();
  saveStateToSupabase();
  renderToggle();
  renderCityOptions();
  refreshAll();
}

function onCityChange(e) {
  state.city = e.target.value;
  saveStateToLocalStorage();
  saveStateToSupabase();
  loadWeather();
}

function renderToggle() {
  document.querySelectorAll(".tp-toggle-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === state.mode);
  });
}

function renderCityOptions() {
  const select = document.getElementById("citySelect");
  select.innerHTML = "";
  CITY_OPTIONS[state.mode].forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    if (c.name === state.city) opt.selected = true;
    select.appendChild(opt);
  });
  if (!CITY_OPTIONS[state.mode].find(c => c.name === state.city)) {
    state.city = CITY_OPTIONS[state.mode][0].name;
  }
}

function refreshAll() {
  loadWeather();
  loadNews();
  loadYouTubeTrends();
  loadSocialTrends();
}

/* ---------------- weather (Open-Meteo, free, no key) ---------------- */

async function loadWeather() {
  const body = document.getElementById("weatherBody");
  body.innerHTML = `<div class="tp-loading">Loading weather…</div>`;

  const city = CITY_OPTIONS[state.mode].find(c => c.name === state.city) || CITY_OPTIONS[state.mode][0];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("weather fetch failed");
    const data = await res.json();
    const cw = data.current_weather;
    const [icon, desc] = WEATHER_CODES[cw.weathercode] || ["🌡️", "Unknown"];

    body.innerHTML = `
      <div class="tp-weather-icon">${icon}</div>
      <div>
        <div class="tp-weather-temp">${Math.round(cw.temperature)}°C</div>
        <div class="tp-weather-desc">${desc} · ${city.name} · wind ${Math.round(cw.windspeed)} km/h</div>
      </div>`;
  } catch (err) {
    console.warn("Weather fetch failed, using fallback:", err);
    body.innerHTML = `
      <div class="tp-weather-icon">⛅</div>
      <div>
        <div class="tp-weather-temp">29°C</div>
        <div class="tp-weather-desc">Partly cloudy · ${city.name} (offline estimate)</div>
      </div>`;
  }
}

/* ---------------- news (NewsAPI if key set, else mock) ---------------- */

const MOCK_NEWS = {
  PH: [
    { title: "Peso holds steady as markets await central bank decision", source: "Reuters" },
    { title: "Metro Manila traffic scheme adjusted for holiday season", source: "Philippine Star" },
    { title: "Local tech startups see renewed investor interest", source: "Rappler" }
  ],
  INTL: [
    { title: "Global markets rally on cooling inflation data", source: "Bloomberg" },
    { title: "Major tech firms announce new AI infrastructure investment", source: "Reuters" },
    { title: "Climate summit sets new emissions targets", source: "AP" }
  ]
};

async function loadNews() {
  const list = document.getElementById("newsList");
  list.innerHTML = `<div class="tp-loading">Loading headlines…</div>`;

  if (!NEWS_API_KEY) {
    renderNews(MOCK_NEWS[state.mode]);
    return;
  }

  try {
    const query = state.mode === "PH" ? "country=ph" : "category=world&language=en";
    const url = `https://newsapi.org/v2/top-headlines?${query}&apiKey=${NEWS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("news fetch failed");
    const data = await res.json();
    renderNews((data.articles || []).slice(0, 6).map(a => ({ title: a.title, source: a.source?.name, url: a.url })));
  } catch (err) {
    console.warn("News fetch failed, using fallback:", err);
    renderNews(MOCK_NEWS[state.mode]);
  }
}

function renderNews(items) {
  const list = document.getElementById("newsList");
  list.innerHTML = items.map(a => `
    <a class="tp-list-item" href="${a.url || "#"}" target="_blank" rel="noopener">
      ${escapeHtml(a.title)}<span>${escapeHtml(a.source || "")}</span>
    </a>`).join("");
}

/* ---------------- YouTube trends (Data API v3 if key set, else mock) ---------------- */

const MOCK_YOUTUBE = {
  PH: [
    { title: "Top 10 street food spots in Manila", channel: "Pinoy Eats", thumb: "" },
    { title: "OPM playlist for late night drives", channel: "Music PH", thumb: "" },
    { title: "Latest phone comparison: budget kings", channel: "TechTayo", thumb: "" }
  ],
  INTL: [
    { title: "Inside the world's fastest data centers", channel: "The Verge", thumb: "" },
    { title: "Chart-topping single, official video", channel: "VEVO", thumb: "" },
    { title: "City guide: 24 hours in Tokyo", channel: "Wanderlust", thumb: "" }
  ]
};

async function loadYouTubeTrends() {
  const list = document.getElementById("youtubeList");
  list.innerHTML = `<div class="tp-loading">Loading trends…</div>`;

  if (!YOUTUBE_API_KEY) {
    renderYouTube(MOCK_YOUTUBE[state.mode]);
    return;
  }

  try {
    const region = state.mode === "PH" ? "PH" : "US";
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=${region}&maxResults=6&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("youtube fetch failed");
    const data = await res.json();
    renderYouTube((data.items || []).map(v => ({
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      thumb: v.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${v.id}`
    })));
  } catch (err) {
    console.warn("YouTube fetch failed, using fallback:", err);
    renderYouTube(MOCK_YOUTUBE[state.mode]);
  }
}

function renderYouTube(items) {
  const list = document.getElementById("youtubeList");
  list.innerHTML = items.map(v => `
    <a class="tp-yt-item" href="${v.url || "#"}" target="_blank" rel="noopener">
      <img src="${v.thumb || ""}" alt="" onerror="this.style.visibility='hidden'">
      <div>
        <div class="tp-yt-title">${escapeHtml(v.title)}</div>
        <div class="tp-yt-channel">${escapeHtml(v.channel || "")}</div>
      </div>
    </a>`).join("");
}

/* ---------------- social & web trends (mock — no reliable free API) ---------------- */

const MOCK_SOCIAL = {
  PH: ["#PHTraffic", "SONA2026", "Habagat update", "PBA playoffs", "Peso exchange rate", "OOTD"],
  INTL: ["#TechNews", "Market rally", "Climate summit", "New album drop", "Champions League", "AI regulation"]
};

async function loadSocialTrends() {
  const list = document.getElementById("socialList");
  list.innerHTML = `<div class="tp-loading">Loading trends…</div>`;
  // No stable free/keyless API for this exists yet — kept as curated mock data,
  // structured so a real source (e.g. a trends API) can replace MOCK_SOCIAL later.
  await new Promise(r => setTimeout(r, 200));
  list.innerHTML = MOCK_SOCIAL[state.mode].map(tag => `<span class="tp-tag">${escapeHtml(tag)}</span>`).join("");
}

/* ---------------- utils ---------------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}