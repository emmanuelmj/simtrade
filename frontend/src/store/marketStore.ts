import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type View = 'DASHBOARD' | 'TERMINAL' | 'HOLDINGS' | 'POSITIONS' | 'NEWS' | 'LEADERBOARD';

export interface OrderBookState {
  timestamp: number;
  symbol: string;
  best_bid: number;
  best_ask: number;
  spread: number;
  bid_quantity: number;
  ask_quantity: number;
  prev_ltp?: number;
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

export interface Position {
  symbol: string;
  quantity: number;
  avg_price: number;
}

export interface PortfolioState {
  fiat: number;
  holdings: Record<string, number>;
  positions: Position[];
}

interface MarketStore {
  username: string | null;
  connectionStatus: ConnectionStatus;
  isCompleted: boolean;
  marketPrices: Record<string, OrderBookState>;
  selectedSymbol: string;
  trades: Trade[];
  leaderboard: LeaderboardState | null;
  newsAlert: NewsAlert | null;
  portfolio: PortfolioState | null;
  myTrades: Trade[];
  selectedPrice: number | null;
  selectedQty: number | null;
  currentView: View;
  setPrice: (price: number | null) => void;
  setOrder: (price: number, qty: number) => void;
  setCurrentView: (view: View) => void;

  setUsername: (username: string | null) => void;
  setIsCompleted: (completed: boolean) => void;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setMarketPrices: (data: OrderBookState[]) => void;
  setSelectedSymbol: (symbol: string) => void;
  addTrade: (trade: Trade) => void;
  updateLeaderboard: (data: LeaderboardState) => void;
  setNewsAlert: (alert: NewsAlert | null) => void;
  updatePortfolio: (fiat: number, holdings: Record<string, number>, positions: Position[]) => void;
  addMyTrade: (trade: Trade) => void;
  reset: () => void;
}

export const useMarketStore = create<MarketStore>()(
  persist(
    (set) => ({
      username: null,
      connectionStatus: 'disconnected',
      isCompleted: false,
      marketPrices: {},
      selectedSymbol: 'SYNX',
      trades: [],
      leaderboard: null,
      newsAlert: null,
      portfolio: null,
      myTrades: [],
      selectedPrice: null,
      selectedQty: null,
      currentView: 'TERMINAL',
      setPrice: (price) => set({ selectedPrice: price }),
      setOrder: (price, qty) => set({ selectedPrice: price, selectedQty: qty }),
      setCurrentView: (view) => set({ currentView: view }),

      setUsername: (username) => set({ username }),
      setIsCompleted: (completed) => set({ isCompleted: completed }),

      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setMarketPrices: (data) => set((state) => {
        const newPrices = { ...state.marketPrices };
        data.forEach(item => {
          const ltp = (item.best_bid + item.best_ask) / 2;
          const oldData = newPrices[item.symbol];
          const oldLtp = oldData ? (oldData.best_bid + oldData.best_ask) / 2 : ltp;
          
          let prev = oldData?.prev_ltp ?? ltp;
          if (oldLtp !== ltp) {
            prev = oldLtp;
          }
          
          newPrices[item.symbol] = {
            ...item,
            prev_ltp: prev
          };
        });
        return { marketPrices: newPrices };
      }),
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      addTrade: (trade) => set((state) => ({ trades: [...state.trades, trade].slice(-100) })), // Keep last 100
      updateLeaderboard: (data) => set({ leaderboard: data }),
      setNewsAlert: (alert) => set({ newsAlert: alert }),
      updatePortfolio: (fiat, holdings, positions) => set({ portfolio: { fiat, holdings, positions } }),
      addMyTrade: (trade) => set((state) => ({ myTrades: [trade, ...state.myTrades].slice(0, 5) })), // Keep latest 5 trades at the top
      reset: () => set({
        username: null,
        connectionStatus: 'disconnected',
        isCompleted: false,
        marketPrices: {},
        selectedSymbol: 'SYNX',
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
