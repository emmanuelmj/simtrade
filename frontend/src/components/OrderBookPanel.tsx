'use client';

import { useState, useRef } from 'react';
import { useMarketStore } from '../store/marketStore';
import { sendMarketOrder } from '../hooks/useMarketConnection';

const fmtP = (n: number) => n.toFixed(2);

function buildLevels(best: number, qty: number, side: 'ask' | 'bid', levels = 6) {
  const step = best * 0.0008;
  return Array.from({ length: levels }, (_, i) => {
    const offset = side === 'ask' ? i : levels - 1 - i;
    const price  = side === 'ask' ? best + step * offset : best - step * offset;
    const vol    = Math.max(10, qty * (1 - offset * 0.1) + (Math.random() - 0.5) * qty * 0.15);
    return { price, qty: Math.round(vol) };
  });
}

const GRID = 'grid-cols-[1fr_1fr_auto]';

interface RowProps {
  price: number;
  qty: number;
  side: 'bid' | 'ask';
  maxQty: number;
}

function BookRow({ price, qty, side, maxQty }: RowProps) {
  const pct = Math.min(100, (qty / maxQty) * 100);
  const isBid = side === 'bid';

  return (
    <div className={`grid ${GRID} relative text-[11px] font-mono py-[3px] px-3`}>
      <div
        className={`absolute top-0 bottom-0 transition-all duration-300 pointer-events-none ${
          isBid ? 'left-0 bg-blue-500/[0.08]' : 'right-0 bg-red-500/[0.08]'
        }`}
        style={{ width: `${pct}%` }}
      />
      <span className={`relative font-bold ${isBid ? 'text-blue-400/80' : 'text-red-400/80'}`}>
        {fmtP(price)}
      </span>
      <span className="relative text-right text-slate-500">{qty.toLocaleString()}</span>
      <span className="relative w-[1px]" />
    </div>
  );
}

export default function OrderBookPanel() {
  const selectedSymbol   = useMarketStore((s) => s.selectedSymbol);
  const marketPrices     = useMarketStore((s) => s.marketPrices);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const data             = marketPrices[selectedSymbol];

  if (!data) {
    return (
      <div className="h-full flex flex-col bg-[#111114]">
        <div className="shrink-0 px-3 py-2 border-b border-[#1e293b]/60">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">Order Book</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-[10px] text-slate-600">
          Syncing market data…
        </div>
      </div>
    );
  }

  const asks   = buildLevels(data.best_ask, data.ask_quantity, 'ask');
  const bids   = buildLevels(data.best_bid, data.bid_quantity, 'bid');
  const maxQty = Math.max(...asks.map(r => r.qty), ...bids.map(r => r.qty));
  const mid    = (data.best_bid + data.best_ask) / 2;

  const totalBid = data.bid_quantity;
  const totalAsk = data.ask_quantity;
  const total    = totalBid + totalAsk;
  const longPct  = total > 0 ? (totalBid / total) * 100 : 50;

  return (
    <div className="h-full flex flex-col bg-[#111114] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#1e293b]/60">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">Order Book</span>
        <span className="text-[9px] font-mono text-slate-600">${selectedSymbol}</span>
      </div>

      {/* Column headers */}
      <div className={`shrink-0 grid ${GRID} px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-slate-700 border-b border-[#1e293b]/30`}>
        <span>Price</span>
        <span className="text-right">Qty</span>
        <span />
      </div>

      {/* Book body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {[...asks].reverse().map((r, i) => (
          <BookRow key={`ask-${i}`} {...r} side="ask" maxQty={maxQty} />
        ))}

        {/* Mid divider */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#0d1117]">
          <div className="flex-1 h-px bg-[#1e293b]/60" />
          <span className="text-[10px] font-mono font-bold text-slate-300">{mid.toFixed(2)}</span>
          <span className="text-[8px] text-slate-600">mid</span>
          <div className="flex-1 h-px bg-[#1e293b]/60" />
        </div>

        {bids.map((r, i) => (
          <BookRow key={`bid-${i}`} {...r} side="bid" maxQty={maxQty} />
        ))}
      </div>

      {/* Sentiment bar */}
      <div className="shrink-0 px-3 pt-1 pb-2 border-t border-[#1e293b]/60">
        <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider mb-0.5">
          <span className="text-blue-400">Long {longPct.toFixed(0)}%</span>
          <span className="text-red-400">Short {(100 - longPct).toFixed(0)}%</span>
        </div>
        <div className="h-[2px] w-full rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${longPct}%` }} />
          <div className="h-full bg-red-500 flex-1" />
        </div>
      </div>
    </div>
  );
}
