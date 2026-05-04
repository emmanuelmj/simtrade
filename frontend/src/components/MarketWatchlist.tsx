'use client';

import { useRef, useEffect, useState } from 'react';
import { useMarketStore } from '../store/marketStore';

function fmt(n: number, d = 2) {
  // Use more decimals for small prices (Forex)
  const decimals = n < 10 ? 4 : d;
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function MarketWatchlist() {
  const marketPrices = useMarketStore((s) => s.marketPrices);
  const symbols = Object.keys(marketPrices).sort();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0d1117] border-r border-slate-200 dark:border-[#1e293b]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#1e293b] bg-slate-50/50 dark:bg-slate-900/20">
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
          Watchlist
        </span>
        <span className="text-[9px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
          {symbols.length}
        </span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {symbols.length === 0 ? (
          <div className="p-4 text-[10px] text-slate-400 uppercase tracking-widest text-center animate-pulse mt-4">
            Initializing Feed...
          </div>
        ) : (
          symbols.map((sym) => (
            <WatchRow key={sym} symbol={sym} />
          ))
        )}
      </div>

      {/* Summary Footer */}
      <WatchFooter symbols={symbols} />
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
  const prevLtp = data?.prev_ltp ?? null;
  const isSelected = selectedSymbol === symbol;

  // Flash animation on price tick — GREEN for up, RED for down
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

  // Compute real price change using previous LTP from the store
  const change = (mid !== null && prevLtp !== null) ? mid - prevLtp : 0;
  const changePct = (mid !== null && prevLtp !== null && prevLtp !== 0) 
    ? ((mid - prevLtp) / prevLtp) * 100 
    : 0;
  const isUp = change >= 0;

  return (
    <button
      onClick={() => setSelectedSymbol(symbol)}
      className={`
        w-full flex items-center justify-between px-4 py-3.5
        border-b border-slate-100 dark:border-[#1e293b]/30 transition-all duration-200 cursor-pointer
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-l-blue-500'
          : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border-l-2 border-l-transparent'
        }
        ${flash === 'up' ? '!bg-emerald-500/15 dark:!bg-emerald-500/10' : ''}
        ${flash === 'down' ? '!bg-red-500/15 dark:!bg-red-500/10' : ''}
      `}
    >
      <div className="flex flex-col items-start">
        <span className={`text-[12px] font-black tracking-tight ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
          {symbol}
        </span>
        <span className="text-[9px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">
          {data ? `VOL: ${((data.bid_quantity ?? 0) + (data.ask_quantity ?? 0)).toLocaleString()}` : 'OFFLINE'}
        </span>
      </div>

      <div className="flex flex-col items-end">
        {/* Price — color follows the FLASH direction */}
        <span className={`text-[12px] font-mono font-black tabular-nums transition-colors duration-300 ${
          mid === null ? 'text-slate-400 dark:text-slate-600'
            : flash === 'up' ? 'text-emerald-500'
            : flash === 'down' ? 'text-red-500'
            : isUp ? 'text-emerald-500' : 'text-red-500'
        }`}>
          {mid !== null ? fmt(mid) : '—'}
        </span>
        {/* Change indicator — uses real delta */}
        <div className={`flex items-center gap-1.5 text-[10px] font-mono font-bold mt-0.5 ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
          <span>{isUp ? '▲' : '▼'}</span>
          <span>{Math.abs(changePct).toFixed(2)}%</span>
        </div>
      </div>
    </button>
  );
}

function WatchFooter({ symbols }: { symbols: string[] }) {
  const marketPrices = useMarketStore((s) => s.marketPrices);
  const portfolio = useMarketStore((s) => s.portfolio);

  const totalHoldingsValue = portfolio
    ? symbols.reduce((acc, sym) => {
        const qty = portfolio.positions?.find((p) => p.symbol === sym)?.quantity ?? 0;
        const mid = marketPrices[sym] ? (marketPrices[sym].best_bid + marketPrices[sym].best_ask) / 2 : 0;
        return acc + qty * mid;
      }, 0)
    : 0;

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-[#1e293b] px-4 py-4 bg-slate-50/50 dark:bg-[#0d1117]">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Available Cash</span>
        <span className="text-[12px] font-mono font-black text-slate-800 dark:text-white">
          ${portfolio?.fiat != null ? fmt(portfolio.fiat) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Market Value</span>
        <span className="text-[12px] font-mono font-black text-blue-500">
          ${fmt(totalHoldingsValue)}
        </span>
      </div>
    </div>
  );
}
