'use client';

import { motion } from 'framer-motion';
import { useMarketStore } from '../store/marketStore';
import { Trophy, TrendingUp, User } from 'lucide-react';

export default function Leaderboard() {
  const leaderboard = useMarketStore((state) => state.leaderboard);
  const myUsername = useMarketStore((state) => state.username);

  if (!leaderboard || !leaderboard.rankings || leaderboard.rankings.length === 0) {
    return (
      <div className="h-full flex flex-col p-8 bg-slate-50 dark:bg-[#0d1117] items-center justify-center text-center">
        <div className="p-4 bg-slate-200 dark:bg-slate-800/30 rounded-full text-slate-400 dark:text-slate-600 mb-4">
          <Trophy size={48} />
        </div>
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">Rankings Syncing</h3>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">Please wait for the next market tick to update rankings.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-white dark:bg-[#111114] overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Market Leaderboard</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Real-time Performance Ranking</p>
        </div>
        <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#1e293b]/60 rounded-lg">
          <TrendingUp size={14} className="text-blue-500 dark:text-blue-400" />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Index LTP: <span className="text-slate-700 dark:text-slate-200 font-mono">${leaderboard.ltp_used.toFixed(2)}</span>
          </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 gap-2.5">
          {leaderboard.rankings.map((entry) => (
            <motion.div
              key={entry.username}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                entry.username === myUsername 
                  ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-200 dark:border-blue-500/40 shadow-sm' 
                  : 'bg-white dark:bg-[#111114] border-slate-200 dark:border-[#1e293b] hover:border-blue-300 dark:hover:border-[#3b82f6]/40 shadow-sm dark:shadow-none'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shadow-sm
                  ${entry.rank === 1 ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-yellow-900 dark:from-yellow-400 dark:to-amber-600 dark:text-black' : 
                    entry.rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 dark:from-slate-300 dark:to-slate-500 dark:text-black' : 
                    entry.rank === 3 ? 'bg-gradient-to-br from-orange-300 to-red-500 text-orange-950 dark:from-orange-400 dark:to-red-700 dark:text-white' : 
                    'bg-slate-100 dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1e293b]'}`}
                >
                  {entry.rank}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{entry.username}</span>
                    {entry.username === myUsername && (
                      <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">You</span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">Verified Trader</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Valuation</span>
                  <span className="text-[13px] font-mono font-bold text-slate-800 dark:text-slate-100">
                    ${entry.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-[#1e293b]"></div>
                <div className="flex flex-col items-end min-w-[80px]">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">PnL Session</span>
                  <div className="flex items-center gap-1">
                     <span className={`text-[13px] font-mono font-bold ${entry.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
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
