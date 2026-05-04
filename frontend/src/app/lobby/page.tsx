'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
      // In a real app we might fetch the room by code, but for now just navigate if we assume the code IS the ID,
      // or we just navigate to it. The prompt says "push to /contest/[id]". 
      // If roomCode is a string, let's just push it directly for now.
      joinRoom(roomCode.trim());
    }
  };

  if (!username) return null; // AppShell handles login

  return (
    <div className="flex-1 flex flex-col bg-[#f8f9fa] dark:bg-[#0a0a0c] text-slate-900 dark:text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.1em] uppercase text-slate-800 dark:text-slate-200">
              Synthex <span className="text-blue-500">Lobby</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Select an active trading arena or join a private room.</p>
          </div>
          <div className="bg-white dark:bg-[#111114] px-4 py-2 border border-slate-200 dark:border-[#1e293b] rounded-lg">
            <span className="text-xs text-slate-500 uppercase tracking-widest mr-2">Trader</span>
            <span className="text-sm font-mono text-blue-400 font-bold">@{username}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Public Competitions */}
          <div className="md:col-span-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 border-b border-slate-200 dark:border-[#1e293b] pb-2">
              Public Arenas
            </h2>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : competitions.length === 0 ? (
              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b]/50 rounded-xl p-8 text-center">
                <p className="text-slate-500 dark:text-slate-400 text-sm">No public arenas currently active.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {competitions.map((comp) => (
                  <div key={comp.id} className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b]/50 hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-xl p-5 transition-all flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 tracking-wide">{comp.name}</h3>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        comp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {comp.status}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2 mb-6">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Starting Balance</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">${comp.starting_balance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Created</span>
                        <span className="text-slate-600 dark:text-slate-400">{new Date(comp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => joinRoom(comp.id)}
                      className="w-full py-2.5 bg-blue-50 hover:bg-blue-600 dark:bg-blue-600/20 dark:hover:bg-blue-600 border border-blue-200 dark:border-blue-500/30 text-blue-600 hover:text-white dark:text-blue-400 dark:hover:text-white font-bold rounded-lg transition-all text-xs tracking-widest uppercase">
                      Enter Arena
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Private Room Join */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 border-b border-slate-200 dark:border-[#1e293b] pb-2">
              Private Room
            </h2>
            <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1e293b]/50 rounded-xl p-5">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Enter a room code to join a private competition.</p>
              <form onSubmit={handleJoinByCode} className="space-y-3">
                <input
                  type="text"
                  placeholder="Room Code or ID"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full py-2.5 px-4 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-[#1e293b] rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!roomCode.trim()}
                  className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 font-bold rounded-lg transition-all text-xs tracking-widest uppercase">
                  Join Room
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
