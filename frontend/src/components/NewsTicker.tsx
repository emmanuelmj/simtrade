'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarketStore, NewsAlert } from '../store/marketStore';
import { AlertCircle, TrendingUp, TrendingDown, Rocket, AlertOctagon } from 'lucide-react';

export default function NewsTicker() {
  const newsAlert = useMarketStore((state) => state.newsAlert);
  const [currentAlert, setCurrentAlert] = useState<NewsAlert | null>(null);

  useEffect(() => {
    if (newsAlert) {
      setCurrentAlert(newsAlert);
      
      // Auto-hide after duration
      const timer = setTimeout(() => {
        setCurrentAlert(null);
      }, (newsAlert.duration_seconds || 5) * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [newsAlert]);

  const getAlertConfig = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH':
        return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
      case 'BEARISH':
        return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
      case 'CRASH':
        return { icon: AlertOctagon, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
      case 'MOON':
        return { icon: Rocket, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' };
      default:
        return { icon: AlertCircle, color: 'text-zinc-600', bg: 'bg-zinc-50', border: 'border-zinc-200' };
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-md px-4 flex justify-center">
      <AnimatePresence>
        {currentAlert && (() => {
          const config = getAlertConfig(currentAlert.sentiment);
          const Icon = config.icon;
          return (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-full border shadow-lg backdrop-blur-xl pointer-events-auto ${config.bg} ${config.border}`}
            >
              <div className={`p-1.5 rounded-full bg-white/50 ${config.color}`}>
                <Icon size={16} strokeWidth={2.5} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${config.color}`}>
                  {currentAlert.headline}
                </p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
