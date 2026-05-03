'use client';

import { useMarketStore } from '../store/marketStore';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  History, 
  Clock, 
  TrendingUp, 
  Briefcase,
  ArrowRightLeft
} from 'lucide-react';

export default function DashboardOverview() {
  const portfolio = useMarketStore((s) => s.portfolio);
  const myTrades = useMarketStore((s) => s.myTrades);
  const orderbook = useMarketStore((s) => s.orderbook);
  const leaderboard = useMarketStore((s) => s.leaderboard);
  const username = useMarketStore((s) => s.username);

  // Calculate live P&L based on current mid-price
  const midPrice = orderbook ? (orderbook.best_bid + orderbook.best_ask) / 2 : 0;
  const fiat = portfolio?.fiat ?? 0;
  const orisQty = portfolio?.holdings['ORIS'] ?? 0;
  const totalValue = fiat + (orisQty * midPrice);
  const initialFiat = 100000;
  
  // Only calculate P&L if we have a valid price, otherwise default to 0 or last known
  const pnl = midPrice > 0 ? totalValue - initialFiat : 0;
  const pnlPct = midPrice > 0 && initialFiat > 0 ? (pnl / initialFiat) * 100 : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 bg-[#0a0a0c]">
      
      {/* ── Top Row: Balance & P&L ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Balance Block */}
        <div className="bg-[#111114] border border-[#1e293b]/60 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Wallet size={20} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Balance</h3>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-mono font-bold text-slate-100">
              ${portfolio?.fiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Available Fiat Currency</p>
          </div>
        </div>

        {/* Asset Balance Block */}
        <div className="bg-[#111114] border border-[#1e293b]/60 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <Briefcase size={20} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Holdings</h3>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-mono font-bold text-slate-100">
              {portfolio?.holdings['ORIS']?.toLocaleString() ?? '0'} <span className="text-sm text-slate-500">ORIS</span>
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Synthex / ORIS Index Asset</p>
          </div>
        </div>

        {/* Open P&L Block */}
        <div className="bg-[#111114] border border-[#1e293b]/60 rounded-2xl p-5 shadow-xl lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <TrendingUp size={20} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Performance (P&L)</h3>
          </div>
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className={`text-3xl font-mono font-bold tracking-tighter ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold flex items-center ${pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnlPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(pnlPct).toFixed(2)}%
                </span>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">since session start</span>
              </div>
            </div>
            {/* Visual Mini Graph Placeholder */}
            <div className="flex items-end gap-1 h-12">
              {[40, 70, 45, 90, 65, 80, 50, 95].map((h, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 rounded-t-sm ${pnl >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`} 
                  style={{ height: `${h}%` }} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row: Markets & Recent Trades ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Markets Block (shows multiple stocks in a list) */}
        <div className="lg:col-span-2 bg-[#111114] border border-[#1e293b]/60 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-[#1e293b]/60 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Live Markets</h3>
            <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#16161a] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3 font-semibold">Asset</th>
                  <th className="px-5 py-3 font-semibold text-right">Price</th>
                  <th className="px-5 py-3 font-semibold text-right">24h Change</th>
                  <th className="px-5 py-3 font-semibold text-right">Volume</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/40">
                {[
                  { symbol: 'ORIS', name: 'Synthex ORIS', price: orderbook?.best_bid ?? 0, change: '+2.45%', vol: '1.2M', trend: 'up' },
                  { symbol: 'NIFTY', name: 'Nifty 50 Index', price: 22450.20, change: '-0.12%', vol: '8.4M', trend: 'down' },
                  { symbol: 'RELI', name: 'Reliance Ind.', price: 2980.50, change: '+1.10%', vol: '4.2M', trend: 'up' },
                  { symbol: 'TATA', name: 'Tata Motors', price: 940.15, change: '+4.20%', vol: '2.8M', trend: 'up' },
                  { symbol: 'HDFC', name: 'HDFC Bank', price: 1520.40, change: '-1.45%', vol: '5.1M', trend: 'down' },
                ].map((m, i) => (
                  <tr key={i} className="hover:bg-[#1e293b]/20 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-300 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                          {m.symbol[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">{m.symbol}</p>
                          <p className="text-[10px] text-slate-500">{m.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-xs font-mono font-bold text-slate-300">
                      ${m.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-5 py-4 text-right text-xs font-mono font-bold ${m.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.change}
                    </td>
                    <td className="px-5 py-4 text-right text-xs font-mono text-slate-400">
                      {m.vol}
                    </td>
                    <td className="px-5 py-4">
                      <button className="px-3 py-1 rounded bg-[#1e293b] text-[10px] font-bold text-slate-300 hover:bg-blue-600 hover:text-white transition-all uppercase tracking-wider">Trade</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Trades Block */}
        <div className="bg-[#111114] border border-[#1e293b]/60 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="px-5 py-4 border-b border-[#1e293b]/60 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">My Recent Trades</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[350px]">
            {myTrades.length > 0 ? (
              <div className="divide-y divide-[#1e293b]/40">
                {myTrades.map((t, i) => (
                  <div key={i} className="px-5 py-3 hover:bg-[#1e293b]/20 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {t.side}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{t.symbol}</span>
                      <span className="text-xs font-mono font-bold text-slate-100">${t.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-slate-500">Qty: {t.quantity}</span>
                      <span className="text-[10px] text-slate-500">Total: ${(t.price * t.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <div className="p-3 bg-slate-800/50 rounded-full text-slate-600 mb-3">
                  <ArrowRightLeft size={24} />
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No recent trades</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Recent Transactions ───────────────────────── */}
      <div className="bg-[#111114] border border-[#1e293b]/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-[#1e293b]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Wallet Transactions</h3>
            <div className="flex gap-2 ml-4">
              <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition-all uppercase tracking-wider">
                <History size={12} /> Transaction History
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 hover:bg-amber-500/20 transition-all uppercase tracking-wider">
                <Clock size={12} /> Pending Withdraw
              </button>
            </div>
          </div>
        </div>
        
        {/* Placeholder table for Transactions */}
        <div className="p-8 flex flex-col items-center justify-center text-center opacity-50">
          <div className="p-4 bg-slate-800/30 rounded-full text-slate-600 mb-4">
            <History size={32} />
          </div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Transaction Ledger Empty</h4>
          <p className="text-[10px] text-slate-600 font-medium">Deposit funds or execute trades to populate your history.</p>
        </div>
      </div>

    </div>
  );
}
