# Tech Stack & Tooling: Synthex
**Version:** 2.0 — AMM / CLOB Architecture  
**Classification:** Internal — Engineering  
**Status:** Active

---

## 1. Frontend: Next.js + Tailwind CSS + Framer Motion

### Next.js (App Router)
- **Role:** Production-ready React framework serving the Participant Dashboard and the God Mode Admin Panel as distinct, protected routes.
- **Justification:** The App Router model cleanly separates server-side session validation (protecting the Admin route) from the client-heavy, real-time Participant Dashboard. Static page shells are pre-rendered; the real-time data layer is entirely client-side via WebSockets.

### Tailwind CSS
- **Role:** Utility-first styling engine for the design system.
- **Justification:** Enables the required Apple-style minimalist aesthetic with precise control over spacing, typography scale, and the glassmorphic panel system — all without maintaining a bespoke CSS architecture during a fast-moving build cycle.

### Framer Motion
- **Role:** Animation and micro-interaction engine.
- **Justification:** Powers the 300ms PnL flash, leaderboard row reordering, button depress haptics, and — critically — the **Order Book Spread panel's smooth price transition animations** when the House Bot re-quotes after a news event. These animations are not cosmetic; they are a primary UX signal to participants that market conditions have changed.

---

## 2. Charting: TradingView Lightweight Charts

- **Role:** Renders the Last Traded Price (LTP) time series as a real-time candlestick or area chart.
- **Justification:** TradingView Lightweight Charts is the industry-standard HTML5 canvas charting library for financial data. It handles high-frequency real-time data streaming with no visible lag, renders cleanly on the light theme, and carries implicit institutional credibility with any evaluator familiar with professional trading terminals.
- **Note:** In the CLOB architecture, the chart plots **LTP values from matched trades**, not computed tick prices. A period of low trading activity will therefore produce fewer chart updates — a behaviourally authentic representation of a thin market, which itself is pedagogically interesting.

---

## 3. Backend & Game Loop: Python (FastAPI + Asyncio)

- **Role:** Hosts the Fair Value Tick Loop, the House Bot AMM coroutine, the Order Matching Engine, WebSocket connection management, and the Admin REST API.
- **Justification:**
  - **Async-First:** FastAPI's `asyncio` model is architecturally mandatory. The Tick Loop, House Bot coroutine, and WebSocket handlers must co-exist in a single event loop without blocking each other. Synchronous frameworks (Django, Flask) are categorically unsuitable.
  - **Coroutine Isolation:** Each concern (Fair Value computation, House Bot re-quoting, order matching, WebSocket broadcasting) is implemented as a distinct `asyncio.Task`, yielding control appropriately and enabling the sub-50ms broadcast latency required by the TRD.
  - **Pydantic:** All incoming WebSocket payloads and REST request bodies are validated through Pydantic v2 schemas. This is the first line of defence against malformed order submissions and prevents negative-quantity injection attacks.
  - **Quantitative Logic:** Python's `numpy` and `random` standard library are used for the Gaussian noise in the Fair Value random walk. This keeps the stochastic engine self-contained and easily parameterisable.

---

## 4. Database: PostgreSQL

- **Role:** The single source of truth for the Central Limit Order Book, trade execution ledger, user portfolios, Fair Value state, and news events.

### Why PostgreSQL is Non-Negotiable for a CLOB

The introduction of a real order book in Phase 1 elevates the database from a simple ledger to the **concurrency control backbone of the entire exchange**. This is the critical architectural justification:

| Requirement | PostgreSQL Capability | Alternative (e.g., Redis, MongoDB) |
|---|---|---|
| **Row-level locking for order matching** | `SELECT ... FOR UPDATE NOWAIT` — locks the specific Order row being matched, preventing double-fills | Redis has no row-level locking. MongoDB's document-level locking is insufficient for multi-collection atomic operations. |
| **Serialisable isolation for balance deductions** | `SERIALIZABLE` or `READ COMMITTED + atomic UPDATE WHERE` eliminates phantom reads on portfolio balances | NoSQL databases cannot guarantee serialisable multi-document transactions with the same performance characteristics. |
| **Atomic cancel-and-replace for the House Bot** | Multi-statement `BEGIN ... COMMIT` with FK constraints ensures the CLOB is never momentarily empty | Redis `MULTI/EXEC` blocks lack foreign key enforcement and constraint-based consistency guarantees. |
| **Append-only trade ledger** | `INSERT`-only pattern enforced at the application layer; PostgreSQL's WAL guarantees durability of every committed trade | Eventual-consistency stores risk trade loss under crash conditions. |
| **Exact decimal arithmetic** | `NUMERIC(18,6)` prevents floating-point rounding errors on financial values | JavaScript `Number`, Python `float`, and most document DB numeric types introduce rounding errors at scale. |
| **Constraint enforcement as a safety net** | `CHECK (quantity > 0)`, `CHECK (price > 0)`, `NOT NULL` constraints catch application-layer bugs at the DB level | Schema-less stores have no equivalent enforcement mechanism. |

**Conclusion:** PostgreSQL's ACID guarantees are not a performance trade-off for Synthex; they are the mechanism by which the simulation maintains **mathematical correctness** under concurrent load. Any database that cannot provide `SELECT ... FOR UPDATE` semantics within a multi-statement transaction is architecturally incompatible with a CLOB.

---

## 5. Infrastructure (MVP)

| Component | Technology | Rationale |
|---|---|---|
| Containerisation | Docker Compose | Single `docker-compose up` deploys the full stack (Next.js, FastAPI, PostgreSQL) for demo portability. |
| Database Migrations | Alembic | Version-controlled schema evolution, critical for iterating on the CLOB schema during development. |
| Environment Config | `.env` files + Pydantic `BaseSettings` | Keeps secrets (DB connection string, Admin key) out of source control. |
