import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

function makeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

router.get('/', async (_req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load blog posts' });
  }
});

router.get('/all', basicAdminAuth, async (_req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load blog posts' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post || !post.published) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load blog post' });
  }
});

router.post('/', basicAdminAuth, async (req, res) => {
  try {
    const {
      title,
      summary,
      content,
      imageUrl1,
      imageUrl2,
      imageUrl3,
      published = true,
    } = req.body || {};

    if (!title || !content || !imageUrl1 || !imageUrl2) {
      return res.status(400).json({ error: 'title, content, imageUrl1 and imageUrl2 are required' });
    }

    const baseSlug = makeSlug(String(title));
    let slug = baseSlug || `blog-${Date.now()}`;
    let count = 1;
    while (await prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count++}`;
    }

    const created = await prisma.blogPost.create({
      data: {
        title: String(title),
        slug,
        summary: summary ? String(summary) : null,
        content: String(content),
        imageUrl1: String(imageUrl1),
        imageUrl2: String(imageUrl2),
        imageUrl3: imageUrl3 ? String(imageUrl3) : null,
        published: !!published,
      },
    });

    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create blog post' });
  }
});

router.put('/:id', basicAdminAuth, async (req, res) => {
  try {
    const {
      title,
      summary,
      content,
      imageUrl1,
      imageUrl2,
      imageUrl3,
      published,
    } = req.body || {};

    const updated = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        title: title ? String(title) : undefined,
        summary: summary !== undefined ? (summary ? String(summary) : null) : undefined,
        content: content ? String(content) : undefined,
        imageUrl1: imageUrl1 ? String(imageUrl1) : undefined,
        imageUrl2: imageUrl2 ? String(imageUrl2) : undefined,
        imageUrl3: imageUrl3 !== undefined ? (imageUrl3 ? String(imageUrl3) : null) : undefined,
        published: published !== undefined ? !!published : undefined,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update blog post' });
  }
});

router.delete('/:id', basicAdminAuth, async (req, res) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete blog post' });
  }
});

export default router;

