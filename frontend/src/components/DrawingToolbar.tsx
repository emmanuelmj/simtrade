'use client';

import { useState } from 'react';
import {
  MousePointer2, Minus, TrendingUp,
  Square, Circle, Type, Palette,
  Layers, LayoutGrid,
} from 'lucide-react';

const TOOLS = [
  { Icon: MousePointer2, label: 'Cursor'     },
  { Icon: Minus,         label: 'H. Line'    },
  { Icon: TrendingUp,    label: 'Trend Line' },
  { Icon: Square,        label: 'Rectangle'  },
  { Icon: Circle,        label: 'Circle'     },
  { Icon: Type,          label: 'Text'       },
  { Icon: Palette,       label: 'Fibonacci'  },
  { Icon: Layers,        label: 'Brush'      },
];

export default function DrawingToolbar() {
  const [active, setActive] = useState(0);

  return (
    // w-[40px] = matches the grid column exactly
    <div className="w-[40px] h-full flex flex-col items-center gap-1 py-2 rounded-xl bg-[#111114] border border-[#1e293b]/60 overflow-hidden">
      {TOOLS.map(({ Icon, label }, i) => (
        <button
          key={i}
          title={label}
          onClick={() => setActive(i)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shrink-0 ${
            active === i
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-600 hover:text-slate-300 hover:bg-[#1e293b]/50'
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
      <div className="w-5 h-px bg-[#1e293b] my-1 shrink-0" />
      <button
        title="Grid"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-[#1e293b]/50 transition-all shrink-0"
      >
        <LayoutGrid size={14} />
      </button>
    </div>
  );
}
