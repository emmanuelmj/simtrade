'use client';

import Leaderboard from '../../components/Leaderboard';
import { Trophy } from 'lucide-react';

export default function LeaderboardPage() {
  return (
    <div className="flex-1 flex flex-col h-screen w-full bg-zinc-50 overflow-hidden relative">
      <header className="flex-none flex items-center gap-3 px-8 py-6 bg-white/80 backdrop-blur-md border-b border-zinc-200 z-10">
        <div className="p-2 bg-yellow-100 text-yellow-700 rounded-xl">
          <Trophy size={24} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Global Leaderboard</h1>
          <p className="text-sm text-zinc-500">Top performers across the Synthex network</p>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-hidden flex flex-col items-center">
        <div className="w-full max-w-4xl h-full min-h-0">
          <Leaderboard />
        </div>
      </main>
    </div>
  );
}
