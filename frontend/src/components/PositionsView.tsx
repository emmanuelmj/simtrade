'use client';

import { useMarketStore } from '../store/marketStore';
import { TrendingUp, ArrowUpRight, ArrowDownRight, LayoutPanelTop } from 'lucide-react';

export default function PositionsView() {
  const portfolio = useMarketStore((s) => s.portfolio);
  const orderbook = useMarketStore((s) => s.orderbook);
  
  const currentPrice = orderbook?.best_bid ?? 0;
  
  const positions = (portfolio?.positions ?? []).map(p => {
    const unrealizedPnl = (currentPrice - p.avg_price) * p.quantity;
    const pnlPct = p.avg_price > 0 ? ((currentPrice - p.avg_price) / p.avg_price) * 100 : 0;
    
    return {
      ...p,
      currentPrice,
      unrealizedPnl,
      pnlPct
    };
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 bg-[#0a0a0c]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Active Positions</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Real-time Unrealized P&L Tracking</p>
        </div>
      </div>

      <div className="bg-[#111114] border border-[#1e293b]/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#16161a] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4 text-right">Size</th>
                <th className="px-6 py-4 text-right">Entry Price</th>
                <th className="px-6 py-4 text-right">Market Price</th>
                <th className="px-6 py-4 text-right">Unrealized P&L</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/40">
              {positions.length > 0 ? positions.map((p, i) => (
                <tr key={i} className="hover:bg-[#1e293b]/20 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${p.unrealizedPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {p.symbol[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-100">{p.symbol}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Spot Long</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-mono font-bold text-slate-100">{p.quantity.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-mono text-slate-400">${p.avg_price.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-mono text-slate-200">${p.currentPrice.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <p className={`text-sm font-mono font-bold ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl.toFixed(2)}
                      </p>
                      <span className={`text-[10px] font-bold flex items-center ${p.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.pnlPct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(p.pnlPct).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all uppercase tracking-wider">
                      Market Close
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <TrendingUp size={48} className="text-slate-500 mb-4" />
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">No Active Positions</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
