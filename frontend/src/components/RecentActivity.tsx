'use client';

import { motion } from 'framer-motion';
import { useMarketStore } from '../store/marketStore';

export default function RecentActivity() {
  const myTrades = useMarketStore((state) => state.myTrades);

  return (
    <div className="h-full flex flex-col p-4 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 overflow-hidden">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">Recent Activity</h3>
      
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {myTrades.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-400">
            No recent trades.
          </div>
        ) : (
          <ul className="flex flex-col gap-2 m-0 p-0">
            {myTrades.map((trade) => (
              <motion.div
                key={trade.trade_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100"
              >
                <div className="flex flex-col">
                  <span className={`text-xs font-semibold ${trade.side === 'BUY' ? 'text-blue-600' : 'text-red-600'}`}>
                    {trade.side} {trade.symbol}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                
                <div className="flex flex-col items-end">
                  <span className="text-xs font-mono font-medium text-zinc-900">
                    {trade.quantity} @ ${trade.price.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    ${(trade.quantity * trade.price).toFixed(2)}
                  </span>
                </div>
              </motion.div>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
