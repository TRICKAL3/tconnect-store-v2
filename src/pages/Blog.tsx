import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiBase } from '../lib/getApiBase';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  imageUrl1: string;
  createdAt: string;
}

const Blog: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const candidates =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? ['http://127.0.0.1:4001', 'http://localhost:4001', getApiBase()]
          : [getApiBase()];
      try {
        let loaded = false;
        for (const base of candidates) {
          const res = await fetch(`${base}/blogs`);
          if (!res.ok) continue;
          const data = await res.json();
          setPosts(Array.isArray(data) ? data : []);
          loaded = true;
          break;
        }
        if (!loaded) setPosts([]);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Blog</h1>
        {loading ? (
          <p className="text-gray-400">Loading posts...</p>
        ) : posts.length === 0 ? (
          <p className="text-gray-400">No blog posts available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="card-dark rounded-xl overflow-hidden border border-dark-border hover:border-neon-blue/50">
                <img src={post.imageUrl1} alt={post.title} className="w-full h-44 object-cover" />
                <div className="p-4">
                  <h2 className="text-white font-bold text-lg mb-1">{post.title}</h2>
                  <p className="text-xs text-gray-400 mb-2">{new Date(post.createdAt).toLocaleDateString()}</p>
                  <p className="text-gray-300 text-sm line-clamp-3">{post.summary || post.content}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;

