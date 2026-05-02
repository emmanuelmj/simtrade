import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface OrderBookState {
  timestamp: number;
  symbol: string;
  best_bid: number;
  best_ask: number;
  spread: number;
  bid_quantity: number;
  ask_quantity: number;
}

export interface Trade {
  timestamp: number;
  symbol: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  trade_id: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_value: number;
  pnl: number;
  pnl_pct: number;
}

export interface LeaderboardState {
  rankings: LeaderboardEntry[];
  ltp_used: number;
}

export interface NewsAlert {
  event_id: string;
  headline: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'CRASH' | 'MOON';
  severity: string;
  duration_seconds: number;
}

export interface PortfolioState {
  fiat: number;
  oris: number;
}

interface MarketStore {
  username: string | null;
  connectionStatus: ConnectionStatus;
  orderbook: OrderBookState | null;
  trades: Trade[];
  leaderboard: LeaderboardState | null;
  newsAlert: NewsAlert | null;
  portfolio: PortfolioState | null;
  myTrades: Trade[];
  selectedPrice: number | null;
  selectedQty: number | null;
  setPrice: (price: number | null) => void;
  setOrder: (price: number, qty: number) => void;

  setUsername: (username: string | null) => void;

  setConnectionStatus: (status: ConnectionStatus) => void;
  updateOrderbook: (data: OrderBookState) => void;
  addTrade: (trade: Trade) => void;
  updateLeaderboard: (data: LeaderboardState) => void;
  setNewsAlert: (alert: NewsAlert | null) => void;
  updatePortfolio: (fiat: number, oris: number) => void;
  addMyTrade: (trade: Trade) => void;
  reset: () => void;
}

export const useMarketStore = create<MarketStore>()(
  persist(
    (set) => ({
      username: null,
      connectionStatus: 'disconnected',
      orderbook: null,
      trades: [],
      leaderboard: null,
      newsAlert: null,
      portfolio: null,
      myTrades: [],
      selectedPrice: null,
      selectedQty: null,
      setPrice: (price) => set({ selectedPrice: price }),
      setOrder: (price, qty) => set({ selectedPrice: price, selectedQty: qty }),

      setUsername: (username) => set({ username }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  updateOrderbook: (data) => set({ orderbook: data }),
  addTrade: (trade) => set((state) => ({ trades: [...state.trades, trade].slice(-100) })), // Keep last 100
  updateLeaderboard: (data) => set({ leaderboard: data }),
  setNewsAlert: (alert) => set({ newsAlert: alert }),
  updatePortfolio: (fiat, oris) => set({ portfolio: { fiat, oris } }),
  addMyTrade: (trade) => set((state) => ({ myTrades: [trade, ...state.myTrades].slice(0, 5) })), // Keep latest 5 trades at the top
  reset: () => set({
    username: null,
    connectionStatus: 'disconnected',
    orderbook: null,
    trades: [],
    leaderboard: null,
    newsAlert: null,
    portfolio: null,
    myTrades: [],
    selectedPrice: null,
    selectedQty: null
  })
    }),
    {
      name: 'synthex-market-store',
      partialize: (state) => ({
        username: state.username,
        portfolio: state.portfolio,
        myTrades: state.myTrades,
      }),
    }
  )
);
