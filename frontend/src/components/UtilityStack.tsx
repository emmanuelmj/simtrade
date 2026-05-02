'use client';

import { useState } from 'react';
import { LayoutDashboard, History, MessageSquareQuote } from 'lucide-react';

const BLOCKS = [
  { Icon: LayoutDashboard,    label: 'Dashboard',    active: true  },
  { Icon: History,            label: 'Txns',         active: false },
  { Icon: MessageSquareQuote, label: 'News',         active: false },
];

export default function UtilityStack() {
  const [active, setActive] = useState(0);

  return (
    // w-[56px] = matches the grid column exactly
    <div className="w-[56px] h-full flex flex-col gap-2 py-2 px-1 rounded-xl bg-[#111114] border border-[#1e293b]/60 overflow-hidden">
      {BLOCKS.map(({ Icon, label }, i) => (
        <button
          key={i}
          title={label}
          onClick={() => setActive(i)}
          className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all shrink-0 ${
            active === i
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
