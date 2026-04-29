'use client';

import { useMarketStore } from '../store/marketStore';

export default function OrderBookPanel() {
  const orderbook = useMarketStore((state) => state.orderbook);

  if (!orderbook) {
    return (
      <div className="h-full flex flex-col p-4 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Order Book</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
          Waiting for market data...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">Order Book</h3>
      
      <div className="flex-1 flex flex-col font-mono text-sm min-h-0 overflow-y-auto pr-2 -mr-2">
        {/* Header */}
        <div className="flex justify-between text-zinc-400 pb-2 mb-2 border-b border-zinc-100 text-xs">
          <span>Qty</span>
          <span>Price</span>
        </div>

        {/* Asks (Sell Orders) */}
        <div className="flex flex-col gap-1 mb-4">
          <div className="flex justify-between items-center group relative overflow-hidden transition-all duration-150">
            {/* Visual depth bar */}
            <div 
              className="absolute right-0 top-0 bottom-0 bg-red-50 transition-all duration-150 z-0" 
              style={{ width: `${Math.min(100, (orderbook.ask_quantity / 1000) * 100)}%` }}
            />
            <span className="text-zinc-600 z-10">{orderbook.ask_quantity}</span>
            <span className="text-red-500 font-medium z-10">{orderbook.best_ask.toFixed(2)}</span>
          </div>
        </div>

        {/* Spread */}
        <div className="flex justify-between items-center py-2 my-2 border-y border-zinc-100 text-xs text-zinc-400">
          <span>Spread</span>
          <span>{orderbook.spread.toFixed(2)}</span>
        </div>

        {/* Bids (Buy Orders) */}
        <div className="flex flex-col gap-1 mt-4">
          <div className="flex justify-between items-center group relative overflow-hidden transition-all duration-150">
            {/* Visual depth bar */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-blue-50 transition-all duration-150 z-0" 
              style={{ width: `${Math.min(100, (orderbook.bid_quantity / 1000) * 100)}%` }}
            />
            <span className="text-zinc-600 z-10">{orderbook.bid_quantity}</span>
            <span className="text-blue-500 font-medium z-10">{orderbook.best_bid.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
