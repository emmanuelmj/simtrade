'use client';

import { useMarketStore } from '../store/marketStore';

const SYMBOLS = ['SYNX', 'NEXO', 'VRTX', 'AEGS'];
const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PositionsTable() {
  const portfolio    = useMarketStore((s) => s.portfolio);
  const marketPrices = useMarketStore((s) => s.marketPrices);

  if (!portfolio || !portfolio.positions) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-slate-500 font-mono">
        No positions yet
      </div>
    );
  }

  const rows = SYMBOLS.map((sym) => {
    const pos = portfolio.positions.find((p) => p.symbol === sym);
    const qty = pos?.quantity ?? 0;
    const avg = pos?.avg_price ?? 0;
    const data = marketPrices[sym];
    const ltp = data ? (data.best_bid + data.best_ask) / 2 : 0;
    const currentValue = qty * ltp;
    const investedValue = qty * avg;
    const pnl = currentValue - investedValue;
    const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return { symbol: sym, qty, avg, ltp, currentValue, pnl, pnlPct };
  });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111114] overflow-hidden">
      {/* Column headers */}
      <div className="shrink-0 grid grid-cols-6 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#0d1117]/50">
        <span>Symbol</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Avg</span>
        <span className="text-right">LTP</span>
        <span className="text-right">Cur. Val</span>
        <span className="text-right">P&L</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.symbol}
            className={`grid grid-cols-6 px-4 py-3 text-[11px] font-mono border-b border-slate-100 dark:border-[#1e293b]/50 transition-colors
              ${r.qty > 0 ? 'hover:bg-slate-50 dark:hover:bg-white/[0.02]' : 'opacity-40'}
            `}
          >
            <span className="text-slate-800 dark:text-slate-200 font-bold">${r.symbol}</span>
            <span className="text-right text-slate-600 dark:text-slate-400">{r.qty}</span>
            <span className="text-right text-slate-500 dark:text-slate-500">{r.avg > 0 ? fmt(r.avg) : '—'}</span>
            <span className="text-right text-slate-600 dark:text-slate-400">{r.ltp > 0 ? fmt(r.ltp) : '—'}</span>
            <span className="text-right text-slate-700 dark:text-slate-300">{r.qty > 0 ? fmt(r.currentValue) : '—'}</span>
            <span className={`text-right font-bold ${r.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {r.qty > 0 ? `${r.pnl >= 0 ? '+' : ''}${fmt(r.pnl)}` : '—'}
              {r.qty > 0 && (
                <span className="text-[9px] ml-1 opacity-60">
                  ({r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
