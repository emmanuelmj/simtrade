'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useMarketStore }   from '../../../store/marketStore';
import { useMarketConnection } from '../../../hooks/useMarketConnection';
import MarketWatchlist       from '../../../components/MarketWatchlist';
import TradingChart          from '../../../components/TradingChart';
import ExecutionControls     from '../../../components/ExecutionControls';
import PositionsTable        from '../../../components/PositionsTable';
import Leaderboard           from '../../../components/Leaderboard';
import Podium                from '../../../components/Podium';

type BottomTab = 'positions' | 'leaderboard';

export default function ContestPage() {
  const params = useParams();
  const competitionId = params.id as string;
  
  const username         = useMarketStore((s) => s.username);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const selectedSymbol   = useMarketStore((s) => s.selectedSymbol);

  // Initialize WebSocket connection scoped to this competition
  useMarketConnection(competitionId, username);

  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8f9fa] dark:bg-[#0a0a0c] text-slate-800 dark:text-slate-100 overflow-hidden font-inter">
      
      {/* Podium Modal Overlay (mounted conditionally if game is over) */}
      <Podium />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 flex items-center justify-between px-4 bg-white dark:bg-[#111114] border-b border-slate-200 dark:border-[#1e293b] shadow-sm z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-[13px] font-bold tracking-wide uppercase text-slate-800 dark:text-slate-200">
            Synthex <span className="text-blue-600 dark:text-blue-400">Kite</span>
          </h1>
          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
          <span className="text-[11px] font-medium text-slate-500">{username}</span>
          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
          <span className="text-[12px] text-blue-600 dark:text-blue-400 font-bold">${selectedSymbol}</span>
        </div>

        <div className="flex items-center gap-4">
          <ISTClock />
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
            connectionStatus === 'connected'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : connectionStatus === 'connecting'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
              : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500 dark:bg-emerald-400' :
              connectionStatus === 'connecting' ? 'bg-amber-500 dark:bg-amber-400 animate-pulse' : 'bg-red-500 dark:bg-red-400'
            }`} />
            {connectionStatus}
          </div>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex bg-[#f8f9fa] dark:bg-[#0a0a0c]">

        {/* Left Sidebar: Market Watchlist (30%) */}
        <div className="w-[30%] min-w-[300px] max-w-[400px] flex flex-col bg-white dark:bg-[#111114] border-r border-slate-200 dark:border-[#1e293b]">
          <MarketWatchlist />
        </div>

        {/* Right Content: Trading Desk (70%) */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Top Section: Chart & Execution Panel */}
          <div className="flex-[3] min-h-0 flex border-b border-slate-200 dark:border-[#1e293b]">
            <div className="flex-1 min-w-0 relative">
              <TradingChart />
            </div>
            <div className="w-[280px] shrink-0 border-l border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#111114]">
              <ExecutionControls />
            </div>
          </div>

          {/* Bottom Tabs: Positions / Leaderboard */}
          <div className="flex-[2] min-h-0 flex flex-col bg-white dark:bg-[#111114]">
            {/* Tab bar */}
            <div className="shrink-0 flex items-center border-b border-slate-200 dark:border-[#1e293b]">
              {([
                { id: 'positions' as BottomTab, label: 'Positions' },
                { id: 'leaderboard' as BottomTab, label: 'Leaderboard' },
              ]).map(({ id, label }) => (
                <button key={id} onClick={() => setBottomTab(id)}
                  className={`px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    bottomTab === id
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 border-b-2 border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {bottomTab === 'positions' ? <PositionsTable /> : <Leaderboard />}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── IST Clock widget ──────────────────────────────────────── */
function ISTClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-[11px] font-mono text-slate-500 tracking-wide tabular-nums">
      {time}
    </span>
  );
}
