const SEARCH_HISTORY_COOKIE = 'gtt_search_history';
const COOKIE_CONSENT_COOKIE = 'gtt_cookie_consent';
// Remembers that the user already granted (browser) location permission
// once, so the app doesn't call the geolocation prompt again on every
// visit. Same lifetime/expiry as cookie consent itself, since it's part of
// the same consent - if consent has to be given again, so does location.
const LOCATION_GRANTED_COOKIE = 'gtt_location_granted';
const MAX_HISTORY_ITEMS = 20;
const COOKIE_MAX_AGE_DAYS = 365;

// ── Device (localStorage) cache config ──────────────────────────────────
// Cookies are fine for small lists, but the caches below (nearby stops,
// search-box lookups, a signed-in user's full search history) can get
// larger than a cookie should hold, so they live in localStorage instead.
// Every device cache in this file (nearby stops, stop search, a signed-in
// user's search history mirror, stop photos, and the "seen the map before"
// flag) shares this one lifetime. NOTE: a 30-day TTL means a newly-added or
// newly-approved stop in an area you've already cached can take up to 30
// days to show up on this device unless the cache is cleared or the move
// threshold is crossed. That's a deliberate tradeoff for fewer DB calls.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const NEARBY_STOPS_CACHE_KEY = 'gtt_nearby_stops_cache';
const NEARBY_RADIUS_KM = 2;
const NEARBY_CACHE_TTL_MS = CACHE_TTL_MS;
// If the user has physically moved further than this from where the cache
// was captured, treat the cache as stale even if it hasn't expired yet.
const NEARBY_CACHE_MOVE_THRESHOLD_KM = 0.5;

const STOP_SEARCH_CACHE_KEY = 'gtt_stop_search_cache';
const STOP_SEARCH_CACHE_TTL_MS = CACHE_TTL_MS;
const STOP_SEARCH_CACHE_MAX_ENTRIES = 300;

const USER_SEARCH_HISTORY_CACHE_PREFIX = 'gtt_user_search_history_';
const USER_SEARCH_HISTORY_TTL_MS = CACHE_TTL_MS;

// ── Stop-photo cache config ──────────────────────────────────────────────
// Metadata (id/url/approved/mine) for each stop's photos, cached per stop id
// so reopening the app or panning back over the same stops doesn't re-hit
// the stop_images table. The actual photo bytes are NOT stored here (that
// would need IndexedDB/Cache API and can blow past localStorage's ~5MB
// limit fast) - browsers already cache the image bytes themselves once the
// <img>/background-image has loaded the URL once, so pair this with
// long Cache-Control headers on the storage bucket if you want the photos
// to render fully offline too.
const STOP_IMAGES_CACHE_KEY = 'gtt_stop_images_cache';
const STOP_IMAGES_CACHE_TTL_MS = CACHE_TTL_MS;
const STOP_IMAGES_CACHE_MAX_ENTRIES = 500;

// ── "Seen the map before" flag ───────────────────────────────────────────
// Lets the UI skip the "Loading map..." overlay on repeat visits within the
// cache window, since the user's already watched it load once on this device.
const MAP_SEEN_BEFORE_KEY = 'gtt_map_seen_before';
const MAP_SEEN_BEFORE_TTL_MS = CACHE_TTL_MS;

// ── Low-level cookie helpers ───────────────────────────────────────────

const setCookie = (name, value, days = COOKIE_MAX_AGE_DAYS) => {
  try {
    const maxAge = days * 24 * 60 * 60;
    const encoded = encodeURIComponent(value);
    document.cookie = `${name}=${encoded}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch (error) {
    console.error(`Error setting cookie "${name}":`, error);
  }
};

const getCookie = (name) => {
  try {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${name}=`));
    if (!match) return null;
    const value = match.substring(name.length + 1);
    return decodeURIComponent(value);
  } catch (error) {
    console.error(`Error reading cookie "${name}":`, error);
    return null;
  }
};

const deleteCookie = (name) => {
  try {
    document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
  } catch (error) {
    console.error(`Error deleting cookie "${name}":`, error);
  }
};

// ── Search history API ─────────────────────────────────────────────────

// Returns entries newest-first, each shaped like the rows returned by
// Supabase so the rest of the app can treat them interchangeably:
// { id, start_point, destination, searched_at }
export const getSearchHistoryFromCookie = () => {
  const raw = getCookie(SEARCH_HISTORY_COOKIE);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing search history cookie:', error);
    return [];
  }
};

const persistSearchHistory = (history) => {
  setCookie(SEARCH_HISTORY_COOKIE, JSON.stringify(history));
};

// Adds a new search to the front of the list, de-duping identical
// start/destination pairs and capping the list length.
export const addSearchToCookie = (startPoint, destination) => {
  const existing = getSearchHistoryFromCookie();

  const deduped = existing.filter(
    (item) => !(item.start_point === startPoint && item.destination === destination)
  );

  const newEntry = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    start_point: startPoint,
    destination: destination,
    searched_at: new Date().toISOString(),
  };

  const updated = [newEntry, ...deduped].slice(0, MAX_HISTORY_ITEMS);
  persistSearchHistory(updated);
  return updated;
};

export const deleteSearchFromCookie = (itemId) => {
  const existing = getSearchHistoryFromCookie();
  const updated = existing.filter((item) => item.id !== itemId);
  persistSearchHistory(updated);
  return updated;
};

export const clearSearchHistoryCookie = () => {
  deleteCookie(SEARCH_HISTORY_COOKIE);
  return [];
};

// ── Cookie consent API ─────────────────────────────────────────────────

// Returns true only if the user has explicitly accepted cookie use.
// There is no "declined" state stored - a decline is never persisted,
// so the consent prompt will simply reappear on next load/reload.
export const hasAcceptedCookies = () => {
  return getCookie(COOKIE_CONSENT_COOKIE) === 'accepted';
};

export const acceptCookieConsent = () => {
  setCookie(COOKIE_CONSENT_COOKIE, 'accepted');
};

// Wipes consent (and, since location permission was granted under that same
// consent, the "already granted location" flag along with it) - so a fresh
// accept also means the browser location prompt is fair game again.
export const clearCookieConsent = () => {
  deleteCookie(COOKIE_CONSENT_COOKIE);
  deleteCookie(LOCATION_GRANTED_COOKIE);
};

// ── Last-known-location cache ────────────────────────────────────────────
// Once geolocation permission has been granted, we cache the coordinates
// here so future visits can use them straight away without calling
// navigator.geolocation again at all - which is what actually guarantees
// the user is never "asked" a second time. Same 30-day lifetime as the
// rest of the device caches.
const LAST_LOCATION_CACHE_KEY = 'gtt_last_location_cache';
const LAST_LOCATION_CACHE_TTL_MS = CACHE_TTL_MS;

export const getCachedUserLocation = () => {
  const cached = readLocalJSON(LAST_LOCATION_CACHE_KEY);
  if (!cached || typeof cached.lat !== 'number' || typeof cached.lng !== 'number') return null;

  const age = Date.now() - (cached.cachedAt || 0);
  if (age > LAST_LOCATION_CACHE_TTL_MS) return null;

  return { lat: cached.lat, lng: cached.lng };
};

export const setCachedUserLocation = (coords) => {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;
  writeLocalJSON(LAST_LOCATION_CACHE_KEY, { lat: coords.lat, lng: coords.lng, cachedAt: Date.now() });
};

export const clearCachedUserLocation = () => {
  try {
    localStorage.removeItem(LAST_LOCATION_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing last-location cache:', error);
  }
};

// ── Location-permission-granted flag ─────────────────────────────────────
// True once the user has granted (browser) geolocation permission at least
// once under the current cookie consent. The app checks this before ever
// calling navigator.geolocation.getCurrentPosition again, so returning
// users aren't re-prompted every visit - only after cookie consent itself
// has to be given again.
export const hasGrantedLocationBefore = () => {
  return getCookie(LOCATION_GRANTED_COOKIE) === 'granted';
};

export const markLocationGranted = () => {
  setCookie(LOCATION_GRANTED_COOKIE, 'granted');
};

// ── Low-level localStorage helpers ──────────────────────────────────────

const readLocalJSON = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return null;
  }
};

const writeLocalJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing localStorage key "${key}":`, error);
  }
};

// Distance in km between two lat/lng points.
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ── Nearby-stops cache ───────────────────────────────────────────────────
// This cache holds stops for the last several "areas of interest" — the
// user's real location (2km around them, on load) AND wherever they've
// since panned the map to. Each region is stored with the center it was
// fetched around; a lookup for a given lat/lng reuses whichever cached
// region is still close enough and fresh enough, so panning back over
// somewhere already seen doesn't re-hit the DB.
const MAX_CACHED_REGIONS = 25;

export const getCachedNearbyStops = (lat, lng) => {
  const store = readLocalJSON(NEARBY_STOPS_CACHE_KEY);
  if (!store || !Array.isArray(store.regions)) return null;

  const now = Date.now();
  const region = store.regions.find((r) => {
    if (!r.center) return false;
    if (now - (r.cachedAt || 0) > NEARBY_CACHE_TTL_MS) return false;
    return haversineKm(lat, lng, r.center.lat, r.center.lng) <= NEARBY_CACHE_MOVE_THRESHOLD_KM;
  });

  return region ? region.stops : null;
};

export const setCachedNearbyStops = (lat, lng, stops) => {
  const store = readLocalJSON(NEARBY_STOPS_CACHE_KEY) || { regions: [] };
  if (!Array.isArray(store.regions)) store.regions = [];

  // Replace any existing region that already covers this spot rather than
  // stacking up duplicates.
  store.regions = store.regions.filter(
    (r) => !r.center || haversineKm(lat, lng, r.center.lat, r.center.lng) > NEARBY_CACHE_MOVE_THRESHOLD_KM
  );

  store.regions.push({ center: { lat, lng }, stops, cachedAt: Date.now() });

  // Keep only the most recently-seen regions.
  if (store.regions.length > MAX_CACHED_REGIONS) {
    store.regions.sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
    store.regions = store.regions.slice(0, MAX_CACHED_REGIONS);
  }

  writeLocalJSON(NEARBY_STOPS_CACHE_KEY, store);
};

export const clearCachedNearbyStops = () => {
  try {
    localStorage.removeItem(NEARBY_STOPS_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing nearby-stops cache:', error);
  }
};

// ── Stop-search (search modal) cache ────────────────────────────────────
// Every autocomplete lookup the user types in the start/destination search
// modal is cached locally by query text, so retyping (or reopening the app
// and typing the same thing again) is served from the device instead of
// hitting the `stops` table again.
const normalizeSearchQuery = (query) => query.trim().toLowerCase();

export const getCachedStopSearch = (query) => {
  const store = readLocalJSON(STOP_SEARCH_CACHE_KEY);
  if (!store || !store.entries) return null;

  const key = normalizeSearchQuery(query);
  const entry = store.entries[key];
  if (!entry) return null;

  const age = Date.now() - (entry.cachedAt || 0);
  if (age > STOP_SEARCH_CACHE_TTL_MS) return null;

  return entry.results;
};

export const setCachedStopSearch = (query, results) => {
  const store = readLocalJSON(STOP_SEARCH_CACHE_KEY) || { entries: {} };
  const key = normalizeSearchQuery(query);

  store.entries[key] = { results, cachedAt: Date.now() };

  // Cap the cache size — evict the oldest entries once we're over budget.
  const keys = Object.keys(store.entries);
  if (keys.length > STOP_SEARCH_CACHE_MAX_ENTRIES) {
    keys
      .sort((a, b) => (store.entries[a].cachedAt || 0) - (store.entries[b].cachedAt || 0))
      .slice(0, keys.length - STOP_SEARCH_CACHE_MAX_ENTRIES)
      .forEach((k) => delete store.entries[k]);
  }

  writeLocalJSON(STOP_SEARCH_CACHE_KEY, store);
};

// ── Signed-in user's search-history cache ───────────────────────────────
// Guests already get an on-device "recent searches" list via the cookie
// helpers above. Signed-in users' search history lives in Supabase (it
// needs to follow them across devices), but we still mirror the latest
// known list on this device so reopening the app can render instantly
// without waiting on a fresh DB round-trip. Writes (save/delete/clear)
// still go to Supabase as the source of truth and update this mirror to match.
export const getCachedUserSearchHistory = (userId) => {
  if (!userId) return null;
  const cached = readLocalJSON(`${USER_SEARCH_HISTORY_CACHE_PREFIX}${userId}`);
  if (!cached || !Array.isArray(cached.history)) return null;

  const age = Date.now() - (cached.cachedAt || 0);
  if (age > USER_SEARCH_HISTORY_TTL_MS) return null;

  return cached.history;
};

export const setCachedUserSearchHistory = (userId, history) => {
  if (!userId) return;
  writeLocalJSON(`${USER_SEARCH_HISTORY_CACHE_PREFIX}${userId}`, {
    history,
    cachedAt: Date.now(),
  });
};

// ── Stop-photo cache ─────────────────────────────────────────────────────
// Keyed by stop id → { images, cachedAt }. `images` is the same
// { id, url, approved, mine } shape the app already uses.
export const getCachedStopImages = (stopId) => {
  if (!stopId) return null;
  const store = readLocalJSON(STOP_IMAGES_CACHE_KEY);
  if (!store || !store.entries) return null;

  const entry = store.entries[stopId];
  if (!entry) return null;

  const age = Date.now() - (entry.cachedAt || 0);
  if (age > STOP_IMAGES_CACHE_TTL_MS) return null;

  return Array.isArray(entry.images) ? entry.images : null;
};

// Merges cached photo lists for a batch of stops in one write, so callers
// updating many stops after a single fetch don't hit localStorage repeatedly.
export const setCachedStopImagesBatch = (imagesByStopId) => {
  const store = readLocalJSON(STOP_IMAGES_CACHE_KEY) || { entries: {} };
  if (!store.entries) store.entries = {};

  const now = Date.now();
  Object.keys(imagesByStopId || {}).forEach((stopId) => {
    store.entries[stopId] = { images: imagesByStopId[stopId], cachedAt: now };
  });

  const keys = Object.keys(store.entries);
  if (keys.length > STOP_IMAGES_CACHE_MAX_ENTRIES) {
    keys
      .sort((a, b) => (store.entries[a].cachedAt || 0) - (store.entries[b].cachedAt || 0))
      .slice(0, keys.length - STOP_IMAGES_CACHE_MAX_ENTRIES)
      .forEach((k) => delete store.entries[k]);
  }

  writeLocalJSON(STOP_IMAGES_CACHE_KEY, store);
};

export const clearCachedStopImages = () => {
  try {
    localStorage.removeItem(STOP_IMAGES_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing stop-images cache:', error);
  }
};

// ── "Seen the map before" flag ───────────────────────────────────────────
// True once this device has successfully loaded the map once within the
// last 30 days. The map screen uses this to skip the loading overlay on
// repeat visits.
export const hasSeenMapBefore = () => {
  const store = readLocalJSON(MAP_SEEN_BEFORE_KEY);
  if (!store || !store.seenAt) return false;
  return Date.now() - store.seenAt <= MAP_SEEN_BEFORE_TTL_MS;
};

export const markMapSeenBefore = () => {
  writeLocalJSON(MAP_SEEN_BEFORE_KEY, { seenAt: Date.now() });
};

// ── Explore-drawer routes cache ─────────────────────────────────────────
// The Explore drawer (Popular Routes / Routes Around You / Locations
// Nearby) is all built from one batch of routes pulled from the `routes`
// table. That batch is mirrored here so reopening the drawer, or reloading
// the app entirely, doesn't have to re-run the join-heavy routes query
// every time. Unlike the other device caches in this file, freshness isn't
// left to the TTL alone - HomeScreen's realtime subscription calls
// clearCachedExploreRoutes() the moment the `routes`, `route_stops`, or
// `stops` tables change in the DB, so a newly-added route or stop shows up
// next time the drawer opens instead of waiting out the full cache window.
// The TTL below is just a safety net in case a realtime event is ever missed.
const EXPLORE_ROUTES_CACHE_KEY = 'gtt_explore_routes_cache';
const EXPLORE_ROUTES_CACHE_TTL_MS = CACHE_TTL_MS;

export const getCachedExploreRoutes = () => {
  const cached = readLocalJSON(EXPLORE_ROUTES_CACHE_KEY);
  if (!cached || !Array.isArray(cached.routes)) return null;

  const age = Date.now() - (cached.cachedAt || 0);
  if (age > EXPLORE_ROUTES_CACHE_TTL_MS) return null;

  return cached.routes;
};

export const setCachedExploreRoutes = (routes) => {
  if (!Array.isArray(routes)) return;
  writeLocalJSON(EXPLORE_ROUTES_CACHE_KEY, { routes, cachedAt: Date.now() });
};

// Called whenever the routes/stops data backing the Explore drawer has
// changed in the DB, so the next fetch skips the stale local copy.
export const clearCachedExploreRoutes = () => {
  try {
    localStorage.removeItem(EXPLORE_ROUTES_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing explore-routes cache:', error);
  }
};

export { haversineKm, NEARBY_RADIUS_KM, NEARBY_CACHE_MOVE_THRESHOLD_KM };