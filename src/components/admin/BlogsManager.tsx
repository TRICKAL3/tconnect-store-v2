import React, { useEffect, useState } from 'react';
import { getApiBase } from '../../lib/getApiBase';
import { supabase } from '../../lib/supabaseClient';

const API_BASE = getApiBase();

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  imageUrl1: string;
  imageUrl2: string;
  imageUrl3: string | null;
  published: boolean;
  createdAt: string;
}

interface Props {
  getAdminHeaders: () => Record<string, string>;
}

const emptyForm = {
  title: '',
  summary: '',
  content: '',
  imageUrl1: '',
  imageUrl2: '',
  imageUrl3: '',
  published: true,
};

const BlogsManager: React.FC<Props> = ({ getAdminHeaders }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile1, setImageFile1] = useState<File | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [imageFile3, setImageFile3] = useState<File | null>(null);

  const getApiCandidates = () => {
    const candidates = [API_BASE];
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      candidates.unshift('http://127.0.0.1:4001', 'http://localhost:4001');
    }
    return Array.from(new Set(candidates));
  };

  const load = async () => {
    setLoading(true);
    try {
      let loaded = false;
      for (const base of getApiCandidates()) {
        const res = await fetch(`${base}/blogs/all`, { headers: getAdminHeaders() as HeadersInit });
        if (!res.ok) continue;
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
        loaded = true;
        break;
      }
      if (!loaded) throw new Error('Failed to load from all API candidates');
    } catch (error) {
      console.error('Failed to load blogs:', error);
      alert('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile1(null);
    setImageFile2(null);
    setImageFile3(null);
  };

  const uploadBlogImage = async (file: File) => {
    const cleanName = file.name.replace(/\s+/g, '-');
    const fileName = `blogs/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanName}`;
    const { data, error } = await supabase.storage.from('products').upload(fileName, file, { upsert: false });
    if (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
    const { data: pub } = supabase.storage.from('products').getPublicUrl(data.path);
    return pub.publicUrl;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasImage1 = !!imageFile1 || !!form.imageUrl1.trim();
    const hasImage2 = !!imageFile2 || !!form.imageUrl2.trim();
    if (!form.title.trim() || !form.content.trim() || !hasImage1 || !hasImage2) {
      alert('Title, content, image 1 and image 2 are required (upload files or provide URLs)');
      return;
    }

    setSaving(true);
    try {
      const uploadedImage1 = imageFile1 ? await uploadBlogImage(imageFile1) : form.imageUrl1.trim();
      const uploadedImage2 = imageFile2 ? await uploadBlogImage(imageFile2) : form.imageUrl2.trim();
      const uploadedImage3 = imageFile3 ? await uploadBlogImage(imageFile3) : form.imageUrl3.trim();

      if (!uploadedImage1 || !uploadedImage2) {
        throw new Error('Please upload/select at least image 1 and image 2');
      }

      const method = editingId ? 'PUT' : 'POST';
      let saved = false;
      let lastError = 'Save failed';
      for (const base of getApiCandidates()) {
        const url = editingId ? `${base}/blogs/${editingId}` : `${base}/blogs`;
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(getAdminHeaders() as Record<string, string>),
          },
          body: JSON.stringify({
            title: form.title.trim(),
            summary: form.summary.trim() || null,
            content: form.content.trim(),
            imageUrl1: uploadedImage1,
            imageUrl2: uploadedImage2,
            imageUrl3: uploadedImage3 || null,
            published: !!form.published,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          saved = true;
          break;
        }
        lastError = data?.error || `Save failed (${res.status})`;
      }
      if (!saved) throw new Error(lastError);
      resetForm();
      await load();
    } catch (error: any) {
      console.error('Save blog failed:', error);
      alert(error.message || 'Failed to save blog post');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      summary: post.summary || '',
      content: post.content,
      imageUrl1: post.imageUrl1 || '',
      imageUrl2: post.imageUrl2 || '',
      imageUrl3: post.imageUrl3 || '',
      published: post.published,
    });
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this blog post?')) return;
    try {
      let deleted = false;
      let lastError = 'Delete failed';
      for (const base of getApiCandidates()) {
        const res = await fetch(`${base}/blogs/${id}`, {
          method: 'DELETE',
          headers: getAdminHeaders() as HeadersInit,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          deleted = true;
          break;
        }
        lastError = data?.error || `Delete failed (${res.status})`;
      }
      if (!deleted) throw new Error(lastError);
      await load();
    } catch (error: any) {
      alert(error.message || 'Failed to delete blog post');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card-dark p-4 rounded-xl border border-dark-border space-y-3">
        <h3 className="text-white font-bold">{editingId ? 'Edit Blog Post' : 'Create Blog Post'}</h3>
        <input
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-white"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <input
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-white"
          placeholder="Summary (optional)"
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
        />
        <textarea
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-white min-h-[160px]"
          placeholder="Blog content"
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        />
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Image 1 (required) - upload from PC</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-gray-300 text-sm"
            onChange={(e) => setImageFile1(e.target.files?.[0] || null)}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Image 2 (required) - upload from PC</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-gray-300 text-sm"
            onChange={(e) => setImageFile2(e.target.files?.[0] || null)}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Image 3 (optional) - upload from PC</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-gray-300 text-sm"
            onChange={(e) => setImageFile3(e.target.files?.[0] || null)}
          />
        </div>
        <input
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-white"
          placeholder="Image URL 1 (optional fallback)"
          value={form.imageUrl1}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl1: e.target.value }))}
        />
        <input
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-white"
          placeholder="Image URL 2 (optional fallback)"
          value={form.imageUrl2}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl2: e.target.value }))}
        />
        <input
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-white"
          placeholder="Image URL 3 (optional fallback)"
          value={form.imageUrl3}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl3: e.target.value }))}
        />
        <label className="inline-flex items-center gap-2 text-gray-300 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
          />
          Published
        </label>
        <div className="flex gap-2">
          <button className="btn-cyber px-4 py-2 rounded text-white" type="submit" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Post' : 'Create Post'}
          </button>
          {editingId && (
            <button type="button" className="px-4 py-2 rounded border border-dark-border text-gray-300" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        <h3 className="text-white font-bold">Blog Posts</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-gray-400">No blog posts yet.</div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="card-dark p-3 rounded border border-dark-border flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{post.title}</p>
                <p className="text-xs text-gray-400">/{post.slug} • {post.published ? 'Published' : 'Draft'}</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-neon-blue/20 text-neon-blue text-sm" onClick={() => startEdit(post)}>
                  Edit
                </button>
                <button className="px-3 py-1 rounded bg-red-500/20 text-red-400 text-sm" onClick={() => remove(post.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BlogsManager;

