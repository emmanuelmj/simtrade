'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LineChart, Briefcase, Trophy, Shield } from 'lucide-react';
import { Toaster } from 'sonner';
import { useMarketStore } from '../store/marketStore';
import { useMarketConnection } from '../hooks/useMarketConnection';

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
  const username    = useMarketStore((s) => s.username);
  const setUsername = useMarketStore((s) => s.setUsername);
  const [input, setInput] = useState('');
  const pathname = usePathname();

  useMarketConnection(username);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="h-full bg-[#0a0a0c]" />;

  /* ── Login screen ──────────────────────────────────────────── */
  if (!username) {
    return (
      <div className="h-screen w-full bg-[#0a0a0c] flex items-center justify-center">
        <Toaster position="top-right" theme="dark" />
        <div className="w-full max-w-sm p-8 bg-[#111114] border border-[#1e293b] rounded-2xl flex flex-col items-center shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg mb-6">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-lg font-bold text-slate-100 mb-1 tracking-wide">Synthex Terminal</h1>
          <p className="text-xs text-slate-500 mb-8 text-center">Enter your trader handle to connect to the live market.</p>
          <form className="w-full flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); if (input.trim()) setUsername(input.trim()); }}>
            <div className="relative w-full flex items-center bg-[#1e293b]/60 border border-[#1e293b] rounded-xl focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <span className="pl-4 pr-1 text-slate-500 font-mono">@</span>
              <input type="text" placeholder="trader_handle" value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full py-3 pr-4 bg-transparent focus:outline-none font-mono text-slate-200 placeholder:text-slate-600"
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

  /* ── App shell ─────────────────────────────────────────────── */
  return (
    <>
      <Toaster position="top-right" theme="dark" />

      {/* Slim icon-only left nav */}
      <aside className="w-14 shrink-0 bg-[#111114] border-r border-[#1e293b]/60 flex flex-col items-center py-4 gap-2 z-50">
        <button
          onClick={() => setUsername(null)}
          className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-base shadow-[0_0_12px_rgba(59,130,246,0.4)] mb-2"
          title="Log out"
        >S</button>

        <nav className="flex flex-col gap-1 w-full items-center mt-2">
          {[
            { href: '/',            Icon: LineChart,  label: 'Trade'       },
          ].map(({ href, Icon, label }) => (
            <Link key={href} href={href} title={label}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                pathname === href
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-slate-600 hover:text-slate-300 hover:bg-[#1e293b]/40'
              }`}>
              <Icon size={18} strokeWidth={2} />
            </Link>
          ))}
        </nav>

        <div className="mt-auto">
          <Link href="/admin" title="Admin"
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              pathname === '/admin' ? 'text-slate-300 bg-[#1e293b]/60' : 'text-slate-700 hover:text-slate-400'
            }`}>
            <Shield size={16} strokeWidth={2} />
          </Link>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {children}
      </main>
    </>
  );
}
