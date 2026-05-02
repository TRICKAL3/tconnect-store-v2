import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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

interface ChatListItem {
  id: string;
  status: 'bot' | 'waiting' | 'active' | 'closed';
  messages: ChatMessage[];
  updatedAt: string;
  _count?: { messages: number };
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatListItem[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showNameForm, setShowNameForm] = useState(true);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const loadChat = async (chatId: string) => {
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}`);
      if (res.ok) {
        const loadedChat = await res.json();
        setChat(loadedChat);
        setShowNameForm(false);
        localStorage.setItem('tconnect_chat_id', chatId);
      } else {
        // Chat not found, clear stored ID
        localStorage.removeItem('tconnect_chat_id');
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
      localStorage.removeItem('tconnect_chat_id');
    }
  };

  const loadChatHistory = async () => {
    try {
      const identifier = user?.id || user?.email || email;
      if (!identifier) return;

      const res = await fetch(`${API_BASE}/chats/user/${encodeURIComponent(identifier)}`);
      if (res.ok) {
        const history = await res.json();
        setChatHistory(history);
        
        // If no active chat but we have history, show history
        if (!chat && history.length > 0) {
          setShowChatHistory(true);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Load chat from localStorage on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const storedChatId = localStorage.getItem('tconnect_chat_id');
    if (storedChatId) {
      loadChat(storedChatId);
    }
  }, []);

  // When URL has openChat=chatId (e.g. after Pay by card), open widget and load that chat
  const openChatId = searchParams.get('openChat');
  useEffect(() => {
    if (!openChatId) return;
    loadChat(openChatId);
    setIsOpen(true);
    setShowChatHistory(false);
    // Clear openChat from URL so it doesn't reopen on refresh
    const next = new URLSearchParams(searchParams);
    next.delete('openChat');
    const q = next.toString();
    navigate({ pathname: location.pathname || '/', search: q ? `?${q}` : '' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatId]);

  // Load user's chat history when widget opens
  useEffect(() => {
    if (isOpen && (user?.id || user?.email || email)) {
      loadChatHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id, user?.email, email]);

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

  // Keep newest messages visible inside the widget only — scrollIntoView() would scroll the
  // whole page when the chat body doesn’t overflow (fixed panel at bottom of viewport).
  useEffect(() => {
    if (!isOpen || !chat?.messages?.length) return;
    const id = requestAnimationFrame(() => {
      const el = messagesScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [chat?.messages, isOpen]);

  // Poll for new messages when chat is open (only update state when something changed)
  useEffect(() => {
    if (!isOpen || !chat) return;

    const chatId = chat.id;
    const lastMessageCount = chat.messages?.length ?? 0;
    const lastMessageId = chat.messages?.[chat.messages.length - 1]?.id ?? null;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/chats/${chatId}`);
        if (res.ok) {
          const updatedChat = await res.json();
          const newCount = updatedChat.messages?.length ?? 0;
          const newLastId = updatedChat.messages?.[updatedChat.messages.length - 1]?.id ?? null;
          // Only update state when messages actually changed (avoids "reconnecting" feel)
          if (newCount !== lastMessageCount || newLastId !== lastMessageId) {
            setChat(updatedChat);
          }
        }
      } catch (error) {
        console.error('Failed to poll chat:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [isOpen, chat]); // Restart polling when chat instance changes

  // When a chat is closed, clear the stored chat ID so we don't keep reopening it
  useEffect(() => {
    if (chat?.status === 'closed') {
      localStorage.removeItem('tconnect_chat_id');
    }
  }, [chat?.status]);

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
        setShowChatHistory(false);
        // Store chat ID in localStorage
        localStorage.setItem('tconnect_chat_id', newChat.id);
        // Reload chat history
        loadChatHistory();
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
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white p-3 md:p-4 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.7)] hover:shadow-[0_0_45px_rgba(248,113,113,0.9)] border border-white/10 hover:border-white/30 active:scale-95 hover:-translate-y-0.5 transition-all duration-300 z-50 flex items-center justify-center backdrop-blur"
        aria-label="Open chat"
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6 drop-shadow-[0_0_8px_rgba(15,23,42,0.9)]" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-[calc(100vw-2rem)] md:w-96 h-[calc(100vh-8rem)] md:h-[600px] max-h-[600px] rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.95)] border border-amber-500/70 bg-gradient-to-br from-slate-950 via-slate-900 to-black z-50 flex flex-col overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white p-4 rounded-t-2xl flex items-center justify-between shadow-[0_10px_40px_rgba(248,113,22,0.7)]">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.4),_transparent_55%)] pointer-events-none" />
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-black/25 shadow-inner border border-white/20">
            <MessageCircle className="w-5 h-5 drop-shadow-[0_0_10px_rgba(15,23,42,0.9)]" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold tracking-wide">Live Chat Support</h3>
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">
              Powered by TConnect
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 relative z-10">
          <button
            onClick={() => {
              const goingToHistory = !showChatHistory;
              setShowChatHistory(goingToHistory);
              if (goingToHistory) {
                // Leaving current chat to view the list / start a new one
                setChat(null);
                localStorage.removeItem('tconnect_chat_id');
                loadChatHistory();
              }
            }}
            className="hover:bg-white/20 bg-black/15 border border-white/20 rounded-full px-2.5 py-1 transition-all text-xs whitespace-nowrap shadow-[0_2px_10px_rgba(15,23,42,0.8)] hover:-translate-y-0.5"
            title={chatHistory.length > 0 ? 'Chat history & new chat' : 'Start new chat / My chats'}
          >
            {showChatHistory ? 'Back' : chatHistory.length > 0 ? `Chats (${chatHistory.length})` : 'New chat'}
          </button>
          <button
            onClick={handleClose}
            className="hover:bg-white/20 bg-black/15 rounded-full p-1 transition-all shadow-[0_2px_10px_rgba(15,23,42,0.8)] hover:-translate-y-0.5"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Content */}
      <div
        ref={messagesScrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-950/90 via-slate-900/95 to-slate-950"
      >
        {showChatHistory ? (
          <div className="space-y-2">
            <div className="text-white font-semibold mb-3">
              {chatHistory.length > 0 ? 'Your Chat History' : 'My Chats'}
            </div>
            {chatHistory.length > 0 ? (
              chatHistory.map((chatItem) => (
                <button
                  key={chatItem.id}
                  onClick={() => {
                    loadChat(chatItem.id);
                    setShowChatHistory(false);
                  }}
                  className="w-full text-left p-3 bg-gradient-to-r from-slate-900/80 to-slate-800/80 border border-slate-700/70 rounded-xl hover:border-amber-500/80 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(15,23,42,0.9)]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-semibold">
                      Chat #{chatItem.id.substring(0, 8)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      chatItem.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      chatItem.status === 'closed' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {chatItem.status}
                    </span>
                  </div>
                  {chatItem.messages.length > 0 && (
                    <p className="text-gray-400 text-xs truncate">
                      {chatItem.messages[0].content.substring(0, 50)}...
                    </p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(chatItem.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No previous chats yet.</p>
            )}
            <button
              onClick={() => {
                setShowChatHistory(false);
                setChat(null);
                localStorage.removeItem('tconnect_chat_id');
                // If we already know the user's name, skip the form and let auto-init create a new chat
                if (user?.name || name) {
                  setShowNameForm(false);
                } else {
                  setShowNameForm(true);
                }
              }}
              className="w-full mt-4 btn-cyber text-white py-2 rounded-xl shadow-[0_12px_40px_rgba(56,189,248,0.6)] hover:shadow-[0_16px_55px_rgba(129,140,248,0.9)] hover:-translate-y-0.5 transition-all"
            >
              Start New Chat
            </button>
          </div>
        ) : showNameForm && !chat ? (
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
                  className="w-full px-3 py-2 bg-slate-950/70 border border-dark-border/80 rounded-xl text-white focus:border-neon-blue focus:outline-none text-base shadow-inner"
                />
                <input
                  type="email"
                  placeholder="Your Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-dark-border/80 rounded-xl text-white focus:border-neon-blue focus:outline-none text-base shadow-inner"
                />
                <button
                  onClick={initializeChat}
                  disabled={!name.trim() || loading}
                  className="w-full btn-cyber text-white py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-[0_12px_40px_rgba(56,189,248,0.6)] hover:shadow-[0_16px_55px_rgba(129,140,248,0.9)] hover:-translate-y-0.5 transition-all"
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
        ) : chat && chat.status === 'closed' ? (
          <div className="space-y-4 text-center">
            <div className="text-white font-semibold">This chat has been closed.</div>
            <p className="text-gray-400 text-sm">
              You can start a new conversation below.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('tconnect_chat_id');
                setChat(null);
                // If we already know the user's name, skip the form and let auto-init create a new chat
                if (user?.name || name) {
                  setShowNameForm(false);
                } else {
                  setShowNameForm(true);
                }
              }}
              className="w-full btn-cyber text-white py-2 rounded-lg"
            >
              Start New Chat
            </button>
          </div>
        ) : chat && chat.messages.length > 0 ? (
          <>
            {chat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2.5 shadow-[0_12px_35px_rgba(15,23,42,0.9)] border ${
                    msg.senderType === 'user'
                      ? 'bg-gradient-to-br from-neon-blue via-sky-400 to-purple-500 text-white border-white/10'
                      : msg.senderType === 'agent'
                      ? 'bg-gradient-to-br from-emerald-500 via-emerald-400 to-lime-400 text-white border-white/10'
                      : 'bg-slate-900/90 border-neon-blue/30 text-gray-200'
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
        <form onSubmit={handleSendMessage} className="p-4 border-t border-dark-border/60 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-[0_-10px_40px_rgba(15,23,42,0.9)]">
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
              className="bg-slate-950/80 border border-dark-border/80 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-900 transition-colors flex items-center shadow-inner"
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
              className="flex-1 px-3 py-2 bg-slate-950/80 border border-dark-border/80 rounded-xl text-white focus:border-neon-blue focus:outline-none disabled:opacity-50 shadow-inner"
            />
            <button
              type="submit"
              disabled={(!message.trim() && !imageFile) || sending || uploadingImage}
              className="bg-gradient-to-br from-neon-blue via-sky-400 to-purple-500 text-white px-4 py-2 rounded-xl hover:shadow-[0_12px_40px_rgba(56,189,248,0.8)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_8px_25px_rgba(15,23,42,0.9)] active:scale-95"
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

