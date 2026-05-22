'use client';
import './chat.css';
import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Menu, Plus, MessageSquare, Loader2, Settings, Activity, Paperclip, X, Image as ImageIcon, Sparkles, Wand2, LogOut, Trash2, ChevronDown, Workflow, Copy, Check, Square } from 'lucide-react';
import Link from 'next/link';

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1] ? match[1] : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div style={{ background: '#1e1e1e', borderRadius: '8px', overflow: 'hidden', margin: '16px 0', border: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2d2d2d', padding: '8px 16px', fontSize: '12px', color: '#a0a0a0' }}>
          <span style={{ textTransform: 'lowercase' }}>{lang}</span>
          <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: copied ? '#10b981' : '#a0a0a0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>
        <pre style={{ margin: 0, padding: '16px', overflowX: 'auto', background: '#1e1e1e' }}>
          <code className={className} {...props} style={{ color: '#e3e3e3', fontFamily: 'monospace', fontSize: '14px', background: 'transparent' }}>
            {children}
          </code>
        </pre>
      </div>
    );
  }
  return <code className={className} {...props} style={{ background: '#2a2a2a', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#7dd3fc' }}>{children}</code>;
};

const MessageCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'absolute', bottom: '-32px', right: '0px', opacity: 0, transition: 'opacity 0.2s' }} className="group-hover:opacity-100 z-10">
      <button 
        onClick={handleCopy} 
        style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '4px 8px', color: copied ? '#10b981' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
        onMouseEnter={e => { if(!copied) e.currentTarget.style.color = '#e3e3e3'; }}
        onMouseLeave={e => { if(!copied) e.currentTarget.style.color = '#888'; }}
      >
        {copied ? <Check size={12} /> : <Copy size={12}/>} 
        {copied ? 'Copied!' : 'Copy response'}
      </button>
    </div>
  );
};

const GeneratedImage = ({ url }: { url: string }) => {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const isDataUrl = url.startsWith('data:');
  return (
    <div style={{ marginBottom: '12px', borderRadius: '16px', overflow: 'hidden', maxWidth: '512px', border: '1px solid #2a2a2a', background: '#161616' }}>
      {status === 'loading' && !isDataUrl && (
        <div style={{ width: '100%', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid #333', borderTopColor: '#7c3aed', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#666', fontSize: '13px' }}>Generating image...</span>
        </div>
      )}
      <img
        src={url}
        alt="AI Generated"
        onLoad={() => setStatus('done')}
        onError={() => setStatus('error')}
        style={{ width: '100%', display: status === 'error' ? 'none' : 'block', maxHeight: '512px', objectFit: 'contain' }}
      />
      {status === 'error' && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
          ⚠️ Image failed to load. Please try again.
        </div>
      )}
    </div>
  );
};

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  imageUrl?: string;
  modelUsed?: string;
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  _count?: { messages: number };
};

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [isImageMode, setIsImageMode] = useState(false);
  const [imageModel, setImageModel] = useState<'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview'>('gemini-3.1-flash-image-preview');
  const [provider, setProvider] = useState<'gemini'|'openai'|'anthropic'|'groq'|'openrouter'|'mistral'|'cohere'|'huggingface'>('gemini');
  const [user, setUser] = useState<{username: string} | null>(null);
  
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push('/login');
      } else {
        const data = await res.json();
        setUser(data.user);
        fetchConversations();
      }
    } catch (e) {
      router.push('/login');
    }
  };
  useEffect(() => {
    if (currentConvId) fetchMessages(currentConvId);
    else setMessages([]);
  }, [currentConvId]);
  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) setConversations(await res.json());
    } catch (error) { console.error('Failed to fetch conversations', error); }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) setMessages((await res.json()).messages);
    } catch (error) { console.error('Failed to fetch messages', error); }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentConvId === id) handleNewChat();
        fetchConversations();
      }
    } catch (error) { console.error('Failed to delete conversation', error); }
  };

  const handleNewChat = () => { setCurrentConvId(null); setMessages([]); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAttachedImage({ base64: result.split(',')[1], mimeType: file.type, preview: result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const handleImageGenerate = async (prompt: string) => {
    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Temporarily show optimistic user prompt
    setMessages(prev => [...prev, { id: 'optimistic-user', role: 'user', content: `🎨 Generate: ${prompt}` }]);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ prompt, model: imageModel, conversationId: currentConvId }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        if (!currentConvId && data.conversationId) {
          setCurrentConvId(data.conversationId);
          fetchConversations();
        } else {
          fetchMessages(data.conversationId);
        }
      } else {
        setMessages(prev => [
          ...prev.filter(m => m.id !== 'optimistic-user'),
          { id: 'err', role: 'model', content: data.error || 'Generation failed.' }
        ]);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => [
          ...prev.filter(m => m.id !== 'optimistic-user'),
          { id: 'stop', role: 'model', content: '🛑 *Generation stopped by user*' }
        ]);
      } else {
        setMessages(prev => [
          ...prev.filter(m => m.id !== 'optimistic-user'),
          { id: 'err', role: 'model', content: 'Network error during image generation.' }
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedImage) || isLoading) return;

    const userMessage = input.trim();
    const imageToSend = attachedImage;
    setInput('');
    setAttachedImage(null);
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    if (isImageMode) {
      setInput('');
      setIsLoading(false);
      await handleImageGenerate(userMessage);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages(prev => [...prev, { 
      id: Date.now().toString(), role: 'user', 
      content: userMessage || '(Image)', imageUrl: imageToSend?.preview 
    }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: currentConvId,
          prompt: userMessage,
          provider: provider,
          image: imageToSend ? { base64: imageToSend.base64, mimeType: imageToSend.mimeType } : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        if (!currentConvId && data.conversationId) {
          setCurrentConvId(data.conversationId);
          fetchConversations();
        }
      } else {
        const text = await res.text();
        let errorMsg = 'An error occurred. Please try again.';
        try { const p = JSON.parse(text); if (p.error) errorMsg = p.error; } catch(e) {}
        setMessages(prev => [...prev, { id: 'error', role: 'model', content: errorMsg }]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(prev => [...prev, { id: 'stop', role: 'model', content: '🛑 *Generation stopped by user*' }]);
      } else {
        console.error('Network Error:', error);
        setMessages(prev => [...prev, { id: 'error', role: 'model', content: 'Network error or request aborted.' }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Provider avatar config
  const providerMeta: Record<string, { label: string; bg: string; short: string }> = {
    gemini:      { label: 'Gemini',      bg: 'linear-gradient(135deg,#4285f4,#34a853)', short: 'G' },
    openai:      { label: 'GPT',         bg: 'linear-gradient(135deg,#10a37f,#1a7f5a)', short: 'GPT' },
    anthropic:   { label: 'Claude',      bg: 'linear-gradient(135deg,#d97757,#c45a35)', short: 'CL' },
    groq:        { label: 'Groq',        bg: 'linear-gradient(135deg,#f55036,#ff7849)', short: 'GQ' },
    openrouter:  { label: 'OpenRouter',  bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', short: 'OR' },
    mistral:     { label: 'Mistral',     bg: 'linear-gradient(135deg,#ff7000,#ffaa00)', short: 'MS' },
    cohere:      { label: 'Cohere',      bg: 'linear-gradient(135deg,#39d353,#059669)', short: 'CO' },
    huggingface: { label: 'HF',          bg: 'linear-gradient(135deg,#ff9d00,#ff6b00)', short: '🤗' },
    pollinations:{ label: 'Pollinations',bg: 'linear-gradient(135deg,#a855f7,#ec4899)', short: '🎨' },
  };

  const getAvatarBg = (modelUsed?: string) => {
    if (!modelUsed) return 'linear-gradient(135deg,#7c3aed,#06b6d4)';
    for (const [k, v] of Object.entries(providerMeta)) {
      if (modelUsed.toLowerCase().includes(k) ||
        (k==='openai' && (modelUsed.includes('gpt')||modelUsed.includes('o1'))) ||
        (k==='anthropic' && modelUsed.includes('claude')) ||
        (k==='groq' && (modelUsed.includes('llama')||modelUsed.includes('mixtral')||modelUsed.includes('gemma'))) ||
        (k==='mistral' && modelUsed.includes('mistral')) ||
        (k==='cohere' && modelUsed.includes('command'))
      ) return v.bg;
    }
    return 'linear-gradient(135deg,#7c3aed,#06b6d4)';
  };

  const getAvatarLabel = (modelUsed?: string) => {
    if (!modelUsed) return '✦';
    if (modelUsed.includes('gpt') || modelUsed.includes('o1')) return 'GPT';
    if (modelUsed.includes('claude')) return 'CL';
    if (modelUsed.includes('gemini')) return 'G';
    if (modelUsed.includes('llama') || modelUsed.includes('mixtral') || modelUsed.includes('gemma')) return 'GQ';
    if (modelUsed.includes('mistral')) return 'MS';
    if (modelUsed.includes('command')) return 'CO';
    if (modelUsed.includes('pollinations')) return '🎨';
    return '✦';
  };

  const quickPrompts = [
    { icon: '⚡', text: 'Explain quantum computing', sub: 'Science & Tech' },
    { icon: '💻', text: 'Write a Python web scraper', sub: 'Code' },
    { icon: '✍️', text: 'Draft a professional email', sub: 'Writing' },
    { icon: '🎨', text: 'Generate a sunset landscape', sub: 'Image Mode' },
  ];

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
      <div className="chat-root">

        {/* ── Sidebar ── */}
        <div className="sidebar" style={{ width: isSidebarOpen ? '260px' : '0', minWidth: isSidebarOpen ? '260px' : '0' }}>
          <div className="sidebar-top">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">
                <Sparkles size={18} color="white" />
              </div>
              <span className="sidebar-logo-text">Infinite Hub</span>
            </div>
            <button className="new-chat-btn" onClick={handleNewChat}>
              <Plus size={16} /> New Chat
            </button>
          </div>

          <div className="conv-list">
            {conversations.length > 0 && <div className="conv-section-label">Recent</div>}
            {conversations.map(conv => (
              <div key={conv.id} className="conv-item group">
                <button
                  className={`conv-btn ${currentConvId === conv.id ? 'active' : ''}`}
                  onClick={() => setCurrentConvId(conv.id)}
                >
                  <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <span className="conv-title">{conv.title}</span>
                </button>
                <button className="conv-delete-btn" onClick={(e) => handleDeleteConversation(conv.id, e)} title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="sidebar-bottom">
            <Link href="/settings" className="sidebar-nav-link"><Settings size={15} /> Settings &amp; API Keys</Link>
            <Link href="/logs" className="sidebar-nav-link"><Activity size={15} /> Inference Logs</Link>
            <button className="logout-btn" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }}>
              <LogOut size={15} /> Logout ({user?.username})
            </button>
          </div>
        </div>

        {/* ── Main ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', height: '100vh' }}>

          {/* Header */}
          <header className="chat-header">
            <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={20} /></button>
            <span className="header-title">Infinite Gemini Hub</span>
          </header>

          {/* Messages */}
          <div className="messages-area">
            <div className="messages-inner">

              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><Sparkles size={32} color="#a78bfa" /></div>
                  <div>
                    <h2 className="empty-title">How can I help you today?</h2>
                    <p className="empty-sub">8 AI providers · Automatic fallback · Free image generation</p>
                  </div>
                  <div className="quick-prompts">
                    {quickPrompts.map((q, i) => (
                      <button key={i} className="quick-prompt-btn" onClick={() => { setInput(q.text); textareaRef.current?.focus(); }}>
                        <span className="quick-prompt-icon">{q.icon}</span>
                        <div className="quick-prompt-text">{q.text}</div>
                        <div className="quick-prompt-sub">{q.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`message-row ${msg.role === 'user' ? 'user' : ''}`}>
                    {msg.role === 'model' && (
                      <div className="ai-avatar" style={{ background: getAvatarBg(msg.modelUsed) }}>
                        {getAvatarLabel(msg.modelUsed)}
                      </div>
                    )}
                    <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
                      {msg.imageUrl && <GeneratedImage url={msg.imageUrl} />}
                      {msg.role === 'user' ? (
                        <div>{msg.content}</div>
                      ) : (
                        <div className="ai-md group relative" style={{ paddingBottom: '12px' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock as any }}>
                            {msg.content}
                          </ReactMarkdown>
                          <MessageCopyButton text={msg.content} />
                        </div>
                      )}
                      {msg.modelUsed && msg.role === 'model' && (
                        <div className="model-badge">{msg.modelUsed}</div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="loading-row">
                  <div className="ai-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }}>✦</div>
                  <div className="typing-dots">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-inner">
              <form className="input-form" onSubmit={handleSubmit}>
                {attachedImage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px 0' }}>
                    <div style={{ position: 'relative' }}>
                      <img src={attachedImage.preview} alt="preview" style={{ height: '64px', width: '64px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(124,58,237,0.3)' }} />
                      <button type="button" onClick={() => setAttachedImage(null)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={10} />
                      </button>
                    </div>
                    <span style={{ fontSize: '12px', color: '#6666aa', display: 'flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={12} /> Image attached</span>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  className="input-textarea"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                  placeholder={isImageMode ? '✨ Describe the image to generate...' : 'Ask anything... (Enter to send, Shift+Enter for new line)'}
                  rows={1}
                />
                <div className="input-bar">
                  <div className="input-bar-left">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                    <button type="button" className="bar-btn" onClick={() => fileInputRef.current?.click()}><Plus size={18} /></button>

                    <div className="bar-btn" style={{ position: 'relative', padding: '6px 8px' }}>
                      {isImageMode ? (
                        <select className="provider-select" value={imageModel} onChange={e => setImageModel(e.target.value as any)}>
                          <option value="pollinations-turbo">🎨 Pollinations (Free)</option>
                          <option value="pollinations-hd">🎨 Pollinations HD</option>
                        </select>
                      ) : (
                        <select className="provider-select" value={provider} onChange={e => setProvider(e.target.value as any)}>
                          <optgroup label="Paid">
                            <option value="gemini">✦ Google Gemini</option>
                            <option value="openai">⬡ OpenAI (GPT)</option>
                            <option value="anthropic">◈ Claude</option>
                            <option value="mistral">◆ Mistral AI</option>
                            <option value="cohere">● Cohere</option>
                          </optgroup>
                          <optgroup label="Free Tier">
                            <option value="groq">⚡ Groq (Free)</option>
                            <option value="openrouter">🔀 OpenRouter</option>
                            <option value="huggingface">🤗 HuggingFace</option>
                          </optgroup>
                        </select>
                      )}
                      <ChevronDown size={12} style={{ position: 'absolute', right: '2px', pointerEvents: 'none', opacity: 0.5 }} />
                    </div>

                    <button type="button" className="bar-btn" onClick={() => setIsImageMode(!isImageMode)}
                      style={{ color: isImageMode ? '#a855f7' : undefined, background: isImageMode ? 'rgba(168,85,247,0.1)' : undefined }}>
                      {isImageMode ? <><Wand2 size={15} /> Image</> : <><Workflow size={15} /> Plan</>}
                    </button>
                  </div>

                  {isLoading ? (
                    <button type="button" onClick={handleStop} className="send-btn active" style={{ background: '#ef4444', boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)' }}>
                      <Square size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button type="submit"
                      disabled={(!input.trim() && !attachedImage)}
                      className={`send-btn ${(!input.trim() && !attachedImage) ? '' : isImageMode ? 'image-mode' : 'active'}`}
                    >
                      <Send size={16} style={{ transform: 'translateX(1px)' }} />
                    </button>
                  )}
                </div>
              </form>
              <div className="footer-text">Infinite AI Hub · 8 providers · Automatic failover</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
