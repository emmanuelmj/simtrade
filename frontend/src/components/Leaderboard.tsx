'use client';

import { motion } from 'framer-motion';
import { useMarketStore } from '../store/marketStore';

export default function Leaderboard() {
  const leaderboard = useMarketStore((state) => state.leaderboard);

  if (!leaderboard || !leaderboard.rankings || leaderboard.rankings.length === 0) {
    return (
      <div className="h-full flex flex-col p-6 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900 mb-6">Current Rankings</h3>
        <div className="flex-1 flex items-center justify-center text-zinc-400">
          No rankings available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-semibold text-zinc-900">Current Rankings</h3>
        <span className="text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
          Valuation at LTP: <span className="text-zinc-900">${leaderboard.ltp_used.toFixed(2)}</span>
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-3 -mr-3 min-h-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        <ul className="flex flex-col gap-3 m-0 p-0">
          {leaderboard.rankings.map((entry) => (
            <motion.div
              key={entry.username}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center justify-between p-4 rounded-xl bg-white border border-zinc-100 shadow-sm hover:border-zinc-200 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm
                  ${entry.rank === 1 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 
                    entry.rank === 2 ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 
                    entry.rank === 3 ? 'bg-orange-50 text-orange-700 border border-orange-100' : 
                    'bg-zinc-50 text-zinc-400 border border-zinc-100'}`}
                >
                  {entry.rank}
                </div>
                <span className="text-base font-medium text-zinc-900">
                  {entry.username}
                </span>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-zinc-400 mb-0.5">Total Value</span>
                  <span className="text-base font-mono font-medium text-zinc-900">
                    ${entry.total_value.toFixed(2)}
                  </span>
                </div>
                <div className="w-px h-8 bg-zinc-100"></div>
                <div className="flex flex-col items-end min-w-[80px]">
                  <span className="text-xs text-zinc-400 mb-0.5">Net PnL</span>
                  <span className={`text-base font-mono font-medium ${entry.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </ul>
      </div>
    </div>
  );
}
