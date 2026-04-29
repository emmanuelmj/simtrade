# Product Requirements Document (PRD): Synthex
**Version:** 2.0 — AMM / CLOB Architecture  
**Classification:** Internal — VC & Academic Review  
**Status:** Active

---

## 1. Executive Summary & Vision

**Synthex** is a real-time synthetic financial exchange platform purpose-built for high-stakes academic and competitive trading simulations. It moves decisively beyond naive price-feed simulations by implementing a **Central Limit Order Book (CLOB)** driven by an **Automated Market Maker (AMM) House Bot** — a design pattern grounded in microstructure economics research (cf. Gode & Sunder, 1993, *"Allocative Efficiency of Markets with Zero Intelligence Traders"*).

Rather than broadcasting an externally computed price to passive participants, Synthex creates a **genuine two-sided market**: the House Bot continuously posts Limit Orders (Bids and Asks) anchored to an invisible stochastic Fair Value, while human participants submit Market Orders that execute against those standing quotes. The **Last Traded Price (LTP)** — the only price participants ever see — is the price of the most recently matched trade, not a computed feed.

This architecture means that:
- The market **price discovery process is real**, not simulated.
- Human behaviour and panic responses are **causally connected** to order flow.
- Admin-injected News Events produce **mechanistically authentic** market crashes: the House Bot reprices, the spread widens, and liquidity conditions change — exactly as they would in a real exchange.

The goal of the MVP is to demonstrate institutional-grade market microstructure mechanics within a visually stunning, real-time competition platform capable of winning at hackathon and convincing academic evaluators of its pedagogical merit.

---

## 2. Target Audience

| Audience | Evaluation Lens |
|---|---|
| **VC Investors** | Assess technical differentiation, scalability of the AMM model, and the defensibility of the synthetic exchange design. |
| **Hackathon Judges** | Evaluate real-time WebSocket infrastructure, architectural soundness, and UI/UX execution quality. |
| **Professors & Academic Evaluators** | Validate the simulation against established market microstructure theory. The Gode & Sunder Zero-Intelligence framework must be explicitly reflected. |

---

## 3. User Personas

### Persona 1: The Participant (Trader)
- **Goal:** Maximise synthetic portfolio value by reading order book signals and reacting to news events faster than competitors.
- **Needs:** Real-time visibility of the Order Book spread (best Bid / best Ask), instant Market Order execution with confirmed fill price, live leaderboard, and clear news alerts.
- **Pain Points:** Latency, ambiguous execution price, lack of pre-trade price transparency.

### Persona 2: The Admin / Game Master (God Mode)
- **Goal:** Engineer a volatile, educational, and dramatically engaging competition environment.
- **Needs:** A hidden control panel to inject News Events ("Good News," "Bad News," "Market Crash") that immediately and visibly reprice the House Bot's Order Book.
- **Pain Points:** Delayed propagation of injected events; participant confusion about causality.

---

## 4. Scope

### In-Scope for MVP (Phase 1 — Upgraded)
- **Stochastic Fair Value Engine:** A 1 Hz Python Asyncio loop computing an invisible random-walk Fair Value for the synthetic asset $SIM.
- **AMM House Bot:** A backend agent that continuously maintains exactly one active Bid and one active Ask in the CLOB, quoted as `Fair Value ± spread_bps`.
- **Central Limit Order Book (CLOB):** A PostgreSQL-backed order book storing the House Bot's live Limit Orders.
- **Market Order Execution:** Participants submit Market Orders (BUY / SELL) that match against the House Bot's standing Limit Orders with full ACID guarantees.
- **Last Traded Price Broadcasting:** The LTP (price of the last matched trade) is broadcast via WebSocket to all clients.
- **Order Book State Broadcasting:** Current best Bid and best Ask are broadcast alongside every LTP update.
- **News Injection Scenario Engine:** Admin-triggered events that apply signed multipliers to the Fair Value, forcing the House Bot to cancel stale orders and repost dramatically repriced quotes.
- **Participant Dashboard:** TradingView Lightweight Chart (LTP as line/candlestick), Order Book Spread panel, live leaderboard, and news ticker.
- **God Mode Admin Panel:** REST-based scenario injection interface.

### Out-of-Scope (Phase 2 & Beyond)
- Peer-to-peer (P2P) order matching between human participants.
- Participant-submitted Limit Orders.
- Stop-Loss or conditional order types.
- Multi-asset correlation engines.
- Historical session replay or data export.

---

## 5. Core User Stories for the MVP Demo

1. **As a Participant,** I want to see the current House Bid and House Ask prices in a dedicated Order Book panel, so I know exactly what price my next trade will execute at before I click.
2. **As a Participant,** I want to submit a Market Buy or Market Sell with 1-click and receive an instant fill confirmation showing my exact executed price, so I can manage my PnL without ambiguity.
3. **As a Participant,** I want to see a real-time chart of Last Traded Prices updating every time a trade occurs, so I can read price momentum and time my entries.
4. **As a Participant,** I want to see a live leaderboard ranking all competitors by total portfolio value, updating continuously, so I can assess my standing.
5. **As an Admin,** I want to trigger a "Market Crash" event from the God Mode panel, causing the House Bot to immediately cancel its current orders and repost dramatically lower Bid/Ask quotes, producing a visible, instantaneous crash on all participant screens.
6. **As an Admin,** I want injected News Events to be broadcast as a breaking news alert to all connected participants simultaneously with the repriced Order Book, so causality between news and market impact is unambiguous.
7. **As an Academic Evaluator,** I want to observe that price formation emerges from actual order matching — not a computed feed — confirming alignment with Zero-Intelligence market microstructure research.

---

## 6. Success Metrics for the Demo

| Metric | Target |
|---|---|
| Order match latency (Market Order → fill confirmation) | < 200ms end-to-end |
| WebSocket broadcast latency (LTP + Order Book update) | < 50ms post-match |
| House Bot re-quote latency after news injection | < 500ms |
| Zero dropped WebSocket connections under 100 concurrent clients | ✅ |
| Zero dirty reads or balance race conditions under concurrent submissions | ✅ |
