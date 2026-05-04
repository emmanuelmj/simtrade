'use client';

import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useMarketStore } from '../store/marketStore';

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
  const username    = useMarketStore((s) => s.username);
  const setUsername = useMarketStore((s) => s.setUsername);
  const [input, setInput] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="h-full bg-[#f8f9fa] dark:bg-[#0a0a0c]" />;

  /* ── Login screen ──────────────────────────────────────────── */
  if (!username) {
    return (
      <div className="h-screen w-full bg-[#f8f9fa] dark:bg-[#0a0a0c] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-full max-w-sm p-8 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b] rounded-2xl flex flex-col items-center shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg mb-6">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 tracking-wide">Synthex Terminal</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 text-center">Enter your trader handle to connect to the live market.</p>
          <form className="w-full flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); if (input.trim()) setUsername(input.trim()); }}>
            <div className="relative w-full flex items-center bg-slate-100 dark:bg-[#1e293b]/60 border border-slate-200 dark:border-[#1e293b] rounded-xl focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <span className="pl-4 pr-1 text-slate-500 font-mono">@</span>
              <input type="text" placeholder="trader_handle" value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full py-3 pr-4 bg-transparent focus:outline-none font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                autoFocus />
            </div>
            <button type="submit" disabled={!input.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-40 text-sm tracking-wide">
              ENTER MARKET
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── App shell — full-screen, no side nav ── */
  return (
    <>
      <Toaster position="top-right" />
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {children}
      </main>
    </>
  );
}
