# Tech Stack & Tooling: simtrade

## 1. Frontend: Next.js + Tailwind CSS + Framer Motion
* **Next.js:** Provides a robust, production-ready React framework. Crucial for fast page loads, structured routing (separating the Participant Dashboard from the God Mode Admin panel), and easy deployment.
* **Tailwind CSS:** Enables rapid styling to achieve the required Apple-style minimalism and glassmorphic UI without maintaining massive CSS files. Allows for high iteration speed during the hackathon.
* **Framer Motion:** The backbone of the "snappy micro-interactions." Will be used for the 300ms flashing PnL, smooth leaderboard shuffling, and button haptics.

## 2. Charting: TradingView Lightweight Charts
* **TradingView Lightweight Charts:** Specifically designed for HTML5 canvas-based high-performance rendering. 
* **Justification:** It is the industry standard for financial charts. It handles real-time data streaming flawlessly, looks incredibly professional out-of-the-box, and supports the minimalist aesthetic required. It is far superior to standard data visualization libraries (like Chart.js) for financial candlestick/line representation.

## 3. Backend & Game Loop: Python (FastAPI)
* **FastAPI:** A modern, incredibly fast Python web framework based on standard Python type hints.
* **Justification:**
  * **Async Support:** FastAPI has first-class support for `asyncio`, which is absolutely mandatory for running a non-blocking 1-second Tick Loop alongside handling dozens of WebSocket connections.
  * **WebSockets:** Built-in, easy-to-use WebSocket support.
  * **Speed of Development:** Pydantic models make data validation between the client and server robust and fast to write.
  * **Math/Logic:** Python is the best language for implementing the Random Walk algorithms and future quantitative logic for the synthetic exchange.

## 4. Database: PostgreSQL
* **PostgreSQL:** The world's most advanced open-source relational database.
* **Justification:** Financial ledgers require strict ACID compliance, transactional integrity, and precise decimal types. NoSQL (like MongoDB) is entirely inappropriate for tracking user balances and transaction histories. PostgreSQL guarantees data integrity for the MVP.
