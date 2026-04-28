# Product Requirements Document (PRD): simtrade

## 1. Executive Summary & Vision
**simtrade** is a deterministic, real-time synthetic stock market platform built for hosting high-stakes financial competitions. Instead of relying on real-world financial APIs, simtrade generates a proprietary synthetic market environment where asset prices are driven by an internal "Random Walk" algorithm. To introduce volatility and test participants' reflexes, the market is dynamically altered by scheduled or ad-hoc custom "News Events" (scenario injections). 

The goal of the MVP is to prove the robust real-time WebSocket infrastructure and deliver a high-end, visually stunning, hackathon-winning demo. Participants currently trade against the "House," making the platform a race for the highest PnL rather than a zero-sum PvP exchange.

## 2. Target Audience
* **Hackathon Judges & Technical Evaluators:** Will assess the real-time capabilities, architectural soundness, and flawless UI/UX execution.
* **Professors & Academic Mentors:** Will evaluate the simulation's validity as an educational tool for market mechanics and event-driven trading.

## 3. User Personas
### Persona 1: The Participant (Trader)
* **Goal:** Maximize their synthetic portfolio value within the time limit.
* **Needs:** Real-time price updates (no lag), instant execution on trades, live leaderboard to track standing, clear visibility of injected news events.
* **Pain Points:** Latency, confusing UI, lack of immediate feedback on trade execution.

### Persona 2: The Admin / Game Master (God Mode)
* **Goal:** Create an engaging, volatile competition environment.
* **Needs:** A hidden control panel to instantly deploy market-moving events ("Good News," "Bad News," "Market Crash").
* **Pain Points:** Complex configuration, delayed impact of injected events on the client side.

## 4. Scope
### In-Scope for MVP
* 1-second FastAPI tick system for synthetic price generation (Random Walk).
* Scenario Engine for injecting news and overriding standard price movement.
* Real-time bi-directional WebSocket communication for prices and trade execution.
* Participant Dashboard with TradingView charts, live leaderboard, and glassmorphic news ticker.
* 1-click buy/sell execution.
* "God Mode" Admin Panel for live scenario injection.

### Out-of-Scope (Phase 2 & Beyond)
* Central Limit Order Book (CLOB) - No peer-to-peer trading.
* Advanced order types (Limit, Stop Loss).
* Historical data querying beyond the current session.
* Multi-asset correlation engines.

## 5. Core User Stories for the MVP Demo
1. **As a Participant**, I want to see price updates every second on a smooth chart, so I can time my trades accurately.
2. **As a Participant**, I want to buy or sell an asset with 1-click and receive instant visual haptic feedback.
3. **As a Participant**, I want to see a live leaderboard updating my rank relative to others based on real-time PnL.
4. **As an Admin**, I want to press a "Market Crash" button in the God Mode panel, so that all participants instantly see a massive red candle and receive a breaking news alert.
5. **As an Admin**, I want to ensure my manual scenario injections override the standard random walk algorithm seamlessly.
