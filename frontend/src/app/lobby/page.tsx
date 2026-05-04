'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LayoutGrid, Trophy, Users, Clock, TrendingUp, Target, Zap, 
  ChevronRight, Award, Wallet, BarChart3, Globe 
} from 'lucide-react';
import { useMarketStore } from '../../store/marketStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Competition {
  id: string;
  name: string;
  status: string;
  starting_balance: number;
  created_at: string;
}

export default function Lobby() {
  const router = useRouter();
  const username = useMarketStore((s) => s.username);
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    if (!username) return;

    const fetchComps = async () => {
      try {
        const res = await fetch(`${API_URL}/api/competitions/active`);
        if (res.ok) {
          const data = await res.json();
          setCompetitions(data);
        }
      } catch (e) {
        console.error('Failed to fetch competitions', e);
      } finally {
        setLoading(false);
      }
    };
    fetchComps();
  }, [username]);

  const joinRoom = (id: string) => {
    router.push(`/contest/${id}`);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      joinRoom(roomCode.trim());
    }
  };

  if (!username) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#f8f9fa] dark:bg-[#060608] text-slate-900 dark:text-slate-100 p-6 md:p-10 overflow-y-auto font-inter">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* Pro Header / Profile Card */}
        <header className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900 dark:text-white flex items-center gap-3">
              <span className="bg-blue-600 text-white p-1.5 rounded-lg"><Globe size={24} /></span>
              Synthex <span className="text-blue-500">Arena</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium max-w-md">
              The world's premier high-frequency trading simulation platform. Battle for dominance in real-time markets.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-none flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold border-4 border-slate-50 dark:border-[#0a0a0c]">
                {username[0].toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-5 h-5 rounded-full border-4 border-white dark:border-[#111114]" title="Online" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold text-slate-800 dark:text-white truncate">@{username}</span>
                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-tighter">Pro Tier</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Equity</p>
                  <p className="text-xs font-mono font-bold text-emerald-500">$124,582.40</p>
                </div>
                <div className="border-l border-slate-100 dark:border-slate-800 pl-4">
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Win Rate</p>
                  <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">68.4%</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content: Arenas */}
          <div className="lg:col-span-3 space-y-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b] pb-4">
              <div className="flex items-center gap-3">
                <LayoutGrid size={18} className="text-blue-500" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">
                  Public Trading Arenas
                </h2>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b] rounded-full text-[10px] font-bold text-slate-500">Live: {competitions.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-48 bg-white dark:bg-[#111114] rounded-2xl animate-pulse border border-slate-100 dark:border-slate-800" />
                ))}
              </div>
            ) : competitions.length === 0 ? (
              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b]/50 rounded-2xl p-12 text-center">
                <Trophy size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No public arenas currently active.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {competitions.map((comp) => (
                  <div 
                    key={comp.id} 
                    className="group bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b] hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all rounded-2xl p-6 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <BarChart3 size={80} />
                    </div>

                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="font-black text-lg text-slate-800 dark:text-white tracking-tight group-hover:text-blue-500 transition-colors">
                          {comp.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Active Now</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prize Pool</span>
                        <span className="text-sm font-mono font-black text-amber-500">$5,000</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="bg-slate-50 dark:bg-[#0a0a0c] rounded-xl p-3 border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[9px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Wallet size={10} /> Starting</p>
                        <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">${comp.starting_balance.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0a0a0c] rounded-xl p-3 border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[9px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Users size={10} /> Traders</p>
                        <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{(Math.random() * 50 + 10).toFixed(0)}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0a0a0c] rounded-xl p-3 border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[9px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Clock size={10} /> Ends In</p>
                        <p className="text-xs font-mono font-bold text-blue-500">2h 45m</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => joinRoom(comp.id)}
                      className="w-full py-3.5 bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white font-black rounded-xl transition-all text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-2">
                      Enter Arena <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Join & Stats */}
          <div className="space-y-8">
            {/* Private Room */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-[#1e293b] pb-4">
                <Target size={18} className="text-indigo-500" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">
                  Private Room
                </h2>
              </div>
              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-5 font-medium">Enter a custom arena code provided by your team or host.</p>
                <form onSubmit={handleJoinByCode} className="space-y-4">
                  <div className="relative">
                    <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700" size={16} />
                    <input
                      type="text"
                      placeholder="ENTER CODE..."
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      className="w-full py-3.5 pl-12 pr-4 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-[#1e293b] rounded-xl focus:outline-none focus:border-blue-500 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-700 transition-colors uppercase tracking-widest"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!roomCode.trim()}
                    className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-black rounded-xl transition-all text-[11px] tracking-[0.2em] uppercase shadow-lg shadow-indigo-500/10">
                    Join Private
                  </button>
                </form>
              </div>
            </div>

            {/* Quick Stats / Achievements */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-[#1e293b] pb-4">
                <Award size={18} className="text-amber-500" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-300">
                  Daily Tasks
                </h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Exec 50 Trades", val: "12/50", pct: 24, color: "bg-blue-500" },
                  { label: "10% P&L Gain", val: "4.2/10", pct: 42, color: "bg-emerald-500" },
                  { label: "Invite Trader", val: "0/1", pct: 0, color: "bg-slate-300 dark:bg-slate-800" },
                ].map((task, i) => (
                  <div key={i} className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b] rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{task.label}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-300">{task.val}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-[#0a0a0c] rounded-full overflow-hidden">
                      <div className={`h-full ${task.color}`} style={{ width: `${task.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
