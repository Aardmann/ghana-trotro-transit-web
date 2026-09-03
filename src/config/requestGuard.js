// requestGuard.js
//
// A general-purpose, client-side request limiter for the Supabase client.
// It wraps the `fetch` the client uses internally, so it applies to
// EVERY request the app makes through `supabase` — REST queries
// (.from()), storage, and auth — without having to touch each call site.
//
// What it does:
//   1. Sliding-window rate limit: at most `maxRequests` calls inside any
//      `windowMs` window. Calls beyond that are queued (delayed) rather
//      than fired immediately.
//   2. Queue cap: if too many calls are already waiting their turn, new
//      ones fail fast with a clear error instead of piling up forever.
//   3. GET de-dupe: identical concurrent GET requests (e.g. two effects
//      both asking for the same stop_images query at once) share a
//      single network call instead of firing twice.
//   4. 429 backoff: if Supabase itself ever responds with 429, the guard
//      pauses all further requests for a short cooldown so the whole app
//      backs off together, not just the one call that got throttled.
//
// -----------------------------------------------------------------------
// IMPORTANT — this is UX protection, not security.
// -----------------------------------------------------------------------
// This code runs in the user's browser and only limits requests made by
// *this app's own client code*. Because Supabase calls use the public
// anon key, anyone can call the same REST endpoints directly (curl,
// Postman, a modified copy of the app) and this file does nothing to
// stop them — client-side limits are trivially bypassed by definition.
//
// This is a reasonable first step ("stop a normal user's map-panning or
// double-tapping from hammering the DB"). For real protection against a
// bad actor calling the API directly, later add server-side controls:
//   - Supabase project settings → rate limiting (per-IP / per-key)
//   - Row Level Security policies scoping what each request can touch
//   - A Postgres function / Edge Function that enforces per-user quotas
//     and put the client behind that instead of raw table access
// None of that requires removing this file — the two layers complement
// each other.

const DEFAULTS = {
  maxRequests: 20, // requests allowed inside the window
  windowMs: 10000, // window size, ms
  maxQueueSize: 15, // requests allowed to wait before we start rejecting
  dedupeGetRequests: true, // collapse identical concurrent GET calls
  cooldownMs: 5000, // pause length after a 429 from Supabase
  onLimited: null, // optional callback({ type, url, delay }) for UI feedback
};

/**
 * Creates a rate-limited fetch function to pass as `global.fetch` when
 * creating the Supabase client.
 *
 * @param {Partial<typeof DEFAULTS>} userOptions
 * @returns {typeof fetch}
 */
export function createGuardedFetch(userOptions = {}) {
  const options = { ...DEFAULTS, ...userOptions };
  const baseFetch = typeof fetch !== 'undefined' ? fetch.bind(window) : null;
  if (!baseFetch) {
    throw new Error('createGuardedFetch: no global fetch available in this environment');
  }

  let timestamps = []; // request start times inside the current window
  let queueLength = 0;
  let cooldownUntil = 0;
  const inFlight = new Map(); // dedupe key -> shared in-flight promise

  function pruneWindow() {
    const cutoff = Date.now() - options.windowMs;
    while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();
  }

  function nextSlotDelay() {
    pruneWindow();
    if (timestamps.length < options.maxRequests) return 0;
    return Math.max(0, timestamps[0] + options.windowMs - Date.now());
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function dedupeKey(url, init) {
    const method = (init && init.method) || 'GET';
    if (method !== 'GET') return null; // only safe to share reads
    return method + ' ' + url;
  }

  async function guardedFetch(url, init) {
    const now = Date.now();
    if (now < cooldownUntil) {
      await wait(cooldownUntil - now);
    }

    const key = options.dedupeGetRequests ? dedupeKey(url, init) : null;
    if (key && inFlight.has(key)) {
      // Piggyback on the in-flight request instead of firing a new one.
      // Clone the response so each caller gets its own readable body.
      const shared = await inFlight.get(key);
      return shared.clone();
    }

    const delay = nextSlotDelay();
    if (delay > 0) {
      if (queueLength >= options.maxQueueSize) {
        if (options.onLimited) options.onLimited({ type: 'dropped', url });
        throw new Error('Too many requests right now — please try again in a moment.');
      }
      queueLength++;
      if (options.onLimited) options.onLimited({ type: 'queued', url, delay });
      await wait(delay);
      queueLength--;
    }

    pruneWindow();
    timestamps.push(Date.now());

    const runRequest = async () => {
      const response = await baseFetch(url, init);
      if (response.status === 429) {
        cooldownUntil = Date.now() + options.cooldownMs;
        if (options.onLimited) options.onLimited({ type: 'backoff', url });
      }
      return response;
    };

    if (key) {
      const promise = runRequest();
      inFlight.set(key, promise);
      try {
        const response = await promise;
        return response.clone();
      } finally {
        inFlight.delete(key);
      }
    }

    return runRequest();
  }

  return guardedFetch;
}