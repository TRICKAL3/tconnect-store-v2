/** Social apps / crawlers that need server-rendered Open Graph HTML (not the SPA shell). */
const CRAWLER_UA =
  /bot|crawl|spider|preview|facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot|applebot|wachat|embedly|quora link preview|outbrain|pinterest/i;

export const config = {
  matcher: '/blog/:slug',
};

export default async function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  if (!CRAWLER_UA.test(ua)) {
    return;
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (!match?.[1]) {
    return;
  }

  const slug = decodeURIComponent(match[1]);
  const ogUrl = new URL(`/api/og/blog/${encodeURIComponent(slug)}`, url.origin);
  return fetch(ogUrl.toString(), {
    headers: request.headers,
    method: request.method,
  });
}
