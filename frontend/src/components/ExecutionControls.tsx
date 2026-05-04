'use client';

import { useState, useEffect, useRef } from 'react';
import { useMarketStore } from '../store/marketStore';
import { sendMarketOrder } from '../hooks/useMarketConnection';
import { toast } from 'sonner';

const PRESETS = [10, 50, 100, 500];
const fmt2 = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExecutionControls() {
  const [qty, setQty] = useState(10);

  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const portfolio        = useMarketStore((s) => s.portfolio);
  const selectedSymbol   = useMarketStore((s) => s.selectedSymbol);
  const marketPrices     = useMarketStore((s) => s.marketPrices);
  const data             = marketPrices[selectedSymbol];

  const isConnected = connectionStatus === 'connected';
  const mid = data ? (data.best_bid + data.best_ask) / 2 : 0;
  const totalAmount = mid * qty;

  // Current holding for selected symbol
  const currentHolding = portfolio?.positions?.find((p) => p.symbol === selectedSymbol)?.quantity ?? 0;
  const canBuy  = isConnected && qty > 0 && qty <= 100_000 && (!portfolio || portfolio.fiat >= totalAmount);
  const canSell = isConnected && qty > 0 && qty <= 100_000 && currentHolding >= qty;

  const handleOrder = (action: 'BUY' | 'SELL') => {
    sendMarketOrder(action, selectedSymbol, qty);
  };

  return (
    <div className="flex flex-col bg-white dark:bg-[#111114] h-full">
      {/* Title */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#1e293b]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">Trade</span>
          <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">${selectedSymbol}</span>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">${mid.toFixed(2)}</span>
          )}
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
            isConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          }`}>{isConnected ? 'LIVE' : 'OFF'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        {/* Quantity */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Quantity</label>
          <div className="flex gap-1.5 mb-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setQty(p)}
                className={`flex-1 py-1 text-[11px] font-bold rounded border transition-all ${
                  qty === p
                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-[#1e293b] dark:border-blue-500/50 dark:text-slate-200'
                    : 'border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 dark:border-[#1e293b]/80 dark:text-slate-500 dark:hover:text-slate-400 dark:hover:border-slate-600/40'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <input type="number" min="1" value={qty || ''}
            onChange={(e) => setQty(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#1e293b] rounded
                       focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-700 transition-colors"
            placeholder="Custom quantity…"
          />
        </div>

        {/* Order summary */}
        <div className="bg-slate-50 dark:bg-[#0d1117] rounded border border-slate-200 dark:border-[#1e293b] p-3 space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500 font-bold uppercase">Price</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-400">Market ${mid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500 font-bold uppercase">Units</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-400">{qty.toLocaleString()}</span>
          </div>
          <div className="h-px bg-slate-200 dark:bg-[#1e293b] my-1" />
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-700 dark:text-slate-400 font-bold uppercase">Margin Req.</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">${fmt2(totalAmount)}</span>
          </div>
        </div>

        {/* Buy / Sell buttons */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button onClick={() => handleOrder('BUY')} disabled={!canBuy}
            className="flex flex-col items-center justify-center gap-0.5 py-3 rounded
                       bg-emerald-50 hover:bg-emerald-100 border border-emerald-500/30 text-emerald-700
                       dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:hover:bg-emerald-500/15 dark:text-emerald-400
                       active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <span className="text-[12px] font-bold uppercase tracking-wider">Buy</span>
            <span className="text-[10px] font-mono opacity-80">${fmt2(totalAmount)}</span>
          </button>
          <button onClick={() => handleOrder('SELL')} disabled={!canSell}
            className="flex flex-col items-center justify-center gap-0.5 py-3 rounded
                       bg-red-50 hover:bg-red-100 border border-red-500/30 text-red-700
                       dark:bg-red-500/10 dark:border-red-500/20 dark:hover:bg-red-500/15 dark:text-red-400
                       active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <span className="text-[12px] font-bold uppercase tracking-wider">Sell</span>
            <span className="text-[10px] font-mono opacity-80">${fmt2(totalAmount)}</span>
          </button>
        </div>
      </div>

      {/* Portfolio footer */}
      <div className="shrink-0 border-t border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#0d1117]/50 px-4 py-3 flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Balance</span>
        <div className="text-right">
          <div className="text-[12px] font-mono text-slate-800 dark:text-slate-300 font-bold">
            ${portfolio?.fiat != null ? fmt2(portfolio.fiat) : '—'}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
            {currentHolding} ${selectedSymbol}
          </div>
        </div>
      </div>
    </div>
  );
}
