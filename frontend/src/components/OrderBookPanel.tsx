'use client';

import { useState, useRef } from 'react';
import { useMarketStore } from '../store/marketStore';
import { sendMarketOrder } from '../hooks/useMarketConnection';

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtP = (n: number) => n.toFixed(2);
const fmtQ = (n: number) => n.toLocaleString();

function buildLevels(best: number, qty: number, side: 'ask' | 'bid', levels = 8) {
  const step = best * 0.0008;
  return Array.from({ length: levels }, (_, i) => {
    const offset = side === 'ask' ? i : levels - 1 - i;
    const price  = side === 'ask' ? best + step * offset : best - step * offset;
    const vol    = Math.max(10, qty * (1 - offset * 0.1) + (Math.random() - 0.5) * qty * 0.15);
    return { price, qty: Math.round(vol), contracts: Math.round(vol / 10) };
  });
}

/* ── BookRow ─────────────────────────────────────────────────────── */
const GRID = 'grid-cols-[1fr_1.3fr_0.8fr_0.8fr]';

interface RowProps {
  price:     number;
  qty:       number;
  contracts: number;
  side:      'bid' | 'ask';
  maxQty:    number;
  onSelect:  (price: number) => void;
  onPlace:   (price: number, qty: number, side: 'BUY' | 'SELL') => void;
  isConnected: boolean;
}

function BookRow({ price, qty, contracts, side, maxQty, onSelect, onPlace, isConnected }: RowProps) {
  const [hovered, setHovered]   = useState(false);
  const [rowQty, setRowQty]     = useState(qty);
  const inputRef = useRef<HTMLInputElement>(null);

  const pct   = Math.min(100, (qty / maxQty) * 100);
  const isBid = side === 'bid';
  const action: 'BUY' | 'SELL' = isBid ? 'BUY' : 'SELL';

  return (
    <div
      className={`grid ${GRID} relative text-[11px] font-mono cursor-pointer
                  transition-colors group ${hovered ? 'bg-white/[0.04]' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Depth bar */}
      <div
        className={`absolute top-0 bottom-0 transition-all duration-300 pointer-events-none ${
          isBid ? 'left-0 bg-blue-500/[0.12]' : 'right-0 bg-red-500/[0.12]'
        }`}
        style={{ width: `${pct}%` }}
      />

      {/* Price cell — click selects price in Execute Trade */}
      <span
        onClick={() => onSelect(price)}
        title="Click to set price in Execute Trade"
        className={`relative col-span-1 pl-3 py-[5px] font-bold select-none ${
          isBid ? 'text-blue-400 hover:text-blue-300' : 'text-red-400 hover:text-red-300'
        }`}
      >
        {fmtP(price)}
      </span>

      {/* Inline qty input */}
      <div className="relative flex items-center py-[3px] px-1">
        <input
          ref={inputRef}
          type="number"
          min="1"
          value={rowQty}
          onChange={(e) => setRowQty(Math.max(1, parseInt(e.target.value) || 1))}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-1 py-0.5 bg-[#0d1117]/70 border border-[#1e293b]/50 rounded
                     text-[10px] font-mono text-slate-300 outline-none
                     focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 text-right"
        />
      </div>

      {/* Contracts */}
      <span className="relative text-right pr-1 py-[5px] text-slate-600">{contracts}</span>

      {/* Place button — visible on hover */}
      <div className="relative flex items-center justify-end pr-2 py-[3px]">
        <button
          onClick={(e) => { e.stopPropagation(); if (isConnected) onPlace(price, rowQty, action); }}
          disabled={!isConnected}
          title={`${action} ${rowQty} @ ${fmtP(price)}`}
          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider
                      transition-all opacity-0 group-hover:opacity-100
                      disabled:cursor-not-allowed disabled:opacity-30 ${
            isBid
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {action}
        </button>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────── */
export default function OrderBookPanel() {
  const orderbook        = useMarketStore((s) => s.orderbook);
  const setPrice         = useMarketStore((s) => s.setPrice);
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const isConnected      = connectionStatus === 'connected';

  if (!orderbook) {
    return (
      <div className="h-full flex flex-col bg-[#111114]">
        <div className="shrink-0 px-3 py-2 border-b border-[#1e293b]/60">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order Book</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-slate-600">
          Syncing market data…
        </div>
      </div>
    );
  }

  const asks   = buildLevels(orderbook.best_ask, orderbook.ask_quantity, 'ask');
  const bids   = buildLevels(orderbook.best_bid, orderbook.bid_quantity, 'bid');
  const maxQty = Math.max(...asks.map(r => r.qty), ...bids.map(r => r.qty));

  const totalBid = orderbook.bid_quantity;
  const totalAsk = orderbook.ask_quantity;
  const total    = totalBid + totalAsk;
  const longPct  = total > 0 ? (totalBid / total) * 100 : 50;

  const handlePlace = (price: number, qty: number, action: 'BUY' | 'SELL') => {
    sendMarketOrder(action, qty);
  };

  return (
    <div className="h-full flex flex-col bg-[#111114] overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#1e293b]/60">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order Book</span>
        <span className="text-[10px] font-mono text-slate-600">$ORIS · click price → Execute Trade</span>
      </div>

      {/* Column headers */}
      <div className={`shrink-0 grid ${GRID} px-0 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-600 border-b border-[#1e293b]/50`}>
        <span className="pl-3">Price</span>
        <span className="px-1">Qty</span>
        <span className="text-right pr-1">Cntr</span>
        <span className="text-right pr-2">Action</span>
      </div>

      {/* Scrollable book body */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ASK levels (red) — reversed so best ask is nearest the mid */}
        {[...asks].reverse().map((r, i) => (
          <BookRow
            key={`ask-${i}`} {...r}
            side="ask"
            maxQty={maxQty}
            onSelect={setPrice}
            onPlace={handlePlace}
            isConnected={isConnected}
          />
        ))}

        {/* Mid-price divider — no spread, just a thin visual separator */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#0d1117]">
          <div className="flex-1 h-px bg-[#1e293b]/60" />
          <span className="text-[10px] font-mono font-bold text-slate-300">
            {(( orderbook.best_bid + orderbook.best_ask) / 2).toFixed(2)}
          </span>
          <span className="text-[9px] text-slate-600">mid</span>
          <div className="flex-1 h-px bg-[#1e293b]/60" />
        </div>

        {/* BID levels (blue) */}
        {bids.map((r, i) => (
          <BookRow
            key={`bid-${i}`} {...r}
            side="bid"
            maxQty={maxQty}
            onSelect={setPrice}
            onPlace={handlePlace}
            isConnected={isConnected}
          />
        ))}
      </div>

      {/* Sentiment bar */}
      <div className="shrink-0 px-3 pt-1.5 pb-2.5 border-t border-[#1e293b]/60">
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider mb-1">
          <span className="text-blue-400">Long {longPct.toFixed(0)}%</span>
          <span className="text-slate-700">Sentiment</span>
          <span className="text-red-400">Short {(100 - longPct).toFixed(0)}%</span>
        </div>
        <div className="h-[3px] w-full rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${longPct}%` }} />
          <div className="h-full bg-red-500 flex-1" />
        </div>
      </div>

    </div>
  );
}
