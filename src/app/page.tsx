'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Layers, Activity, Lock, Cpu, Image as ImageIcon, Zap, Wand2, Terminal } from 'lucide-react';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      setIsAuthenticated(res.ok);
    } catch(e) {}
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-pink-600/10 blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold tracking-wide text-white">Infinite Hub</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/chat" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Chat</Link>
            <Link href="/settings" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Settings</Link>
            {isAuthenticated ? (
              <Link href="/chat" className="px-5 py-2 text-sm font-medium rounded-full bg-white text-black hover:bg-slate-200 transition-all flex items-center gap-2">
                Go to Hub <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link href="/login" className="px-5 py-2 text-sm font-medium rounded-full bg-white text-black hover:bg-slate-200 transition-all flex items-center gap-2">
                Login <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 max-w-7xl mx-auto text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-purple-300 mb-8 animate-fade-in-up">
          <Sparkles className="w-3 h-3" /> Now with Nano Banana 2 Support
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <span className="text-slate-100">Generative AI,</span><br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400">Without Limits.</span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          Experience the ultimate multi-API Google Gemini interface. Auto-rotating keys, seamless model fallbacks, and native high-resolution image generation in one premium environment.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <Link href="/chat" className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2 w-full sm:w-auto justify-center shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)]">
            Start Generating <Wand2 className="w-4 h-4" />
          </Link>
          <a href="#gallery" className="px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors w-full sm:w-auto text-center">
            View Gallery
          </a>
        </div>
      </section>

      {/* Interactive Bento Showcase */}
      <section id="gallery" className="py-24 px-6 max-w-7xl mx-auto z-10 relative">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Crafted by AI, Curated by You</h2>
          <p className="text-slate-400">Powered by gemini-3.1-flash-image-preview</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
          <div className="group relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 md:col-span-2 md:row-span-2 transition-all hover:border-purple-500/50">
            <img src="/images/gen_art_1.png" alt="Generative Art 1" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8">
              <div className="px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-xs font-mono text-cyan-300 mb-3 inline-block">
                Nano Banana Pro
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Neon Fluid Convergence</h3>
              <p className="text-slate-300 text-sm max-w-md">"A stunning generative artwork, neon glowing abstract fluid shapes, dark background, magenta and cyan vibrant colors, high-end 3D render"</p>
            </div>
          </div>
          
          <div className="group relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 transition-all hover:border-cyan-500/50">
            <img src="/images/gen_art_2.png" alt="Generative Art 2" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-lg font-bold text-white mb-1">Cyberpunk Fractals</h3>
              <p className="text-slate-400 text-xs line-clamp-2">Mesmerizing procedural fractal art, cyberpunk style, neon lights.</p>
            </div>
          </div>
          
          <div className="group relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 transition-all hover:border-pink-500/50">
            <img src="/images/gen_art_3.png" alt="Generative Art 3" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-lg font-bold text-white mb-1">Digital Sculpture</h3>
              <p className="text-slate-400 text-xs line-clamp-2">Futuristic AI generated digital sculpture, glowing lines, minimalist gallery setting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Infrastructure */}
      <section className="py-24 px-6 border-t border-white/5 bg-black/20 z-10 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Professional Infrastructure</h2>
            <p className="text-slate-400 max-w-2xl">Built for power users. The hub manages your keys, rotates them instantly on rate limits, and logs every inference.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent hover:border-purple-500/30 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 border border-purple-500/30">
                <Layers className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Infinite Key Rotation</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Say goodbye to 429 Too Many Requests. Upload multiple Gemini keys and the system will automatically round-robin them on exhaustion.</p>
            </div>
            
            <div className="p-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent hover:border-cyan-500/30 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-6 border border-cyan-500/30">
                <Activity className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Real-time Inference Logs</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Monitor your usage with precision. Track latency, token count, model fallbacks, and success rates directly from your private dashboard.</p>
            </div>
            
            <div className="p-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent hover:border-pink-500/30 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-6 border border-pink-500/30">
                <Cpu className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Model Fallover</h3>
              <p className="text-slate-400 text-sm leading-relaxed">If gemini-2.5-pro fails, the system instantly degrades gracefully to gemini-2.5-flash to ensure your workflow is never interrupted.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer CTA */}
      <section className="py-32 px-6 relative overflow-hidden z-10">
        <div className="max-w-4xl mx-auto rounded-3xl p-1 bg-gradient-to-r from-purple-500/30 via-cyan-500/30 to-pink-500/30">
          <div className="bg-[#0a0a0a] rounded-[22px] p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.15),transparent_50%)]" />
            
            <Terminal className="w-12 h-12 text-slate-300 mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to break the limits?</h2>
            <p className="text-slate-400 mb-10 max-w-xl mx-auto text-lg">
              Deploy your own self-hosted hub today. Completely private, incredibly fast, and beautifully designed.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/chat" className="px-8 py-4 rounded-xl bg-white text-black font-semibold hover:bg-slate-200 transition-colors">
                Launch Chat Interface
              </Link>
              <Link href="/settings" className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" /> Configure API Keys
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 text-center text-slate-500 text-sm z-10 relative">
        <p>© 2026 Infinite Gemini Hub. Powered by Vercel & Next.js.</p>
      </footer>

      {/* Global styles for animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}} />
    </div>
  );
}
