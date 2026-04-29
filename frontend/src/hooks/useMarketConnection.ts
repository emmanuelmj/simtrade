import { useEffect } from 'react';
import { toast } from 'sonner';
import { useMarketStore } from '../store/marketStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/trade';

let globalWs: WebSocket | null = null;

export function useMarketConnection(username: string | null) {
  const { setConnectionStatus, updateOrderbook, addTrade, updateLeaderboard, setNewsAlert, updatePortfolio, addMyTrade } = useMarketStore();

  useEffect(() => {
    if (!username) return;

    setConnectionStatus('connecting');

    // Connecting with the username as token for MVP auth
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(username)}`);
    globalWs = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      // Send the mandatory JOIN message
      ws.send(JSON.stringify({ type: 'JOIN', username }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'orderbook_update':
            updateOrderbook(message.data);
            break;
          case 'trade':
            addTrade(message.data);
            break;
          case 'leaderboard_update':
            updateLeaderboard(message.data);
            break;
          case 'news_alert':
            setNewsAlert(message.data);
            break;
          case 'TRADE_RESULT':
            if (message.data.status === 'SUCCESS') {
              updatePortfolio(message.data.new_fiat_balance, message.data.new_asset_quantity);
              addMyTrade({
                timestamp: Date.now(),
                symbol: 'SIM',
                price: message.data.executed_price,
                quantity: message.data.quantity,
                side: message.data.action,
                trade_id: message.data.trade_id,
              });
              toast.success(`Executed: ${message.data.action} ${message.data.quantity} SIM at $${message.data.executed_price.toFixed(2)}`);
            } else {
              toast.error(`Trade Failed: ${message.data.message || 'Unknown error'}`);
            }
            break;
          default:
            console.log('Unhandled message type:', message.type);
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    ws.onerror = () => {
      // Suppress empty error logs from ghost connections or generic issues
      ws.close();
    };

    return () => {
      ws.close();
      if (globalWs === ws) {
        globalWs = null;
      }
    };
  }, [username, setConnectionStatus, updateOrderbook, addTrade, updateLeaderboard, setNewsAlert, updatePortfolio, addMyTrade]);
}

export const sendMarketOrder = (action: 'BUY' | 'SELL', quantity: number) => {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({
      type: 'MARKET_ORDER',
      data: {
        action,
        symbol: 'SIM',
        quantity
      }
    }));
  } else {
    toast.error('Cannot send order: WebSocket is not connected');
  }
};
