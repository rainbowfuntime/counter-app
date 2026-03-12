const KEYS = {
  overrides: 'cc_overrides',
  customEntries: 'cc_custom_entries',
  stubs: 'cc_stubs',
  festivalFavorites: 'cc_festival_favorites',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadOverrides() {
  return read(KEYS.overrides, {});
}

export function saveOverrides(value) {
  write(KEYS.overrides, value);
}

export function loadCustomEntries() {
  return read(KEYS.customEntries, []);
}

export function saveCustomEntries(value) {
  write(KEYS.customEntries, value);
}

export function loadStubs() {
  return read(KEYS.stubs, {});
}

export function saveStubs(value) {
  write(KEYS.stubs, value);
}

export function loadFestivalFavorites() {
  return read(KEYS.festivalFavorites, {});
}

export function saveFestivalFavorites(value) {
  write(KEYS.festivalFavorites, value);
}
