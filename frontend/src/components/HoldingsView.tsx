'use client';

import { useMarketStore } from '../store/marketStore';
import { Briefcase, TrendingUp, ArrowRightLeft } from 'lucide-react';

export default function HoldingsView() {
  const portfolio = useMarketStore((s) => s.portfolio);
  const orderbook = useMarketStore((s) => s.orderbook);
  
  const currentPrice = orderbook?.best_bid ?? 0;
  
  // For MVP, we only have ORIS. In future, we loop through holdings.
  const holdings = Object.entries(portfolio?.holdings ?? {}).map(([symbol, qty]) => {
    // Mock prices for other assets if they exist, but for now just ORIS
    const price = symbol === 'ORIS' ? currentPrice : 0;
    return {
      symbol,
      quantity: qty,
      price: price,
      totalValue: qty * price
    };
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 bg-[#0a0a0c]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Portfolio Holdings</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Settled Asset Balances</p>
        </div>
      </div>

      <div className="bg-[#111114] border border-[#1e293b]/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#16161a] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4 text-right">Balance</th>
                <th className="px-6 py-4 text-right">Market Price</th>
                <th className="px-6 py-4 text-right">Estimated Value</th>
                <th className="px-6 py-4 text-right">Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/40">
              {holdings.length > 0 ? holdings.map((h, i) => (
                <tr key={i} className="hover:bg-[#1e293b]/20 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                        {h.symbol[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-100">{h.symbol}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Spot Wallet</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-mono font-bold text-slate-100">{h.quantity.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-mono text-slate-300">${h.price.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-mono font-bold text-emerald-400">${h.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: '100%' }}></div>
                       </div>
                       <span className="text-[10px] font-mono text-slate-500">100%</span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <Briefcase size={48} className="text-slate-500 mb-4" />
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">No Holdings Found</p>
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
