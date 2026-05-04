'use client';

import { useMarketStore } from '../store/marketStore';
import { useRouter } from 'next/navigation';
import { Trophy, Medal, XCircle } from 'lucide-react';

export default function Podium() {
  const isCompleted = useMarketStore((s) => s.isCompleted);
  const leaderboard = useMarketStore((s) => s.leaderboard);
  const username = useMarketStore((s) => s.username);
  const router = useRouter();

  if (!isCompleted || !leaderboard) {
    return null;
  }

  const { rankings } = leaderboard;
  const top3 = rankings.slice(0, 3);
  const others = rankings.slice(3);

  // Helper to get podium styles based on rank
  const getPodiumStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'h-48 bg-amber-100 border-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.1)] dark:bg-amber-500/20 dark:border-amber-500 dark:shadow-[0_0_30px_rgba(245,158,11,0.2)]';
      case 2:
        return 'h-40 bg-slate-100 border-slate-300 shadow-[0_0_20px_rgba(203,213,225,0.2)] dark:bg-slate-300/20 dark:border-slate-300 dark:shadow-[0_0_20px_rgba(203,213,225,0.1)]';
      case 3:
        return 'h-32 bg-orange-100 border-orange-300 shadow-[0_0_20px_rgba(234,88,12,0.1)] dark:bg-orange-700/20 dark:border-orange-700 dark:shadow-[0_0_20px_rgba(194,65,12,0.1)]';
      default:
        return '';
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-amber-500 dark:text-amber-400';
      case 2: return 'text-slate-500 dark:text-slate-300';
      case 3: return 'text-orange-500 dark:text-orange-600';
      default: return 'text-slate-400 dark:text-slate-500';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-8 h-8 text-amber-500 dark:text-amber-400 mb-2" />;
      case 2: return <Medal className="w-6 h-6 text-slate-400 dark:text-slate-300 mb-2" />;
      case 3: return <Medal className="w-6 h-6 text-orange-500 dark:text-orange-600 mb-2" />;
      default: return null;
    }
  };

  // Reorder top 3 for display: 2, 1, 3
  const displayTop3 = [];
  if (top3[1]) displayTop3.push(top3[1]);
  if (top3[0]) displayTop3.push(top3[0]);
  if (top3[2]) displayTop3.push(top3[2]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b] rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        
        {/* Header */}
        <div className="text-center py-8 border-b border-slate-100 dark:border-[#1e293b] bg-gradient-to-b from-slate-50 to-white dark:from-[#1a1a24] dark:to-[#111114]">
          <h2 className="text-3xl font-bold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500 dark:from-blue-400 dark:to-emerald-400">
            Competition Completed
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">Final Settlement Prices have been applied to all portfolios.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Podium Area */}
          <div className="flex items-end justify-center gap-4 mb-12 mt-8 h-64">
            {displayTop3.map((entry) => (
              <div key={entry.username} className="flex flex-col items-center w-40">
                {/* Avatar / Name */}
                <div className="flex flex-col items-center mb-4">
                  {getRankIcon(entry.rank)}
                  <span className={`font-bold ${entry.username === username ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'} truncate w-full text-center px-2`}>
                    {entry.username}
                  </span>
                  <span className={`text-xs font-mono font-bold mt-1 ${entry.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {entry.pnl >= 0 ? '+' : ''}{entry.pnl_pct.toFixed(2)}%
                  </span>
                </div>
                
                {/* Block */}
                <div className={`w-full rounded-t-lg border-t border-l border-r flex items-center justify-center relative ${getPodiumStyle(entry.rank)}`}>
                  <span className={`text-5xl font-black opacity-20 absolute bottom-4 ${getRankColor(entry.rank)}`}>
                    {entry.rank}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono font-bold z-10 bg-white/80 dark:bg-[#111114]/80 px-2 py-1 rounded shadow-sm text-sm border border-slate-200 dark:border-transparent">
                    ${entry.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Rest of Leaderboard */}
          {others.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-4 border-b border-slate-200 dark:border-[#1e293b] pb-2">
                Runner Ups
              </h3>
              <div className="space-y-2">
                {others.map((entry) => (
                  <div key={entry.username} className={`flex items-center justify-between p-3 rounded-lg border ${
                    entry.username === username 
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-500/50' 
                      : 'bg-slate-50 border-slate-200 dark:bg-[#0a0a0c] dark:border-[#1e293b]'
                  }`}>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 dark:text-slate-500 font-bold font-mono w-6 text-right">#{entry.rank}</span>
                      <span className={`font-bold ${entry.username === username ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {entry.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-300 text-sm">
                        ${entry.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className={`font-mono font-bold text-sm w-20 text-right ${entry.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {entry.pnl >= 0 ? '+' : ''}{entry.pnl_pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#111114] flex justify-center">
          <button
            onClick={() => router.push('/lobby')}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-widest uppercase text-sm rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            Return to Lobby
          </button>
        </div>

      </div>
    </div>
  );
}
