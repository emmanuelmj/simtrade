'use client';

import { LayoutDashboard, History, MessageSquareQuote, Briefcase, TrendingUp, Monitor, Trophy } from 'lucide-react';
import { useMarketStore, View } from '../store/marketStore';

const BLOCKS: { Icon: any, label: string, view: View }[] = [
  { Icon: LayoutDashboard,    label: 'Dashboard',   view: 'DASHBOARD' },
  { Icon: Monitor,            label: 'Terminal',    view: 'TERMINAL' },
  { Icon: Briefcase,          label: 'Holdings',    view: 'HOLDINGS' },
  { Icon: TrendingUp,         label: 'Positions',   view: 'POSITIONS' },
  { Icon: Trophy,             label: 'Leaderboard', view: 'LEADERBOARD' },
  { Icon: MessageSquareQuote, label: 'News',        view: 'NEWS' },
];

export default function UtilityStack() {
  const currentView = useMarketStore((s) => s.currentView);
  const setCurrentView = useMarketStore((s) => s.setCurrentView);

  return (
    // w-[56px] = matches the grid column exactly
    <div className="w-[56px] h-full flex flex-col gap-2 py-2 px-1 rounded-xl bg-[#111114] border border-[#1e293b]/60 overflow-hidden">
      {BLOCKS.map(({ Icon, label, view }, i) => (
        <button
          key={i}
          title={label}
          onClick={() => setCurrentView(view)}
          className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all shrink-0 ${
            currentView === view
              ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
              : 'bg-transparent border-transparent text-slate-600 hover:text-slate-300 hover:bg-[#1e293b]/40'
          }`}
        >
          <Icon size={15} />
          <span className="text-[8px] font-bold uppercase tracking-wide leading-none text-center">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
