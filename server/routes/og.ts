import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://www.tconnect.store';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toAbsoluteImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl?.trim()) return null;
  const trimmed = imageUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `${SITE_URL}${trimmed}`;
  return `${SITE_URL}/${trimmed}`;
}

/** HTML with Open Graph / Twitter meta for social crawlers (WhatsApp, Facebook, X, Telegram). */
router.get('/blog/:slug', async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post || !post.published) {
      return res.status(404).send('Post not found');
    }

    const title = escapeHtml(post.title);
    const description = escapeHtml((post.summary || post.content || '').trim().slice(0, 200));
    const image = toAbsoluteImageUrl(post.imageUrl1) || `${SITE_URL}/tconnect_logo-removebg-preview.png`;
    const url = `${SITE_URL}/blog/${post.slug}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} | TConnect Store</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="TConnect Store" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:secure_url" content="${image}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body>
  <p><a href="${url}">${title}</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(html);
  } catch (error: any) {
    console.error('OG blog render failed:', error);
    return res.status(500).send('Error');
  }
});

export default router;
