# API & WebSocket Contracts: simtrade

## 1. WebSocket Protocol (Real-Time Communication)

The main connection for participants is a bidirectional WebSocket at `ws://<domain>/ws/trade`.

### Server -> Client (Broadcast Updates)
Sent every 1 second by the Tick Loop.

**Tick Update Payload:**
```json
{
  "type": "MARKET_TICK",
  "data": {
    "timestamp": 1698765432,
    "symbol": "SIM",
    "price": 142.50,
    "volume": 1200
  },
  "leaderboard": [
    { "username": "Trader1", "total_value": 15000.00, "rank": 1 },
    { "username": "Trader2", "total_value": 14200.50, "rank": 2 }
  ],
  "active_news": null
}
```

**News Alert Payload (Injected by Admin):**
```json
{
  "type": "NEWS_ALERT",
  "data": {
    "headline": "SEC Approves Synthetic Trading!",
    "sentiment": "BULLISH",
    "severity": "HIGH"
  }
}
```

### Client -> Server (Trade Execution)
Sent by the client upon clicking Buy/Sell.

**Execution Request:**
```json
{
  "type": "TRADE_EXECUTE",
  "data": {
    "action": "BUY",
    "symbol": "SIM",
    "quantity": 10
  }
}
```

**Execution Response (Ack/Nack):**
```json
{
  "type": "TRADE_RESULT",
  "data": {
    "status": "SUCCESS", 
    "executed_price": 142.50,
    "total_cost": 1425.00,
    "new_fiat_balance": 8575.00,
    "message": "Successfully bought 10 SIM"
  }
}
```

## 2. REST API (Admin "God Mode")

Admin actions do not require WebSockets as they are one-off commands.

### `POST /api/admin/inject-news`
Triggers an immediate change in the Game Loop behavior and broadcasts the news to clients.

**Request Body:**
```json
{
  "title": "Massive Solar Flare disrupts mining!",
  "sentiment": "CRASH",
  "magnitude": 5.0,
  "duration_seconds": 30
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Event injected. Tick loop updated."
}
```
