'use client';

import { useMarketStore } from '../store/marketStore';
import { sendMarketOrder } from '../hooks/useMarketConnection';
import TradingChart from '../components/TradingChart';
import OrderBookPanel from '../components/OrderBookPanel';
import ExecutionControls from '../components/ExecutionControls';
import QuickAccountSummary from '../components/QuickAccountSummary';
import RecentActivity from '../components/RecentActivity';
import NewsTicker from '../components/NewsTicker';

export default function Dashboard() {
  const username = useMarketStore((state) => state.username);
  const connectionStatus = useMarketStore((state) => state.connectionStatus);

  return (
    <div className="flex-1 flex flex-col h-screen w-full bg-zinc-50 overflow-hidden relative">
      <NewsTicker />
      
      <header className="flex-none flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-zinc-200 z-10">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-xs text-zinc-500">Trader <span className="font-mono text-zinc-900 font-medium">{username}</span></p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-amber-400' : 'bg-red-500'
          }`} />
          <span className="text-xs font-medium text-zinc-600 capitalize">{connectionStatus}</span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="h-full grid grid-cols-1 md:grid-cols-12 grid-rows-[minmax(0,1fr)_18rem] gap-4 md:gap-6">
          
          {/* Main Chart Area */}
          <div className="md:col-span-9 bg-white/70 backdrop-blur-xl rounded-2xl border border-zinc-200 overflow-hidden shadow-sm min-h-0">
            <TradingChart />
          </div>

          {/* Order Book Panel */}
          <div className="md:col-span-3 min-h-0">
            <OrderBookPanel />
          </div>

          {/* Execution Controls */}
          <div className="md:col-span-4 min-h-0">
            <ExecutionControls onSendOrder={sendMarketOrder} />
          </div>

          {/* Quick Account Summary */}
          <div className="md:col-span-4 min-h-0">
            <QuickAccountSummary />
          </div>

          {/* Recent Activity */}
          <div className="md:col-span-4 min-h-0">
            <RecentActivity />
          </div>

        </div>
      </main>
    </div>
  );
}
