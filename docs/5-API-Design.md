# API & WebSocket Contracts: Synthex
**Version:** 2.0 — AMM / CLOB Architecture  
**Classification:** Internal — Engineering  
**Status:** Active

---

## 1. WebSocket Protocol (Real-Time Communication)

The primary connection for participants is a **bidirectional WebSocket** at:
```
ws://<domain>/ws/trade
```

Authentication is enforced at the upgrade handshake. The client must pass a valid session token as a query parameter (`?token=<jwt>`) or via the `Authorization` header in the upgrade request. Unauthenticated upgrade attempts are rejected with `403 Forbidden`.

---

### 1.1 Server → Client: Broadcast Messages

The server broadcasts two distinct real-time message types. These are **independent events** — a `trade` fires on every successful order match; an `orderbook_update` fires both after every match and after every House Bot re-quote cycle.

---

#### Message Type: `trade`
**Trigger:** A participant's Market Order has been successfully matched against a House Bot Limit Order and the transaction committed to the database.

**Broadcast to:** All connected participants (global broadcast).

```json
{
  "type": "trade",
  "data": {
    "timestamp": 1698765432891,
    "symbol": "SIM",
    "price": 142.50,
    "quantity": 10,
    "side": "BUY",
    "trade_id": "c4f2a1b3-..."
  }
}
```

| Field | Type | Description |
|---|---|---|
| `timestamp` | Unix ms | Server-side execution timestamp (UTC). |
| `symbol` | string | Asset symbol. |
| `price` | number | The **Last Traded Price (LTP)** — the price at which this specific trade was matched. This is the value plotted on the chart. |
| `quantity` | number | Units traded. |
| `side` | `"BUY"` \| `"SELL"` | Direction from the perspective of the human participant. |
| `trade_id` | UUID string | Idempotency key for deduplication on reconnect. |

---

#### Message Type: `orderbook_update`
**Trigger:** (a) After every House Bot re-quote cycle (1 Hz), OR (b) immediately following any matched trade that partially depletes a Limit Order.

**Broadcast to:** All connected participants.

```json
{
  "type": "orderbook_update",
  "data": {
    "timestamp": 1698765432100,
    "symbol": "SIM",
    "best_bid": 141.75,
    "best_ask": 143.25,
    "spread": 1.50,
    "bid_quantity": 500,
    "ask_quantity": 500
  }
}
```

| Field | Type | Description |
|---|---|---|
| `timestamp` | Unix ms | Timestamp of the re-quote or match that triggered this update. |
| `symbol` | string | Asset symbol. |
| `best_bid` | number | **The price at which a participant can SELL immediately.** (House Bot's standing Bid.) |
| `best_ask` | number | **The price at which a participant can BUY immediately.** (House Bot's standing Ask.) |
| `spread` | number | `best_ask - best_bid`. Widens programmatically during high-volatility news events. |
| `bid_quantity` | number | Available quantity at the best Bid. Informs participants of available sell-side depth. |
| `ask_quantity` | number | Available quantity at the best Ask. Informs participants of available buy-side depth. |

> **Design Note:** The `spread` field widens during News Events as the House Bot recalculates its quotes from a drastically different Fair Value. This visual spread-widening is a primary signal to participants that a market-moving event has occurred, even before they read the news headline.

---

#### Message Type: `news_alert`
**Trigger:** Admin triggers a news injection via REST API.

**Broadcast to:** All connected participants.

```json
{
  "type": "news_alert",
  "data": {
    "event_id": "e7a4c2d1-...",
    "headline": "Central Bank Announces Emergency Rate Hike",
    "sentiment": "CRASH",
    "severity": "CRITICAL",
    "duration_seconds": 30
  }
}
```

---

#### Message Type: `leaderboard_update`
**Trigger:** After every `trade` event (LTP changes → unrealised PnL changes for all open positions → rankings may shift).

**Broadcast to:** All connected participants.

```json
{
  "type": "leaderboard_update",
  "data": {
    "rankings": [
      { "rank": 1, "username": "Trader1", "total_value": 15420.00, "pnl": 420.00, "pnl_pct": 2.80 },
      { "rank": 2, "username": "Trader2", "total_value": 14200.50, "pnl": -799.50, "pnl_pct": -5.33 }
    ],
    "ltp_used": 142.50
  }
}
```

---

### 1.2 Client → Server: Trade Execution

Sent by the client upon clicking the BUY or SELL button. The client submits a **Market Order** — no price specification is required or accepted. Execution price is determined entirely server-side by the best available House Bot Limit Order at the moment the matching engine processes the request.

**Market Order Request:**
```json
{
  "type": "MARKET_ORDER",
  "data": {
    "action": "BUY",
    "symbol": "SIM",
    "quantity": 10
  }
}
```

| Field | Validation | Notes |
|---|---|---|
| `action` | `"BUY"` or `"SELL"` | Case-sensitive. |
| `symbol` | Must match configured asset symbol exactly. | Rejects unknown symbols. |
| `quantity` | Positive integer, ≤ configurable max per trade (e.g., 500). | Pydantic `Field(gt=0, le=500)`. |

**Execution Acknowledgement (Success):**
```json
{
  "type": "TRADE_RESULT",
  "data": {
    "status": "SUCCESS",
    "trade_id": "c4f2a1b3-...",
    "action": "BUY",
    "executed_price": 143.25,
    "quantity": 10,
    "total_cost": 1432.50,
    "new_fiat_balance": 8567.50,
    "new_asset_quantity": 20,
    "message": "Bought 10 SIM at 143.25"
  }
}
```

**Execution Failure (NACK):**
```json
{
  "type": "TRADE_RESULT",
  "data": {
    "status": "FAILED",
    "reason": "INSUFFICIENT_FUNDS",
    "message": "Insufficient fiat balance. Required: 1432.50, Available: 850.00"
  }
}
```

Possible `reason` codes:

| Code | Description |
|---|---|
| `INSUFFICIENT_FUNDS` | Participant's `fiat_balance` < `best_ask × quantity`. |
| `INSUFFICIENT_INVENTORY` | Participant's `asset_quantity` < `quantity` (for SELL). |
| `NO_LIQUIDITY` | No open House Bot Limit Order available to match against (transient; retry in next tick). |
| `LOCK_CONTENTION` | The target order was locked by a concurrent match; retry automatically after 50ms. |
| `VALIDATION_ERROR` | Malformed payload. |

---

## 2. REST API (Admin "God Mode")

All Admin endpoints require the `X-Admin-Key: <secret>` header. Requests without this header return `401 Unauthorized`. Requests with an incorrect key return `403 Forbidden`.

---

### `POST /api/admin/inject-news`
Injects a News Event into the Scenario Engine. The backend immediately:
1. Persists the event to `news_events` with `is_active=true`.
2. Triggers the House Bot to perform an immediate re-quote (bypassing the 1 Hz cycle) using the modified Fair Value.
3. Broadcasts a `news_alert` WebSocket message to all clients.
4. Broadcasts an `orderbook_update` to reflect the repriced House Bot quotes.

**Request Body:**
```json
{
  "title": "Regulator Seizes Exchange Reserves",
  "sentiment": "CRASH",
  "magnitude": -0.12,
  "duration_seconds": 45
}
```

| Field | Type | Notes |
|---|---|---|
| `title` | string | Headline text. Max 120 chars. |
| `sentiment` | `BULLISH` \| `BEARISH` \| `CRASH` \| `MOON` | Controls visual theming of the alert on the client. |
| `magnitude` | float | Signed multiplier applied to Fair Value. `-0.12` = -12%. Range: `[-0.50, +0.50]`. |
| `duration_seconds` | integer | How long the modifier remains active. After expiry, Fair Value reverts to standard random walk. |

**Response `200 OK`:**
```json
{
  "status": "success",
  "event_id": "e7a4c2d1-...",
  "message": "News event injected. House Bot requoted. Clients notified.",
  "new_fair_value_approx": 125.40,
  "new_best_bid": 124.90,
  "new_best_ask": 125.90
}
```

---

### `GET /api/admin/market-state`
Returns the current internal state of the market for debugging. **Never exposed to participant clients.**

**Response `200 OK`:**
```json
{
  "fair_value": 125.40,
  "last_traded_price": 126.10,
  "best_bid": 124.90,
  "best_ask": 125.90,
  "spread": 1.00,
  "active_news_event": {
    "title": "Regulator Seizes Exchange Reserves",
    "expires_at": "2024-10-31T14:35:00Z"
  },
  "total_trades_this_session": 247
}
```

---

### `POST /api/admin/reset-session`
Clears all trades, resets all portfolio balances to initial values, cancels all open orders, and resets the Fair Value to the configured starting price. Used between competition rounds.

**Response `200 OK`:**
```json
{
  "status": "success",
  "message": "Session reset. All portfolios restored to 10,000.00 fiat."
}
```
