'use client';

import { useMarketStore } from '../store/marketStore';
import { sendMarketOrder } from '../hooks/useMarketConnection';
import TradingChart      from '../components/TradingChart';
import OrderBookPanel    from '../components/OrderBookPanel';
import ExecutionControls from '../components/ExecutionControls';
import DrawingToolbar    from '../components/DrawingToolbar';
import UtilityStack      from '../components/UtilityStack';

import DashboardOverview from '../components/DashboardOverview';
import HoldingsView      from '../components/HoldingsView';
import PositionsView     from '../components/PositionsView';
import Leaderboard       from '../components/Leaderboard';

export default function Dashboard() {
  const username         = useMarketStore((s) => s.username);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const currentView      = useMarketStore((s) => s.currentView);

  return (
    /**
     * Root column: header + workspace
     * h-screen → pin to viewport
     * overflow-hidden → nothing bleeds
     */
    <div className="flex flex-col h-screen w-full bg-[#0a0a0c] text-slate-100 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 flex items-center justify-between px-5 bg-[#111114] border-b border-[#1e293b]/70">
        <div className="flex items-center gap-3">
          <h1 className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300">
            Synthex&nbsp;<span className="text-blue-400">Terminal</span>
          </h1>
          <span className="text-[10px] text-slate-600 font-mono">|</span>
          <span className="text-[10px] text-slate-500 font-mono">{username}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* IST clock */}
          <ISTClock />

          {/* Connection pill */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : connectionStatus === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
              : 'bg-red-500/10 border-red-500/25 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              connectionStatus === 'connected' ? 'bg-emerald-400' :
              connectionStatus === 'connecting' ? 'bg-amber-400' : 'bg-red-400'
            }`} />
            {connectionStatus}
          </div>
        </div>
      </header>

      {/* ── Workspace ──────────────────────────────────────────── */}
      {/**
       * Grid layout – columns:
       *   [tools=40px] [utils=56px] [content=1fr] ([sidebar=300px] if Terminal)
       */}
      <div
        className="flex-1 min-h-0 grid p-2 gap-2"
        style={{ 
          gridTemplateColumns: currentView === 'TERMINAL' ? '40px 56px 1fr 300px' : '40px 56px 1fr', 
          gridTemplateRows: '1fr' 
        }}
      >

        {/* Navigation - Always visible */}
        <DrawingToolbar />
        <UtilityStack />

        {/* Dynamic Content */}
        {currentView === 'TERMINAL' ? (
          <>
            {/* Col 3 – Main chart */}
            <div className="min-h-0 min-w-0 rounded-xl overflow-hidden border border-[#1e293b]/60 bg-[#111114]">
              <TradingChart />
            </div>

            {/* Col 4 – Right sidebar: Trade block + Order book */}
            <div
              className="min-h-0 grid gap-2"
              style={{ gridTemplateRows: '44% 56%' }}
            >
              <div className="min-h-0 overflow-y-auto rounded-xl border border-[#1e293b]/60">
                <ExecutionControls onSendOrder={sendMarketOrder} />
              </div>
              <div className="min-h-0 rounded-xl border border-[#1e293b]/60 overflow-hidden">
                <OrderBookPanel />
              </div>
            </div>
          </>
        ) : currentView === 'DASHBOARD' ? (
          <div className="min-h-0 min-w-0 rounded-xl overflow-hidden border border-[#1e293b]/60 bg-[#111114]">
            <DashboardOverview />
          </div>
        ) : currentView === 'HOLDINGS' ? (
          <div className="min-h-0 min-w-0 rounded-xl overflow-hidden border border-[#1e293b]/60 bg-[#111114]">
            <HoldingsView />
          </div>
        ) : currentView === 'POSITIONS' ? (
          <div className="min-h-0 min-w-0 rounded-xl overflow-hidden border border-[#1e293b]/60 bg-[#111114]">
            <PositionsView />
          </div>
        ) : currentView === 'LEADERBOARD' ? (
          <div className="min-h-0 min-w-0 rounded-xl overflow-hidden border border-[#1e293b]/60 bg-[#111114]">
            <Leaderboard />
          </div>
        ) : (
          <div className="min-h-0 min-w-0 rounded-xl flex items-center justify-center border border-[#1e293b]/60 bg-[#111114]">
             <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-700 tracking-[0.4em] uppercase mb-2">{currentView}</h2>
                <p className="text-[10px] font-bold text-blue-500/50 uppercase tracking-widest">Interface development in progress</p>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ── IST Clock widget ──────────────────────────────────────── */
import { useEffect, useState } from 'react';

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
    <span className="text-[11px] font-mono text-slate-400 tracking-widest">
      {time} <span className="text-slate-600">IST</span>
    </span>
  );
}
