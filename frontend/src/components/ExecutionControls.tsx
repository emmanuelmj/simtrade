'use client';

import { useState } from 'react';
import { useMarketStore } from '../store/marketStore';

interface ExecutionControlsProps {
  onSendOrder: (action: 'BUY' | 'SELL', quantity: number) => void;
}

const MAX_ORDER_LIMIT = 100000;

export default function ExecutionControls({ onSendOrder }: ExecutionControlsProps) {
  const [quantity, setQuantity] = useState<number>(10);
  const connectionStatus = useMarketStore((state) => state.connectionStatus);
  const portfolio = useMarketStore((state) => state.portfolio);
  const orderbook = useMarketStore((state) => state.orderbook);
  const isConnected = connectionStatus === 'connected';

  // Calculate estimated cost for a BUY
  const estimatedBuyCost = orderbook?.best_ask ? orderbook.best_ask * quantity : 0;
  
  // Validation checks
  const isOverAbsoluteLimit = quantity > MAX_ORDER_LIMIT;
  const isInvalidQuantity = quantity <= 0 || isNaN(quantity);
  const canBuy = isConnected && !isOverAbsoluteLimit && !isInvalidQuantity && (!portfolio || portfolio.fiat >= estimatedBuyCost);
  const canSell = isConnected && !isOverAbsoluteLimit && !isInvalidQuantity && (!portfolio || portfolio.oris >= quantity);

  let errorMessage = '';
  if (isOverAbsoluteLimit) {
    errorMessage = `Max order size is ${MAX_ORDER_LIMIT}`;
  } else if (quantity > 0 && portfolio) {
    if (portfolio.fiat < estimatedBuyCost && portfolio.oris < quantity) {
      errorMessage = 'Insufficient Fiat and ORIS balance';
    }
  }

  return (
    <div className="relative h-full flex flex-col p-4 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 overflow-hidden">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">Execute Trade</h3>
      
      <div className="flex-1 flex flex-col justify-end gap-4 min-h-0">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Quantity</label>
          <div className="flex bg-zinc-100 rounded-lg p-1 mb-3">
            {[10, 50, 100].map((q) => (
              <button
                key={q}
                onClick={() => setQuantity(q)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                  quantity === q
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/50'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <input
              type="number"
              min="1"
              max={MAX_ORDER_LIMIT}
              value={quantity || ''}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent font-mono transition-shadow"
              placeholder="Custom amount..."
            />
          </div>
          {errorMessage && (
            <p className="text-red-500 text-xs mt-1.5 font-medium">{errorMessage}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button
            onClick={() => onSendOrder('BUY', quantity)}
            disabled={!canBuy}
            className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
          >
            <span>Buy Market</span>
            {portfolio && <span className="text-[10px] opacity-75 font-mono">${portfolio.fiat.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>}
          </button>
          <button
            onClick={() => onSendOrder('SELL', quantity)}
            disabled={!canSell}
            className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
          >
            <span>Sell Market</span>
            {portfolio && <span className="text-[10px] opacity-75 font-mono">{portfolio.oris.toLocaleString()} ORIS</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

