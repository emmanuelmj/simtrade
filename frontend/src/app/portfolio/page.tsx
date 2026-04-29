'use client';

import { useMarketStore } from '../../store/marketStore';

export default function PortfolioPage() {
  const portfolio = useMarketStore((state) => state.portfolio);
  const myTrades = useMarketStore((state) => state.myTrades);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50 relative">
      <header className="flex-none flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-zinc-200 z-10">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Portfolio</h1>
          <p className="text-xs text-zinc-500">Asset Management</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <section className="bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 overflow-hidden shadow-sm p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-6">Balances</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-100 flex flex-col justify-center shadow-sm">
                <span className="text-sm font-medium text-zinc-500 mb-2">Available Fiat</span>
                <span className="text-3xl font-mono font-semibold text-zinc-900 tracking-tight">
                  ${portfolio ? portfolio.fiat.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
                </span>
              </div>
              
              <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-100 flex flex-col justify-center shadow-sm">
                <span className="text-sm font-medium text-zinc-500 mb-2">Total $ORIS</span>
                <span className="text-3xl font-mono font-semibold text-zinc-900 tracking-tight">
                  {portfolio ? portfolio.oris.toLocaleString() : '0'} <span className="text-lg font-sans text-zinc-400 font-medium ml-1">SIM</span>
                </span>
              </div>
            </div>
          </section>

          <section className="bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 overflow-hidden shadow-sm p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-6">Trade History</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500 font-medium">
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Symbol</th>
                    <th className="pb-3 font-medium">Side</th>
                    <th className="pb-3 font-medium text-right">Price</th>
                    <th className="pb-3 font-medium text-right">Quantity</th>
                    <th className="pb-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-zinc-900">
                  {myTrades.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                        No trade history available.
                      </td>
                    </tr>
                  ) : (
                    myTrades.map((trade) => (
                      <tr key={trade.trade_id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors">
                        <td className="py-3 font-mono text-xs text-zinc-500">
                          {new Date(trade.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 font-medium">{trade.symbol}</td>
                        <td className={`py-3 font-semibold ${trade.side === 'BUY' ? 'text-blue-600' : 'text-red-600'}`}>
                          {trade.side}
                        </td>
                        <td className="py-3 text-right font-mono">${trade.price.toFixed(2)}</td>
                        <td className="py-3 text-right font-mono">{trade.quantity}</td>
                        <td className="py-3 text-right font-mono font-medium">${(trade.price * trade.quantity).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
