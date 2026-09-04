import puppeteer from '@cloudflare/puppeteer';

const BOT_PATTERN =
  /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|redditbot|applebot|pinterest/i;

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h — lower this if your content changes more often

function isStaticAsset(pathname) {
  // Only render actual page navigations, not JS/CSS/image/etc. requests.
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const userAgent = request.headers.get('User-Agent') || '';
  const url = new URL(request.url);

  if (!BOT_PATTERN.test(userAgent) || isStaticAsset(url.pathname)) {
    return next();
  }

  const cacheKey = url.pathname + url.search;

  const cached = await env.PRERENDER_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { 'content-type': 'text/html; charset=UTF-8', 'x-prerender-cache': 'hit' },
    });
  }

  try {
    const browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();
    await page.goto(url.toString(), { waitUntil: 'networkidle0', timeout: 15000 });
    const html = await page.content();
    await browser.close();

    // Write to cache after responding — don't make the bot wait on it.
    context.waitUntil(
      env.PRERENDER_CACHE.put(cacheKey, html, { expirationTtl: CACHE_TTL_SECONDS })
    );

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=UTF-8', 'x-prerender-cache': 'miss' },
    });
  } catch (err) {
    // Never hard-fail a bot request — an unrendered SPA shell beats a 500.
    console.error('Render failed, falling back to normal SPA:', err.message);
    return next();
  }
}