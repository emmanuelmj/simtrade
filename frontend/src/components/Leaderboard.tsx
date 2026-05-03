'use client';

import { motion } from 'framer-motion';
import { useMarketStore } from '../store/marketStore';
import { Trophy, TrendingUp, User } from 'lucide-react';

export default function Leaderboard() {
  const leaderboard = useMarketStore((state) => state.leaderboard);
  const myUsername = useMarketStore((state) => state.username);

  if (!leaderboard || !leaderboard.rankings || leaderboard.rankings.length === 0) {
    return (
      <div className="h-full flex flex-col p-8 bg-[#0a0a0c] rounded-2xl border border-[#1e293b]/60 shadow-2xl items-center justify-center text-center">
        <div className="p-4 bg-slate-800/30 rounded-full text-slate-600 mb-4">
          <Trophy size={48} />
        </div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Rankings Syncing</h3>
        <p className="text-[10px] text-slate-600 font-medium">Please wait for the next market tick to update rankings.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 bg-[#0a0a0c] overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Market Leaderboard</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Real-time Performance Ranking</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-[#111114] border border-[#1e293b]/60 rounded-xl">
          <TrendingUp size={14} className="text-blue-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Index LTP: <span className="text-slate-100 font-mono">${leaderboard.ltp_used.toFixed(2)}</span>
          </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 gap-3">
          {leaderboard.rankings.map((entry) => (
            <motion.div
              key={entry.username}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                entry.username === myUsername 
                  ? 'bg-blue-600/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                  : 'bg-[#111114] border-[#1e293b]/60 hover:border-[#3b82f6]/40'
              }`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg
                  ${entry.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black' : 
                    entry.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-black' : 
                    entry.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-red-700 text-white' : 
                    'bg-[#1e293b] text-slate-400 border border-[#1e293b]'}`}
                >
                  {entry.rank}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">{entry.username}</span>
                    {entry.username === myUsername && (
                      <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">You</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">Verified Trader</p>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Valuation</span>
                  <span className="text-sm font-mono font-bold text-slate-100">
                    ${entry.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-px h-8 bg-[#1e293b]"></div>
                <div className="flex flex-col items-end min-w-[90px]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">PnL Session</span>
                  <div className="flex items-center gap-1">
                     <span className={`text-sm font-mono font-bold ${entry.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)}
                     </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
