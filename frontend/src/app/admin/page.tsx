'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ADMIN_KEY = 'supersecretadmin'; // Default from config

export default function AdminRemote() {
  const [marketState, setMarketState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // News form state
  const [title, setTitle] = useState('');
  const [sentiment, setSentiment] = useState('BULLISH');
  const [magnitude, setMagnitude] = useState(0.05);
  const [duration, setDuration] = useState(10);

  const fetchMarketState = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/market-state`, {
        headers: { 'X-Admin-Key': ADMIN_KEY }
      });
      if (res.ok) {
        setMarketState(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMarketState();
    const interval = setInterval(fetchMarketState, 2000);
    return () => clearInterval(interval);
  }, []);

  const injectNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/inject-news`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY
        },
        body: JSON.stringify({
          title,
          sentiment,
          magnitude: Number(magnitude),
          duration_seconds: Number(duration)
        })
      });
      fetchMarketState();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const resetSession = async () => {
    if (!confirm('Are you sure you want to reset the entire session?')) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/reset-session`, {
        method: 'POST',
        headers: { 'X-Admin-Key': ADMIN_KEY }
      });
      fetchMarketState();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8 text-zinc-300">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-3xl border border-zinc-800 p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-6">Admin Remote</h1>
        
        {/* Market State Monitor */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-800 p-4 rounded-xl">
            <p className="text-xs text-zinc-500 mb-1">Fair Value</p>
            <p className="text-lg font-mono text-white">${marketState?.fair_value?.toFixed(2) || '...'}</p>
          </div>
          <div className="bg-zinc-800 p-4 rounded-xl">
            <p className="text-xs text-zinc-500 mb-1">Spread</p>
            <p className="text-lg font-mono text-white">{marketState?.spread?.toFixed(2) || '...'}</p>
          </div>
          <div className="bg-zinc-800 p-4 rounded-xl">
            <p className="text-xs text-zinc-500 mb-1">Trades</p>
            <p className="text-lg font-mono text-white">{marketState?.total_trades_this_session || 0}</p>
          </div>
          <div className="bg-zinc-800 p-4 rounded-xl">
            <p className="text-xs text-zinc-500 mb-1">Active News</p>
            <p className="text-sm font-medium text-white truncate">{marketState?.active_news_event?.title || 'None'}</p>
          </div>
        </div>

        <div className="space-y-8 border-t border-zinc-800 pt-8">
          {/* Inject News */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Inject News Event</h2>
            <form onSubmit={injectNews} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" placeholder="Headline" value={title} onChange={e => setTitle(e.target.value)}
                className="col-span-1 md:col-span-2 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-zinc-600 outline-none" required
              />
              <select value={sentiment} onChange={e => setSentiment(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-zinc-600 outline-none">
                <option value="BULLISH">Bullish (+)</option>
                <option value="BEARISH">Bearish (-)</option>
                <option value="MOON">Moon (++)</option>
                <option value="CRASH">Crash (--)</option>
              </select>
              <input 
                type="number" step="0.01" placeholder="Magnitude (e.g. 0.05)" value={magnitude} onChange={e => setMagnitude(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-zinc-600 outline-none" required
              />
              <input 
                type="number" placeholder="Duration (s)" value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-zinc-600 outline-none" required
              />
              <button disabled={loading} type="submit" className="col-span-1 md:col-span-2 bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-2 rounded-lg transition-colors">
                Fire Event
              </button>
            </form>
          </div>

          {/* Reset Session */}
          <div className="border-t border-zinc-800 pt-8">
            <h2 className="text-sm font-semibold text-rose-500 mb-4 uppercase tracking-wider">Danger Zone</h2>
            <button 
              onClick={resetSession} disabled={loading}
              className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 font-medium py-3 rounded-lg transition-colors"
            >
              Reset Session (Clear DB)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
