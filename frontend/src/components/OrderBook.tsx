'use client';

import React, { useMemo } from 'react';
import { useMarketStore } from '../store/marketStore';
import { sendMarketOrder } from '../hooks/useMarketConnection';

function fmt(n: number, d = 2) {
  const decimals = n < 10 ? 4 : d;
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

interface Level {
  price: number;
  qty: number;
  orders: number;
  total: number;
}

export default function OrderBook() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const data = useMarketStore((s) => s.marketPrices[selectedSymbol]);

  const { bids, asks, maxQty } = useMemo(() => {
    if (!data) return { bids: [] as Level[], asks: [] as Level[], maxQty: 1 };

    const step = data.best_bid * 0.0004;
    const bidLevels: Level[] = [];
    const askLevels: Level[] = [];
    let cumBid = 0;
    let cumAsk = 0;

    for (let i = 0; i < 12; i++) {
      const bQty = Math.floor(Math.random() * 800) + 50;
      const aQty = Math.floor(Math.random() * 800) + 50;
      cumBid += bQty;
      cumAsk += aQty;
      bidLevels.push({
        price: data.best_bid - (i * step),
        qty: bQty,
        orders: Math.floor(Math.random() * 40) + 1,
        total: cumBid,
      });
      askLevels.push({
        price: data.best_ask + (i * step),
        qty: aQty,
        orders: Math.floor(Math.random() * 40) + 1,
        total: cumAsk,
      });
    }

    const allQty = [...bidLevels.map(l => l.qty), ...askLevels.map(l => l.qty)];
    return { bids: bidLevels, asks: askLevels.reverse(), maxQty: Math.max(...allQty) };
  }, [data]);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
        Loading Depth...
      </div>
    );
  }

  const mid = (data.best_bid + data.best_ask) / 2;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0d1117] select-none font-inter text-[10px]">

      {/* Header */}
      <div className="shrink-0 px-3 py-1.5 bg-slate-50 dark:bg-[#111114] border-b border-slate-200 dark:border-[#1e293b] flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Order Book</span>
        <span className="text-[9px] font-mono font-bold text-blue-500 uppercase tracking-wider">L2 Depth</span>
      </div>

      {/* Column Headers */}
      <div className="shrink-0 grid grid-cols-[40px_50px_1fr_68px_1fr_50px_40px] px-1 py-1 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-[#1e293b]/40 bg-slate-50/50 dark:bg-[#111114]/50">
        <span className="text-center">Ord</span>
        <span className="text-right pr-1">Qty</span>
        <span className="text-right pr-1">Bid</span>
        <span className="text-center">Price</span>
        <span className="pl-1">Ask</span>
        <span className="pl-1">Qty</span>
        <span className="text-center">Ord</span>
      </div>

      {/* Ask Rows (top section — sell side, sorted high to low) */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden">
        {asks.map((ask, i) => (
          <div
            key={`ask-${i}`}
            className="grid grid-cols-[40px_50px_1fr_68px_1fr_50px_40px] px-1 h-[22px] items-center hover:bg-red-500/5 transition-colors cursor-pointer group"
          >
            {/* Bid side — empty for ask rows */}
            <span />
            <span />
            <span />

            {/* Price */}
            <span className="text-center font-mono font-bold text-red-500 tabular-nums text-[10px]">
              {fmt(ask.price)}
            </span>

            {/* Ask bar + value */}
            <div className="relative h-[16px] flex items-center pl-1">
              <div
                className="absolute left-0 top-0 h-full bg-red-500/15 dark:bg-red-500/12 transition-all duration-200"
                style={{ width: `${(ask.qty / maxQty) * 100}%` }}
              />
              <span className="relative z-10 font-mono font-bold text-red-400 tabular-nums">{ask.qty}</span>
            </div>

            {/* Ask Qty */}
            <span className="font-mono font-bold text-slate-500 dark:text-slate-500 tabular-nums pl-1">{ask.total.toLocaleString()}</span>

            {/* Orders */}
            <span className="text-center font-mono text-slate-400 dark:text-slate-600 tabular-nums">{ask.orders}</span>
          </div>
        ))}
      </div>

      {/* Mid Price Bar */}
      <div className="shrink-0 grid grid-cols-[40px_50px_1fr_68px_1fr_50px_40px] px-1 h-[28px] items-center bg-slate-100 dark:bg-[#161b22] border-y border-slate-200 dark:border-[#1e293b]">
        <span />
        <span />
        <span />
        <span className="text-center font-mono font-black text-[12px] text-slate-800 dark:text-white tabular-nums">
          {fmt(mid)}
        </span>
        <span />
        <span />
        <span />
      </div>

      {/* Bid Rows (bottom section — buy side) */}
      <div className="flex-1 overflow-hidden">
        {bids.map((bid, i) => (
          <div
            key={`bid-${i}`}
            className="grid grid-cols-[40px_50px_1fr_68px_1fr_50px_40px] px-1 h-[22px] items-center hover:bg-emerald-500/5 transition-colors cursor-pointer group"
          >
            {/* Orders */}
            <span className="text-center font-mono text-slate-400 dark:text-slate-600 tabular-nums">{bid.orders}</span>

            {/* Bid Qty */}
            <span className="text-right font-mono font-bold text-slate-500 dark:text-slate-500 tabular-nums pr-1">{bid.total.toLocaleString()}</span>

            {/* Bid bar + value */}
            <div className="relative h-[16px] flex items-center justify-end pr-1">
              <div
                className="absolute right-0 top-0 h-full bg-emerald-500/15 dark:bg-emerald-500/12 transition-all duration-200"
                style={{ width: `${(bid.qty / maxQty) * 100}%` }}
              />
              <span className="relative z-10 font-mono font-bold text-emerald-400 tabular-nums">{bid.qty}</span>
            </div>

            {/* Price */}
            <span className="text-center font-mono font-bold text-emerald-500 tabular-nums text-[10px]">
              {fmt(bid.price)}
            </span>

            {/* Ask side — empty for bid rows */}
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>

      {/* Buy / Sell Buttons */}
      <div className="shrink-0 grid grid-cols-2 gap-0 border-t border-slate-200 dark:border-[#1e293b]">
        <button
          onClick={() => sendMarketOrder('BUY', selectedSymbol, 10)}
          className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.15em] border-r border-slate-200 dark:border-[#1e293b]"
        >
          BUY
        </button>
        <button
          onClick={() => sendMarketOrder('SELL', selectedSymbol, 10)}
          className="py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.15em]"
        >
          SELL
        </button>
      </div>
    </div>
  );
}
