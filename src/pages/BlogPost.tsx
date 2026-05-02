import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiBase } from '../lib/getApiBase';

interface Post {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  imageUrl1: string;
  imageUrl2: string;
  imageUrl3: string | null;
  createdAt: string;
}

const BlogPost: React.FC = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);
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
          const res = await fetch(`${base}/blogs/${slug}`);
          if (!res.ok) continue;
          const data = await res.json();
          setPost(data);
          loaded = true;
          break;
        }
        if (!loaded) setPost(null);
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    };
    if (slug) run();
  }, [slug]);

  if (loading) return <div className="min-h-screen bg-dark-bg text-gray-300 p-8">Loading...</div>;
  if (!post) return <div className="min-h-screen bg-dark-bg text-gray-300 p-8">Post not found.</div>;

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/blog" className="text-neon-blue hover:text-white text-sm">← Back to blog</Link>
        <h1 className="text-3xl font-bold text-white mt-3 mb-2">{post.title}</h1>
        <p className="text-xs text-gray-400 mb-5">{new Date(post.createdAt).toLocaleDateString()}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <img src={post.imageUrl1} alt={post.title} className="w-full h-64 object-cover rounded-lg" />
          <img src={post.imageUrl2} alt={post.title} className="w-full h-64 object-cover rounded-lg" />
          {post.imageUrl3 && <img src={post.imageUrl3} alt={post.title} className="w-full h-64 object-cover rounded-lg md:col-span-2" />}
        </div>
        {post.summary && <p className="text-gray-300 mb-4 italic">{post.summary}</p>}
        <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">{post.content}</div>
      </div>
    </div>
  );
};

export default BlogPost;

