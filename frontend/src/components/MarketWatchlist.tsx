'use client';

import { useRef, useEffect, useState } from 'react';
import { useMarketStore, OrderBookState } from '../store/marketStore';

const SYMBOLS = ['SYNX', 'NEXO', 'VRTX', 'AEGS'];

const BASE_PRICES: Record<string, number> = {
  'SYNX': 150.00,
  'NEXO': 45.50,
  'VRTX': 210.25,
  'AEGS': 85.00,
};

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function MarketWatchlist() {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111114] border-r border-slate-200 dark:border-[#1e293b]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-[#1e293b]">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">
          Market Watch
        </span>
        <span className="text-[9px] font-mono text-slate-500">
          4 symbols
        </span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {SYMBOLS.map((sym) => (
          <WatchRow key={sym} symbol={sym} />
        ))}
      </div>

      {/* Summary Footer */}
      <WatchFooter />
    </div>
  );
}

function WatchRow({ symbol }: { symbol: string }) {
  const data = useMarketStore((s) => s.marketPrices[symbol]);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);

  const prevMidRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  const mid = data ? (data.best_bid + data.best_ask) / 2 : null;
  const base = BASE_PRICES[symbol] ?? 100;
  const change = mid !== null ? mid - base : 0;
  const changePct = mid !== null ? ((mid - base) / base) * 100 : 0;
  const isUp = change >= 0;
  const isSelected = selectedSymbol === symbol;

  // Flash animation on price tick
  useEffect(() => {
    if (mid === null || prevMidRef.current === null) {
      prevMidRef.current = mid;
      return;
    }
    if (mid > prevMidRef.current) {
      setFlash('up');
    } else if (mid < prevMidRef.current) {
      setFlash('down');
    }
    prevMidRef.current = mid;
    const t = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(t);
  }, [mid]);

  return (
    <button
      onClick={() => setSelectedSymbol(symbol)}
      className={`
        w-full flex items-center justify-between px-4 py-3
        border-b border-slate-100 dark:border-[#1e293b]/50 transition-all duration-150 cursor-pointer
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/10'
          : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
        }
        ${flash === 'up' ? 'bg-emerald-50 dark:bg-emerald-500/[0.08]' : ''}
        ${flash === 'down' ? 'bg-red-50 dark:bg-red-500/[0.08]' : ''}
      `}
    >
      {/* Left: Symbol */}
      <div className="flex flex-col items-start">
        <span className={`text-[12px] font-bold tracking-wide ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
          ${symbol}
        </span>
        <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
          {data ? `Sprd: ${fmt(data.spread ?? 0, 4)}` : 'Syncing…'}
        </span>
      </div>

      {/* Right: Price + Change */}
      <div className="flex flex-col items-end">
        <span className={`text-[12px] font-mono font-bold tabular-nums transition-colors duration-200 ${
          mid === null ? 'text-slate-400 dark:text-slate-600' : isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {mid !== null ? fmt(mid) : '—'}
        </span>
        <span className={`text-[10px] font-mono tabular-nums mt-0.5 ${isUp ? 'text-emerald-500/80 dark:text-emerald-500/70' : 'text-red-500/80 dark:text-red-500/70'}`}>
          {change >= 0 ? '+' : ''}{fmt(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
        </span>
      </div>
    </button>
  );
}

function WatchFooter() {
  const marketPrices = useMarketStore((s) => s.marketPrices);
  const portfolio = useMarketStore((s) => s.portfolio);

  const totalHoldings = portfolio
    ? SYMBOLS.reduce((acc, sym) => {
        const qty = portfolio.positions?.find((p) => p.symbol === sym)?.quantity ?? 0;
        const mid = marketPrices[sym] ? (marketPrices[sym].best_bid + marketPrices[sym].best_ask) / 2 : 0;
        return acc + qty * mid;
      }, 0)
    : 0;

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-[#1e293b] px-4 py-3 bg-slate-50 dark:bg-[#0d1117]/50">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cash</span>
        <span className="text-[12px] font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
          ${portfolio?.fiat != null ? fmt(portfolio.fiat) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Holdings</span>
        <span className="text-[12px] font-mono font-bold text-slate-600 dark:text-slate-400 tabular-nums">
          ${fmt(totalHoldings)}
        </span>
      </div>
    </div>
  );
}
