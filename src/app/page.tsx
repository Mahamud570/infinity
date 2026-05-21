'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Menu, Plus, MessageSquare, Loader2, Bot, Settings, Activity, Paperclip, X, Image as ImageIcon, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fetchConversations(); }, []);
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
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: `🎨 Generate: ${prompt}` }]);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: imageModel }),
      });
      const data = await res.json();
      if (res.ok && data.imageBase64) {
        const imgUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'model',
          content: data.text || 'Here is your generated image:',
          imageUrl: imgUrl,
          modelUsed: imageModel
        }]);
      } else {
        setMessages(prev => [...prev, { id: 'err', role: 'model', content: data.error || 'Generation failed.' }]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { id: 'err', role: 'model', content: 'Network error during image generation.' }]);
    } finally {
      setIsLoading(false);
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
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), role: 'user', 
      content: userMessage || '(Image)', imageUrl: imageToSend?.preview 
    }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConvId,
          prompt: userMessage,
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
    } catch (error) {
      console.error('Network Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen" style={{ background: '#0f0f0f', color: '#e3e3e3', fontFamily: "'Google Sans', 'Inter', sans-serif" }}>
      
      {/* Sidebar */}
      <div style={{ 
        width: isSidebarOpen ? '280px' : '0px', 
        minWidth: isSidebarOpen ? '280px' : '0px',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        background: '#1a1a1a',
        borderRight: '1px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* New Chat button */}
        <div style={{ padding: '16px 12px 8px' }}>
          <button 
            onClick={handleNewChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '24px',
              color: '#c4c4c4', padding: '10px 16px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 500, transition: 'all 0.2s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {conversations.length > 0 && (
            <div style={{ padding: '8px 8px 4px', fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Recent
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setCurrentConvId(conv.id)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: currentConvId === conv.id ? '#2d2d2d' : 'transparent',
                color: currentConvId === conv.id ? '#e3e3e3' : '#a0a0a0',
                fontSize: '13px', transition: 'all 0.15s', marginBottom: '2px'
              }}
              onMouseEnter={e => { if (currentConvId !== conv.id) e.currentTarget.style.background = '#242424'; }}
              onMouseLeave={e => { if (currentConvId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <MessageSquare size={15} style={{ shrink: 0, opacity: 0.6 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</span>
            </button>
          ))}
        </div>

        {/* Bottom nav */}
        <div style={{ padding: '12px', borderTop: '1px solid #2a2a2a' }}>
          {[
            { href: '/settings', icon: <Settings size={16} />, label: 'Settings & API Keys' },
            { href: '/logs', icon: <Activity size={16} />, label: 'Inference Logs' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '12px', color: '#888',
              textDecoration: 'none', fontSize: '13px', fontWeight: 500,
              transition: 'all 0.15s', marginBottom: '2px'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2a2a2a'; (e.currentTarget as HTMLElement).style.color = '#e3e3e3'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#888'; }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {/* Header */}
        <header style={{
          height: '56px', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px',
          borderBottom: '1px solid #1e1e1e', background: 'rgba(15,15,15,0.8)',
          backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10
        }}>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{
            background: 'none', border: 'none', color: '#888', cursor: 'pointer',
            padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center'
          }}>
            <Menu size={20} />
          </button>
          <div style={{
            fontSize: '17px', fontWeight: 600,
            background: 'linear-gradient(135deg, #4f90ff, #30d5a4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Infinite Gemini Hub
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '180px' }}>
            
            {messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '120px', gap: '20px', textAlign: 'center' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #4f90ff20, #30d5a420)',
                  border: '1px solid #30d5a430',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Sparkles size={28} style={{ color: '#4f90ff' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px', color: '#e3e3e3' }}>How can I help you today?</h2>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Powered by Gemini 2.5 Flash with auto key rotation</p>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} style={{
                  display: 'flex', gap: '12px', marginTop: '24px',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  {msg.role === 'model' && (
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                      background: 'linear-gradient(135deg, #4f90ff, #30d5a4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Bot size={17} color="white" />
                    </div>
                  )}

                  <div style={{
                    maxWidth: msg.role === 'user' ? '75%' : '100%',
                    ...(msg.role === 'user' ? {
                      background: '#2a2a2a',
                      borderRadius: '18px 18px 4px 18px',
                      padding: '12px 16px',
                      color: '#e3e3e3',
                      fontSize: '15px',
                      lineHeight: '1.6'
                    } : {
                      padding: '4px 0',
                      flex: 1,
                      color: '#d4d4d4',
                      fontSize: '15px',
                      lineHeight: '1.75'
                    })
                  }}>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Attached" style={{ maxWidth: '100%', borderRadius: '12px', marginBottom: '10px', maxHeight: '280px', objectFit: 'contain' }} />
                    )}
                    {msg.role === 'user' ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    ) : (
                      <div className="gemini-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                    {msg.modelUsed && (
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '8px', fontFamily: 'monospace' }}>
                        {msg.modelUsed}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #4f90ff, #30d5a4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bot size={17} color="white" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4f90ff', animation: 'pulse 1.2s ease-in-out infinite' }} />
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4f90ff', animation: 'pulse 1.2s ease-in-out 0.2s infinite' }} />
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4f90ff', animation: 'pulse 1.2s ease-in-out 0.4s infinite' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 16px 20px',
          background: 'linear-gradient(to top, #0f0f0f 60%, transparent)'
        }}>
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', justifyContent: 'center' }}>
              <button type="button" onClick={() => setIsImageMode(false)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', border: `1px solid ${!isImageMode ? '#4f90ff44' : 'transparent'}`, cursor: 'pointer', fontSize: '13px', background: !isImageMode ? '#4f90ff22' : 'transparent', color: !isImageMode ? '#4f90ff' : '#555', transition: 'all 0.2s' }}><Bot size={14} /> Chat</button>
              <button type="button" onClick={() => setIsImageMode(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', border: `1px solid ${isImageMode ? '#a855f744' : 'transparent'}`, cursor: 'pointer', fontSize: '13px', background: isImageMode ? '#a855f722' : 'transparent', color: isImageMode ? '#c084fc' : '#555', transition: 'all 0.2s' }}><Wand2 size={14} /> Generate Image</button>
              {isImageMode && (<select value={imageModel} onChange={e => setImageModel(e.target.value as any)} style={{ marginLeft: '8px', background: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '12px', color: '#aaa', fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}><option value="gemini-3.1-flash-image-preview">Nano Banana 2 (Fast)</option><option value="gemini-3-pro-image-preview">Nano Banana Pro (Quality)</option></select>)}
            </div>
            <form onSubmit={handleSubmit} style={{
              background: '#1e1e1e', borderRadius: '24px',
              border: '1px solid #2e2e2e', overflow: 'hidden',
              transition: 'border-color 0.2s',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
            }}>
              {/* Image preview */}
              {attachedImage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px 0' }}>
                  <div style={{ position: 'relative' }}>
                    <img src={attachedImage.preview} alt="preview" style={{ height: '72px', width: '72px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #3a3a3a' }} />
                    <button type="button" onClick={() => setAttachedImage(null)} style={{
                      position: 'absolute', top: '-6px', right: '-6px',
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: '#444', border: 'none', color: '#fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <X size={11} />
                    </button>
                  </div>
                  <span style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ImageIcon size={12} /> Image attached
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px' }}>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'none', border: 'none', color: '#666', cursor: 'pointer',
                    padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center',
                    transition: 'all 0.15s', flexShrink: 0
                  }}
                  title="Attach image"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4f90ff'; (e.currentTarget as HTMLElement).style.background = '#2a2a2a'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#666'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <Paperclip size={20} />
                </button>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
                  }}
                  placeholder={isImageMode ? '✨ Describe the image you want to generate...' : 'Ask Gemini'}
                  rows={1}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: '#e3e3e3', fontSize: '15px', padding: '10px 12px',
                    resize: 'none', fontFamily: 'inherit', lineHeight: '1.6',
                    maxHeight: '200px', overflowY: 'auto'
                  }}
                />

                <button
                  type="submit"
                  disabled={(!input.trim() && !attachedImage) || isLoading}
                  style={{
                    background: (!input.trim() && !attachedImage) || isLoading ? '#2a2a2a' : isImageMode ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'linear-gradient(135deg, #4f90ff, #30d5a4)',
                    border: 'none', borderRadius: '14px', color: '#fff',
                    width: '40px', height: '40px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.2s', marginBottom: '2px'
                  }}
                >
                  {isLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                </button>
              </div>
            </form>

            <div style={{ textAlign: 'center', fontSize: '11px', color: '#444', marginTop: '10px' }}>
              Infinite Gemini Hub · Automatic key rotation to bypass rate limits
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .gemini-markdown { line-height: 1.75; }
        .gemini-markdown p { margin: 0 0 12px; }
        .gemini-markdown p:last-child { margin-bottom: 0; }
        .gemini-markdown h1, .gemini-markdown h2, .gemini-markdown h3 { color: #e3e3e3; font-weight: 600; margin: 20px 0 10px; }
        .gemini-markdown h1 { font-size: 20px; }
        .gemini-markdown h2 { font-size: 17px; }
        .gemini-markdown h3 { font-size: 15px; }
        .gemini-markdown ul, .gemini-markdown ol { margin: 8px 0 12px; padding-left: 20px; }
        .gemini-markdown li { margin-bottom: 6px; }
        .gemini-markdown strong { color: #e8e8e8; font-weight: 600; }
        .gemini-markdown em { font-style: italic; }
        .gemini-markdown code { background: #2a2a2a; border-radius: 6px; padding: 2px 6px; font-size: 13px; font-family: 'Fira Code', monospace; color: #7dd3fc; }
        .gemini-markdown pre { background: #1a1a2e; border: 1px solid #2e2e4a; border-radius: 12px; padding: 16px; overflow-x: auto; margin: 12px 0; }
        .gemini-markdown pre code { background: none; padding: 0; color: #a5d6ff; }
        .gemini-markdown blockquote { border-left: 3px solid #4f90ff; margin: 12px 0; padding: 8px 16px; color: #888; }
        .gemini-markdown table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        .gemini-markdown th { background: #2a2a2a; padding: 8px 12px; text-align: left; border: 1px solid #3a3a3a; }
        .gemini-markdown td { padding: 8px 12px; border: 1px solid #2a2a2a; }
        .gemini-markdown a { color: #4f90ff; text-decoration: none; }
        .gemini-markdown a:hover { text-decoration: underline; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
      `}</style>
    </div>
  );
}
