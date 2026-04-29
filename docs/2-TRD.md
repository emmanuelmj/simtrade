# Technical Requirements Document (TRD): Synthex
**Version:** 2.0 — AMM / CLOB Architecture  
**Classification:** Internal — Engineering  
**Status:** Active

---

## 1. System Constraints & Performance Expectations

### Real-Time Throughput

| Requirement | Target |
|---|---|
| Fair Value Tick Rate | 1 Hz (strict, driven by `asyncio` scheduled loop) |
| House Bot Re-Quote Latency (post Fair Value update) | < 100ms |
| Market Order Match Latency (receipt → DB commit → ack) | < 200ms |
| WebSocket Broadcast Latency (post-match → all clients) | < 50ms |
| Client Render Cycle (chart update + PnL flash + LB shuffle) | < 16ms (60 FPS) |

### Reliability

- The system targets a demo environment but must sustain **100 simultaneous WebSocket connections** without degradation or connection drops.
- If a client WebSocket drops, the client must attempt automatic reconnection with **exponential backoff** (initial delay 500ms, max 5 retries).
- The House Bot must be **self-healing**: if the Fair Value loop is temporarily delayed, the Bot's last posted orders remain live and valid. On the next successful tick, it cancels and reposts.

---

## 2. Concurrency Management & Order Book Integrity

This section constitutes the most critical engineering constraint introduced in Phase 1. The transition to a CLOB creates genuine race conditions that did not exist in the prior quote-driven model.

### 2.1 The Core Concurrency Problem

Multiple participants may submit Market Orders within the same millisecond — particularly immediately following a news injection that produces a visible price dislocation. Simultaneously, the House Bot's 1 Hz re-quote loop may attempt to **cancel and replace** its standing Limit Orders at the exact moment a human Market Order is attempting to **match against those same orders**.

This creates two distinct race conditions:

**Race Condition A — Participant vs. Participant (Phantom Fill):**
> Two participants submit Market Buy orders simultaneously. Without isolation, both could read the same House Bot Ask order as "available," and both could execute against it, resulting in a double-fill on a single Limit Order.

**Race Condition B — House Bot vs. Participant (Cancel-During-Match):**
> The House Bot's re-quote coroutine issues a `DELETE` on its standing Ask order (as part of a cancel-and-replace cycle) at the exact moment a participant's Market Order is attempting to `SELECT ... FOR UPDATE` on that same row, resulting in a failed or phantom match.

### 2.2 Resolution: PostgreSQL Row-Level Locking

All order matching operations **must** use `SELECT ... FOR UPDATE` within a serialised transaction block. The canonical matching sequence is:

```
BEGIN TRANSACTION (ISOLATION LEVEL: READ COMMITTED)
  1. SELECT * FROM orders WHERE side='ASK' AND status='OPEN' ORDER BY price ASC LIMIT 1 FOR UPDATE NOWAIT
     -- NOWAIT causes immediate failure (not a block) if the row is locked by the House Bot re-quote.
     -- The application layer retries once on lock failure.
  2. Validate: participant has sufficient fiat balance (SELECT ... FOR UPDATE on Portfolios row).
  3. INSERT INTO trades (matched_order_id, buyer_id, price, quantity, timestamp)
  4. UPDATE orders SET status='FILLED', filled_at=NOW() WHERE id = <ask_id>
  5. UPDATE portfolios SET fiat_balance = fiat_balance - cost WHERE user_id = <buyer_id>
  6. UPDATE portfolios SET asset_quantity = asset_quantity + qty WHERE user_id = <house_bot_id>
COMMIT
```

### 2.3 House Bot Re-Quote Atomicity

The House Bot's cancel-and-replace cycle **must itself be atomic**:

```
BEGIN TRANSACTION
  1. UPDATE orders SET status='CANCELLED' WHERE owner='HOUSE_BOT' AND status='OPEN'
  2. INSERT INTO orders (owner, side, price, quantity, status) VALUES ('HOUSE_BOT', 'BID', new_bid, qty, 'OPEN')
  3. INSERT INTO orders (owner, side, price, quantity, status) VALUES ('HOUSE_BOT', 'ASK', new_ask, qty, 'OPEN')
COMMIT
```

This guarantees that at no point is the Order Book left in a state with **zero House Bot liquidity**. The atomic cancel-and-insert means either both old orders are cancelled and both new orders are live, or neither transition occurs.

### 2.4 Asyncio Task Isolation

In the FastAPI Asyncio event loop, the Fair Value tick coroutine and the WebSocket message handler for incoming Market Orders run as separate `asyncio.Task` instances. They must **not** share mutable in-memory state (e.g., a global `current_fair_value` variable written by one and read by the other without synchronisation).

**Requirement:** The Fair Value is authoritative only in PostgreSQL. The House Bot reads the last committed Fair Value from the database at each re-quote cycle. In-memory caching of Fair Value is **prohibited** unless protected by `asyncio.Lock`.

---

## 3. Data Integrity & Ledger Requirements

### 3.1 Order Book (CLOB) ACID Requirements

| Property | Implementation |
|---|---|
| **Atomicity** | Every match is a single DB transaction. Partial commits are impossible. |
| **Consistency** | FK constraints on `orders.owner_id`, CHECK constraints on `quantity > 0` and `price > 0`. |
| **Isolation** | `READ COMMITTED` + `SELECT ... FOR UPDATE NOWAIT` for matching. `SERIALIZABLE` for portfolio balance deductions where balance check and deduction are in separate steps. |
| **Durability** | PostgreSQL WAL (Write-Ahead Logging) guarantees committed trades survive process crashes. |

### 3.2 Immutable Trade Ledger

The `trades` table is **append-only**. No record is ever `UPDATE`d or `DELETE`d after insert. Portfolio balance is a **materialised aggregate** over the trades ledger, refreshed after each committed transaction. This ensures a complete, auditable reconstruction of every participant's position at any point in the session.

### 3.3 Balance Atomicity

The following sequence must be executed atomically or not at all:
1. Deduct `fiat_balance` from buyer's portfolio.
2. Deduct `asset_quantity` from House Bot's portfolio (the filled Ask).
3. Credit `asset_quantity` to buyer's portfolio.
4. Record the trade in the `trades` ledger.

A failure at step 3 or 4 must roll back steps 1 and 2. No partial state may persist.

---

## 4. Security Considerations

- **Authentication:** Token-based auth (JWT or session cookie) for participants. All WebSocket upgrade requests must present a valid token.
- **Admin Isolation:** The `/api/admin/*` REST namespace is strictly gated behind a separate `X-Admin-Key` header (hardcoded secret for MVP). No participant-level token may access these endpoints.
- **Payload Validation:** All incoming WebSocket messages are validated through Pydantic schemas before any database operation. Quantities must be positive integers. Symbol must match the configured asset symbol exactly.
- **House Bot Identity:** The House Bot is a server-side coroutine, not a network client. It has no exposed API surface. Its identity in the database is a fixed system user with a non-guessable UUID, never exposed to the client.
- **Negative Value Injection Prevention:** All `quantity` and `price` fields have database-level `CHECK (value > 0)` constraints as a final safety net, independent of application-layer validation.
