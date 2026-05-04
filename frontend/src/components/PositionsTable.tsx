'use client';

import { useMarketStore } from '../store/marketStore';
import { sendMarketOrder } from '../hooks/useMarketConnection';

const fmt = (n: number, d = 2) => {
  const decimals = n < 10 ? 4 : d;
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

interface PositionsTableProps {
  mode?: 'positions' | 'holdings';
}

export default function PositionsTable({ mode = 'positions' }: PositionsTableProps) {
  const portfolio    = useMarketStore((s) => s.portfolio);
  const marketPrices = useMarketStore((s) => s.marketPrices);
  const symbols      = Object.keys(marketPrices).sort();

  if (!portfolio || !portfolio.positions) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
        No Activity Detected
      </div>
    );
  }

  const rows = symbols.map((sym) => {
    const pos = portfolio.positions?.find((p) => p.symbol === sym);
    const qty = pos?.quantity ?? 0;
    const avg = pos?.avg_price ?? 0;
    const data = marketPrices[sym];
    const ltp = data ? (data.best_bid + data.best_ask) / 2 : 0;
    const currentValue = qty * ltp;
    const investedValue = qty * avg;
    const pnl = currentValue - investedValue;
    const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return { symbol: sym, qty, avg, ltp, currentValue, pnl, pnlPct };
  }).filter(r => r.qty > 0);

  if (rows.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Empty {mode}
        </div>
        <p className="text-[9px] mt-2 max-w-[140px]">Execute a market order to populate this ledger.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0d1117] overflow-hidden select-none">
      {/* Column headers */}
      <div className="shrink-0 grid grid-cols-6 px-5 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200 dark:border-[#1e293b] bg-slate-50/50 dark:bg-slate-900/20">
        <span>Asset</span>
        <span className="text-right">Quantity</span>
        <span className="text-right">{mode === 'holdings' ? 'Avg Cost' : 'Entry Price'}</span>
        <span className="text-right">LTP</span>
        <span className="text-right">Market Value</span>
        <span className="text-right">P&L (%)</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {rows.map((r) => (
          <div key={r.symbol}
            className="grid grid-cols-6 px-5 py-4 text-[11px] font-mono border-b border-slate-100 dark:border-[#1e293b]/30 transition-all hover:bg-slate-50 dark:hover:bg-white/[0.02] group"
          >
            <div className="flex items-center gap-3">
              <span className="text-slate-900 dark:text-white font-black">{r.symbol}</span>
              {mode === 'positions' && (
                <button
                  onClick={() => sendMarketOrder('SELL', r.symbol, r.qty)}
                  className="opacity-0 group-hover:opacity-100 flex items-center justify-center px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-[8px] font-black uppercase tracking-tighter"
                  title="Square Off Position"
                >
                  Exit
                </button>
              )}
            </div>
            
            <span className="text-right text-slate-600 dark:text-slate-400 font-bold tabular-nums">
              {r.qty.toLocaleString()}
            </span>
            
            <span className="text-right text-slate-500 dark:text-slate-500 tabular-nums font-medium">
              {fmt(r.avg)}
            </span>
            
            <span className="text-right text-slate-900 dark:text-slate-200 tabular-nums font-black">
              {fmt(r.ltp)}
            </span>
            
            <span className="text-right text-slate-700 dark:text-slate-300 tabular-nums font-bold">
              {fmt(r.currentValue)}
            </span>
            
            <div className={`text-right font-black flex flex-col items-end justify-center leading-none ${r.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              <span className="text-[11px] tabular-nums">
                {r.pnl >= 0 ? '+' : ''}{fmt(r.pnl)}
              </span>
              <span className="text-[9px] font-bold opacity-70 mt-1">
                {r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
