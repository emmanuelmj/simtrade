'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMarketStore }   from '../../../store/marketStore';
import { useMarketConnection } from '../../../hooks/useMarketConnection';
import MarketWatchlist       from '../../../components/MarketWatchlist';
import TradingChart          from '../../../components/TradingChart';
import ExecutionControls     from '../../../components/ExecutionControls';
import OrderBook             from '../../../components/OrderBook';
import PositionsTable        from '../../../components/PositionsTable';
import Leaderboard           from '../../../components/Leaderboard';
import Podium                from '../../../components/Podium';

export default function ContestPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  const username         = useMarketStore((s) => s.username);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const selectedSymbol   = useMarketStore((s) => s.selectedSymbol);

  // Initialize WebSocket connection scoped to this competition
  useMarketConnection(competitionId, username);

  const [bottomTab, setBottomTab] = useState<'positions' | 'holdings' | 'leaderboard'>('positions');

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8f9fa] dark:bg-[#0a0a0c] overflow-hidden font-inter">
      
      <Podium />

      <header className="shrink-0 h-12 flex items-center justify-between px-4 bg-white dark:bg-[#111114] border-b border-slate-200 dark:border-[#1e293b] shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400"
            title="Return to Lobby"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h1 className="text-[13px] font-black tracking-tighter uppercase text-slate-900 dark:text-white">
            SYNTHEX <span className="text-blue-600 dark:text-blue-500 font-black">PRO</span>
          </h1>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{username}</span>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-black tracking-widest uppercase">Trading Arena</span>
        </div>

        <div className="flex items-center gap-4">
          <ISTClock />
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-[0.2em] ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-500'
              : connectionStatus === 'connecting'
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-red-500/10 text-red-500'
          }`}>
            <span className={`w-1 h-1 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500' :
              connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
            }`} />
            {connectionStatus}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex bg-[#f8f9fa] dark:bg-[#060608]">

        <div className="w-[22%] min-w-[280px] max-w-[340px] flex flex-col bg-white dark:bg-[#0d1117] border-r border-slate-200 dark:border-[#1e293b]">
          <MarketWatchlist />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          
          <div className="flex-[3] min-h-0 flex border-b border-slate-200 dark:border-[#1e293b]">
            <div className="flex-1 min-w-0 relative bg-white dark:bg-[#0d1117]">
              <TradingChart />
            </div>
            
            <div className="w-[320px] shrink-0 flex flex-col border-l border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#111114]">
              <div className="flex-1 min-h-0">
                <OrderBook />
              </div>
              <div className="h-[360px] shrink-0">
                <ExecutionControls />
              </div>
            </div>
          </div>

          <div className="flex-[1.5] min-h-0 flex flex-col bg-white dark:bg-[#111114]">
            <div className="shrink-0 flex items-center border-b border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-slate-900/40">
              {([
                { id: 'positions', label: 'Active Positions' },
                { id: 'holdings',  label: 'Holdings' },
                { id: 'leaderboard', label: 'Leaderboard' },
              ] as const).map(({ id, label }) => (
                <button key={id} onClick={() => setBottomTab(id)}
                  className={`px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    bottomTab === id
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-[#111114]'
                      : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 border-b-2 border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {bottomTab === 'positions' && <PositionsTable mode="positions" />}
              {bottomTab === 'holdings' && <PositionsTable mode="holdings" />}
              {bottomTab === 'leaderboard' && <Leaderboard />}
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
