# Technical Requirements Document (TRD): simtrade

## 1. System Constraints & Performance Expectations

### Real-Time Throughput
* **Tick Rate:** The backend Game Loop must run at a strict 1 tick per second (1 Hz).
* **WebSocket Broadcasting:** Every 1 second, the server must broadcast the new price, leaderboard updates, and active news events to all connected clients within <50ms latency.
* **Client Rendering:** The frontend must render the new data (chart tick, PnL flash, leaderboard shuffle) in under 16ms (to maintain 60 FPS visual smoothness).

### Reliability
* The system is designed for a demo environment but must not drop WebSocket connections under demo load (e.g., 50-100 simultaneous simulated connections).
* If a WebSocket drops, the client must attempt automatic reconnection with exponential backoff.

## 2. Concurrency Management

### Trade Execution (Simultaneous Requests)
* **Problem:** Multiple participants may click "Buy" or "Sell" in the exact same millisecond, especially immediately following a news injection.
* **Resolution:** 
  * Trade executions sent via WebSocket will be processed asynchronously by the FastAPI backend.
  * Given the "trading against the House" model, we do not need strict order matching (like a CLOB). 
  * Execution price is determined by the *server-side current tick price* at the exact moment the request is parsed, *not* the client-side requested price. This prevents front-running network latency.
  * Database writes for the ledger must be handled in transactions to prevent race conditions on user balances.

## 3. Data Integrity & Ledger Requirements

### PostgreSQL Financial Ledger
* **ACID Compliance:** All financial transactions (Buy/Sell) must be fully ACID compliant.
* **Balance Checks:** A transaction must strictly enforce that a user has sufficient fiat (for buying) or sufficient asset inventory (for selling).
* **Isolation Level:** `Read Committed` is generally sufficient, but `Serializable` should be used for ledger updates if account balance checks and deductions are done in separate steps (alternatively, use atomic `UPDATE ... WHERE balance >= cost`).
* **Audit Trail:** The `Transactions` table must be an append-only ledger. No records are ever deleted or mutated after execution. User portfolio balance is a calculated view (or cached aggregate) of the transaction ledger.

## 4. Security Considerations for MVP
* **Authentication:** Simple token-based or session-based auth for participants.
* **Admin Security:** The "God Mode" panel must be strictly isolated (e.g., via hardcoded admin API keys or specific role checks) to prevent participants from triggering market crashes.
* **Payload Validation:** All incoming WebSocket messages (trades) must be validated (Pydantic schemas) to prevent injection of malicious quantities or negative values.
