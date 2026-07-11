const SEARCH_HISTORY_COOKIE = 'gtt_search_history';
const MAX_HISTORY_ITEMS = 20;
const COOKIE_MAX_AGE_DAYS = 365;

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