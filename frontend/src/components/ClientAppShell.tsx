'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LineChart, Briefcase, Trophy, Shield } from 'lucide-react';
import { Toaster } from 'sonner';
import { useMarketStore } from '../store/marketStore';
import { useMarketConnection } from '../hooks/useMarketConnection';

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
  const username = useMarketStore((state) => state.username);
  const setUsername = useMarketStore((state) => state.setUsername);
  const [inputValue, setInputValue] = useState('');
  
  const pathname = usePathname();

  // Initialize the WebSocket connection globally whenever the user is logged in
  useMarketConnection(username);

  // Hydration safeguard for Zustand persist to prevent server/client HTML mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-full bg-zinc-50" />;
  }

  if (!username) {
    return (
      <div className="h-full w-full bg-zinc-50 flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-full max-w-sm p-8 bg-white/70 backdrop-blur-xl shadow-sm border border-zinc-200 rounded-2xl flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center shadow-sm mb-6">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Welcome to Synthex</h1>
          <p className="text-sm text-zinc-500 mb-8 text-center">Enter your trader handle to connect to the market.</p>
          
          <form 
            className="w-full flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (inputValue.trim()) {
                setUsername(inputValue.trim());
              }
            }}
          >
            <input
              type="text"
              placeholder="Trader Handle"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-center font-mono font-medium text-zinc-900 placeholder:text-zinc-400 transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-full py-3 bg-zinc-900 text-white font-medium rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              Enter Market
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <aside className="w-20 bg-white border-r border-zinc-200 flex flex-col items-center py-6 gap-8 z-50">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center shadow-sm cursor-pointer" onClick={() => setUsername(null)}>
          <span className="text-white font-bold text-lg">S</span>
        </div>
        
        <nav className="flex flex-col gap-6 w-full items-center mt-4">
          <Link href="/" className={`p-3 rounded-xl transition-colors ${pathname === '/' ? 'text-zinc-900 bg-zinc-100' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}>
            <LineChart size={24} strokeWidth={2} />
          </Link>
          <Link href="/portfolio" className={`p-3 rounded-xl transition-colors ${pathname === '/portfolio' ? 'text-zinc-900 bg-zinc-100' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}>
            <Briefcase size={24} strokeWidth={2} />
          </Link>
          <Link href="/leaderboard" className={`p-3 rounded-xl transition-colors ${pathname === '/leaderboard' ? 'text-zinc-900 bg-zinc-100' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}>
            <Trophy size={24} strokeWidth={2} />
          </Link>
        </nav>

        <div className="mt-auto">
          <Link href="/admin" className={`p-3 rounded-xl transition-colors inline-block ${pathname === '/admin' ? 'text-zinc-900 bg-zinc-100' : 'text-zinc-300 hover:text-zinc-400'}`}>
            <Shield size={20} strokeWidth={2} />
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </>
  );
}
