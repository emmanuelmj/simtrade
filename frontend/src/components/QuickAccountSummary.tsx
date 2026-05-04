'use client';

import { useMarketStore } from '../store/marketStore';

export default function QuickAccountSummary() {
  const portfolio = useMarketStore((state) => state.portfolio);
  const marketPrices = useMarketStore((state) => state.marketPrices);

  const totalPositions = portfolio?.positions
    ? portfolio.positions.reduce((acc, pos) => {
        const d = marketPrices[pos.symbol];
        const ltp = d ? (d.best_bid + d.best_ask) / 2 : 0;
        return acc + pos.quantity * ltp;
      }, 0)
    : 0;

  return (
    <div className="h-full flex flex-col p-4 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 overflow-hidden">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">Account Summary</h3>
      
      <div className="flex-1 flex flex-col justify-center gap-4 min-h-0">
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 flex flex-col justify-center shadow-sm">
          <span className="text-xs text-zinc-500 mb-1">Available Fiat</span>
          <span className="text-xl font-mono font-semibold text-zinc-900 tracking-tight">
            ${portfolio ? portfolio.fiat.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
          </span>
        </div>
        
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 flex flex-col justify-center shadow-sm">
          <span className="text-xs text-zinc-500 mb-1">Holdings Value</span>
          <span className="text-xl font-mono font-semibold text-zinc-900 tracking-tight">
            ${totalPositions.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </div>
      </div>
    </div>
  );
}
