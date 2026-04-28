# Killer Features List: simtrade MVP (RIT-Inspired)

This document outlines the core features for the simtrade MVP, heavily inspired by the Rotman Interactive Trader (RIT) platform, tailored for a high-octane hackathon demo and academic simulation.

## 1. Event-Driven Market Dynamics (The "News" Engine)
*RIT is known for its macro-economic news releases that shock the market. simtrade replicates this with a deterministic approach.*
* **Dynamic Scenario Injections:** Admins can inject "News Events" (e.g., "Interest Rates Hiked", "CEO Resigns") that instantly alter the underlying Random Walk parameters (drift and volatility).
* **Information Asymmetry (Optional):** Ability to broadcast news to different participants at slightly offset times, simulating insider information or premium data feeds.
* **Glassmorphic News Ticker:** A sleek, real-time alert banner that pushes breaking news directly to the participant's dashboard.

## 2. Advanced Portfolio & Risk Management
*RIT emphasizes risk; traders must manage their exposure.*
* **Live Mark-to-Market (MTM) PnL:** Continuous updating of Unrealized PnL, Realized PnL, and total portfolio value on every 1-second tick.
* **Position Limits:** Hard caps on maximum long and short positions to prevent participants from simply going "all in" immediately, forcing them to scale in/out of trades.
* **Average Cost & VWAP:** Real-time calculation of the trader's average entry price.
* **Margin Calls / Auto-Liquidation:** If a participant's portfolio value drops below a certain maintenance margin, the system automatically liquidates their positions at the current market price with a penalty.

## 3. High-Frequency Execution Interface
*Speed is paramount in RIT competitions.*
* **1-Click Execution:** Apple-style minimalist buttons for instant Market BUY/SELL execution. No confirmation modals.
* **Zero-Latency Front-Running Prevention:** Trade executions are stamped and resolved at the server's *exact tick price* at the moment of processing, simulating realistic slippage and preventing UI hacking.
* **Visual Haptic Feedback:** The UI provides instantaneous visual cues (e.g., a 300ms green/red flash on the PnL text, subtle screen shakes on heavy market crashes).

## 4. Algorithmic Trading API (REST/WebSocket)
*A core feature of RIT is allowing students to write Python bots.*
* **Algo-Ready API:** Alongside the UI, participants are provided with API keys and an endpoint (`/api/execute`) to submit trades programmatically.
* **WebSocket Data Feed:** A public WebSocket stream that bots can listen to for real-time price ticks and news alerts, allowing participants to build automated trading algorithms.

## 5. Gamification & Competition Mechanics
* **Sub-Second Live Leaderboard:** A fully animated, shuffling leaderboard tracking relative rank based on Total MTM Value.
* **Trading Halts / Circuit Breakers:** If the asset price drops by more than X% in Y seconds, the Admin or the system can trigger a "Trading Halt," freezing the chart and execution buttons to simulate real-world panic management.

## 6. God Mode Admin Dashboard (Game Master)
* **Live Market Override:** Buttons to instantly override the Random Walk (e.g., "Trigger Flash Crash", "Trigger Short Squeeze").
* **Simulation Controls:** Ability to Pause, Resume, or Reset the simulation timer.
* **Participant Oversight:** A master view of all participants' current positions and PnL, with the ability to manually disqualify or liquidate individuals.

---

## 7. Roadmap to Full RIT Parity (Phase 2)
While the MVP uses a "trade against the House" model for development speed, achieving complete RIT parity will introduce:
1.  **Central Limit Order Book (CLOB):** Moving away from House liquidity to Peer-to-Peer trading, where prices are driven purely by participant supply and demand.
2.  **Advanced Order Types:** Limit Orders, Stop Loss, and Fill-or-Kill (FOK) orders.
3.  **Correlated Assets (Arbitrage):** Introducing multiple interconnected assets (e.g., a synthetic ETF and its underlying synthetic stocks) to allow for pairs trading and statistical arbitrage strategies.
