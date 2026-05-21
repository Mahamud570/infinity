'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Menu, Plus, MessageSquare, Loader2, Bot, User } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (currentConvId) {
      fetchMessages(currentConvId);
    } else {
      setMessages([]);
    }
  }, [currentConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

  const handleNewChat = () => {
    setCurrentConvId(null);
    setMessages([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistic UI
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConvId,
          prompt: userMessage,
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
        console.error('Chat API Error:', await res.text());
        setMessages(prev => [...prev, { id: 'error', role: 'model', content: 'An error occurred. Please try again.' }]);
      }
    } catch (error) {
      console.error('Network Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-72' : 'w-0'} flex flex-col bg-gray-900 transition-all duration-300 overflow-hidden border-r border-gray-800`}>
        <div className="p-4 flex gap-2">
          <button 
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2 px-4 transition-colors"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setCurrentConvId(conv.id)}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors ${currentConvId === conv.id ? 'bg-gray-800 text-white' : 'text-gray-400'}`}
            >
              <MessageSquare size={18} />
              <div className="truncate text-sm">{conv.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-14 flex items-center p-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur z-10 sticky top-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="ml-4 font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Infinite Gemini Hub
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6 pb-24">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center mt-32 text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Bot size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-200">How can I help you today?</h2>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                      <Bot size={18} className="text-white" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                    msg.role === 'user' 
                      ? 'bg-gray-800 text-gray-100 rounded-tr-sm' 
                      : 'bg-transparent text-gray-200 prose prose-invert prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800'
                  }`}>
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                    {msg.modelUsed && (
                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-1 font-mono">
                        <span>{msg.modelUsed}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={18} className="text-white" />
                </div>
                <div className="flex items-center gap-2 text-gray-400 bg-transparent px-5 py-4">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Gemini is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-gray-800 rounded-2xl p-2 border border-gray-700 shadow-xl focus-within:border-gray-600 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message Infinite Gemini..."
                className="w-full max-h-48 min-h-[44px] bg-transparent text-gray-100 px-3 py-3 resize-none focus:outline-none placeholder-gray-400"
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0 m-1"
              >
                <Send size={18} />
              </button>
            </form>
            <div className="text-center text-xs text-gray-500 mt-3">
              Infinite Gemini Hub - Automatically rotates API keys to bypass rate limits.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
