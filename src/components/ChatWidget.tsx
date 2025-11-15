import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getApiBase } from '../lib/getApiBase';

const API_BASE = getApiBase();

interface ChatMessage {
  id: string;
  senderType: 'bot' | 'user' | 'agent';
  senderName: string | null;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
}

interface Chat {
  id: string;
  status: 'bot' | 'waiting' | 'active' | 'closed';
  messages: ChatMessage[];
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showNameForm, setShowNameForm] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { user, loading: authLoading } = useAuth();

  // Auto-fill name and email from auth context if available
  useEffect(() => {
    if (user && !name && !email) {
      if (user.name) setName(user.name);
      if (user.email) setEmail(user.email);
      // If user is logged in, skip the name form
      if (user.name && user.email) {
        setShowNameForm(false);
      }
    }
  }, [user, name, email]);

  // Auto-initialize chat when widget opens if user is logged in
  useEffect(() => {
    if (isOpen && !chat && !showNameForm && (user?.name || name) && !loading && !authLoading) {
      console.log('🚀 [ChatWidget] Auto-initializing chat for logged-in user');
      initializeChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chat, showNameForm, user, name, loading, authLoading]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  // Poll for new messages when chat is open
  useEffect(() => {
    if (!isOpen || !chat) return;

    const chatId = chat.id;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/chats/${chatId}`);
        if (res.ok) {
          const updatedChat = await res.json();
          setChat(updatedChat);
        }
      } catch (error) {
        console.error('Failed to poll chat:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [isOpen, chat]);

  const initializeChat = async () => {
    if (!showNameForm && chat) return;

    setLoading(true);
    try {
      const chatData = {
        userId: user?.id || null,
        userName: name || user?.name || 'Guest',
        userEmail: email || user?.email || null
      };

      const res = await fetch(`${API_BASE}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatData)
      });

      if (res.ok) {
        const newChat = await res.json();
        setChat(newChat);
        setShowNameForm(false);
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      alert('Failed to start chat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    // If user is logged in and we have their info, auto-initialize chat
    if (!chat && !showNameForm && (user?.name || name)) {
      initializeChat();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select an image file');
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `chat/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(fileName, imageFile, { upsert: false });
      if (error) {
        console.error('Image upload error:', error);
        if (error.message.includes('Bucket') || error.message.includes('not found')) {
          alert(`Error: The 'chat-images' bucket doesn't exist in Supabase Storage.\n\nPlease:\n1. Go to Supabase Dashboard → Storage\n2. Create a new bucket named 'chat-images'\n3. Set it as public or create RLS policies allowing INSERT and SELECT for public or authenticated users.`);
        } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          alert(`Error: Storage policy blocking upload.\n\nPlease:\n1. Go to Supabase Dashboard → Storage → chat-images bucket → Policies\n2. Create a policy allowing INSERT and SELECT for public or authenticated users.`);
        } else {
          alert(`Failed to upload image: ${error.message}`);
        }
        return null;
      }
      const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(data.path);
      return pub.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error?.message || 'Unknown error'}. Please check that the 'chat-images' bucket exists in Supabase Storage.`);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!message.trim() && !imageFile) || !chat || sending || uploadingImage) return;

    setSending(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          setSending(false);
          return;
        }
      }

      const res = await fetch(`${API_BASE}/chats/${chat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.trim(),
          senderType: 'user',
          senderId: user?.id || null,
          senderName: name || user?.name || 'Guest',
          imageUrl
        })
      });

      if (res.ok) {
        const updatedChat = await res.json();
        setChat(updatedChat);
        setMessage('');
        setImageFile(null);
        setImagePreview(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-neon-blue text-white p-3 md:p-4 rounded-full shadow-lg hover:bg-neon-blue/90 active:scale-95 transition-all duration-300 z-50 flex items-center justify-center neon-glow"
        aria-label="Open chat"
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-[calc(100vw-2rem)] md:w-96 h-[calc(100vh-8rem)] md:h-[600px] max-h-[600px] bg-dark-bg border border-neon-blue rounded-lg shadow-2xl z-50 flex flex-col neon-glow">
      {/* Header */}
      <div className="bg-neon-blue text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5" />
          <h3 className="font-bold">Live Chat Support</h3>
        </div>
        <button
          onClick={handleClose}
          className="hover:bg-white/20 rounded-full p-1 transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark-surface">
        {showNameForm && !chat ? (
          <div className="space-y-4">
            <div className="text-white text-center">
              <Bot className="w-12 h-12 mx-auto mb-2 text-neon-blue" />
              <p className="text-sm text-gray-300">
                {user?.name ? 'Welcome back! Starting chat...' : 'Please provide your details to start chatting'}
              </p>
            </div>
            {!user?.name && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Your Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none text-base"
                />
                <input
                  type="email"
                  placeholder="Your Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none text-base"
                />
                <button
                  onClick={initializeChat}
                  disabled={!name.trim() || loading}
                  className="w-full btn-cyber text-white py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Start Chat'}
                </button>
              </div>
            )}
            {user?.name && loading && (
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-neon-blue" />
              </div>
            )}
          </div>
        ) : chat && chat.messages.length > 0 ? (
          <>
            {chat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.senderType === 'user'
                      ? 'bg-neon-blue text-white'
                      : msg.senderType === 'agent'
                      ? 'bg-green-600 text-white'
                      : 'bg-dark-bg border border-neon-blue/30 text-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {msg.senderType === 'bot' ? (
                      <Bot className="w-4 h-4" />
                    ) : msg.senderType === 'agent' ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <UserIcon className="w-4 h-4" />
                    )}
                    <span className="text-xs font-semibold">
                      {msg.senderName || (msg.senderType === 'user' ? 'You' : 'Support')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.imageUrl && (
                    <div className="mt-2">
                      <img 
                        src={msg.imageUrl} 
                        alt="Shared" 
                        className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90"
                        onClick={() => window.open(msg.imageUrl!, '_blank')}
                      />
                    </div>
                  )}
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {chat.status === 'waiting' && (
              <div className="text-center text-gray-400 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Waiting for agent to join...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading chat...</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      {chat && chat.status !== 'closed' && (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-dark-border bg-dark-surface">
          {imagePreview && (
            <div className="mb-2 relative">
              <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg" />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  if (imageInputRef.current) imageInputRef.current.value = '';
                }}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex space-x-2">
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              onChange={handleImageSelect}
              className="hidden"
              id="chat-image-input"
            />
            <label
              htmlFor="chat-image-input"
              className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 cursor-pointer hover:bg-dark-card transition-colors flex items-center"
              title="Upload image"
            >
              <ImageIcon className="w-5 h-5 text-gray-400" />
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={chat.status === 'waiting' ? 'Type a message... (waiting for agent)' : 'Type a message...'}
              disabled={sending || uploadingImage}
              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={(!message.trim() && !imageFile) || sending || uploadingImage}
              className="bg-neon-blue text-white px-4 py-2 rounded-lg hover:bg-neon-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending || uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChatWidget;

