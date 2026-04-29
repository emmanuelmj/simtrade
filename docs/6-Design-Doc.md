# UI/UX & Design System: Synthex
**Version:** 2.0 — AMM / CLOB Architecture  
**Classification:** Internal — Design & Frontend  
**Status:** Active

---

## 1. Core Design Principles

- **Apple-Style Minimalism:** The interface must feel premium, intentional, and sparse. Every pixel earns its place. Whitespace is load-bearing structure, not empty filler. No decorative borders, no heavy drop shadows, no gradients for their own sake.
- **Strictly Light Theme:** Unlike conventional crypto exchanges that default to dark mode (evoking retail speculation), Synthex uses a blindingly crisp light theme. This communicates institutional trust, academic rigour, and the confidence of a Bloomberg Terminal — not a retail brokerage.
- **Data Over Decoration:** The chart and the numbers are the heroes. UI chrome — nav bars, labels, containers — must actively recede into the background. Participants should never have to search for the information they need to trade.
- **Information Hierarchy:** At any moment, a participant's eye should naturally land on: (1) the Order Book Spread panel (what price can I trade at right now?), (2) the chart (what has the price been doing?), (3) their PnL (am I winning?). All other UI elements are secondary.

---

## 2. Color Palette Specifications

### Backgrounds
| Token | Hex | Usage |
|---|---|---|
| `bg-app` | `#F9FAFB` | Root application background (very light gray) |
| `bg-panel` | `#FFFFFF` | Cards, sidebars, the Order Book panel |
| `bg-panel-glass` | `rgba(255,255,255,0.6)` | Glassmorphic overlays (news ticker, tooltips) |

### Typography
| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#111827` | All primary data labels, prices, usernames |
| `text-secondary` | `#6B7280` | Axis labels, timestamps, secondary metadata |
| `text-tertiary` | `#9CA3AF` | Placeholder text, disabled state labels |

### Semantic / Status
| Token | Hex | Usage |
|---|---|---|
| `color-bull` | `#10B981` | Uptick candles, positive PnL, BUY button |
| `color-bear` | `#EF4444` | Downtick candles, negative PnL, SELL button, crash alerts |
| `color-accent` | `#3B82F6` | Focus rings, active tab underline, interactive highlights |
| `color-spread-bid` | `#10B981` | Order Book Spread panel — Bid price display |
| `color-spread-ask` | `#EF4444` | Order Book Spread panel — Ask price display |
| `color-neutral` | `#F3F4F6` | Chart grid lines, dividers (extremely subtle) |

### Typography Scale
- **Font Family:** `Inter` (Google Fonts) with system-font fallback. `SF Pro Display` as an optional override on macOS for native fidelity.
- **Monospace (prices, quantities):** `JetBrains Mono` or `IBM Plex Mono` — critical for price displays so digits have uniform width and don't cause layout reflow on update.

---

## 3. Component Specifications

### 3.1 The Chart (TradingView Lightweight Charts)

- Positioned centrally, occupying the majority of the viewport (minimum 60% width on desktop).
- Plots **Last Traded Price (LTP)** from confirmed trade events (`type: "trade"` WebSocket messages).
- Grid lines: `#F3F4F6` (barely visible) or hidden entirely. Axes: secondary text color.
- Candlesticks: Bull `#10B981`, Bear `#EF4444`, no wick borders.
- **Behaviour during low activity:** If no trades occur between tick cycles (no human submitted an order), the chart does not update. This is intentional — it visually communicates market thinness and is behaviourally authentic.
- **Crash visual:** On receipt of a `news_alert` with `sentiment: "CRASH"`, the chart container executes a 100ms X-axis shake animation (`translateX` oscillation via Framer Motion) to physically register the event's impact before the price series visually drops.

---

### 3.2 Order Book Spread Panel *(New in v2.0 — Critical Component)*

**Purpose:** This is the most important new UI element in the CLOB architecture. It provides participants with **pre-trade price transparency** — they know exactly what price their next Market Order will execute at before they click. Without this panel, the market order model is opaque and the platform loses its educational validity.

**Placement:** Immediately adjacent to the chart — positioned either as a narrow vertical panel on the left side of the chart, or as a compact horizontal strip directly above the BUY/SELL execution buttons. It must always be above the fold; participants must never have to scroll to see it.

**Visual Design:**
```
┌─────────────────────────────────┐
│        ORDER BOOK               │
│  ─────────────────────────────  │
│  SELL at   143.25  ▲  (ASK)     │  ← color-spread-ask (#EF4444)
│  ─────────────────────────────  │
│  SPREAD     1.50                │  ← text-secondary (neutral)
│  ─────────────────────────────  │
│  BUY at    141.75  ▼  (BID)     │  ← color-spread-bid (#10B981)
└─────────────────────────────────┘
```

**Specifications:**

| Element | Requirement |
|---|---|
| **Ask Price** | Displayed in `color-spread-ask` (`#EF4444`). Monospace font. Label: "SELL at" (i.e., "this is the price at which you can BUY, which is a cost to you"). |
| **Bid Price** | Displayed in `color-spread-bid` (`#10B981`). Monospace font. Label: "BUY at" (i.e., "this is the price at which you can SELL"). |
| **Spread** | Displayed in `text-secondary`. Format: absolute value in price units. Does not require a label beyond "SPREAD." |
| **Update animation** | On `orderbook_update` WebSocket message, the Ask and Bid values **animate to their new values** using a smooth number count-up/count-down over 150ms (not a hard snap). During a Market Crash, the prices drop dramatically — this animated descent is a primary visual signal. |
| **Spread-widening highlight** | If the spread value increases by more than 50% in a single update (indicating a high-volatility news injection), briefly flash the spread row background to a muted amber (`#FEF3C7`) over 500ms before fading back. This is the only instance of a warm color in the otherwise green/red palette — chosen specifically to signal "caution, conditions have changed" without triggering alarm. |
| **Depth display** | Show available `bid_quantity` and `ask_quantity` in smaller `text-secondary` text below each price. Format: `× 500 units available`. |
| **Empty state** | If no House Bot quotes are available (transient, < 100ms theoretically), display "Awaiting Quotes..." in `text-tertiary`. Do not show zeros. |

**Accessibility:** All price values must have `aria-live="polite"` so screen readers announce updates without interrupting the user.

---

### 3.3 1-Click Execution Buttons

- Massive, highly tappable targets (minimum 56px height on mobile, 48px on desktop).
- **BUY:** Solid `#10B981` background, white text, label: `BUY SIM`.
- **SELL:** Solid `#EF4444` background, white text, label: `SELL SIM`.
- The current **best Ask** is shown in small text below the BUY button: `@ 143.25 per unit`.
- The current **best Bid** is shown in small text below the SELL button: `@ 141.75 per unit`.
- This redundancy with the Order Book panel is intentional: the participant never has to look away from the execution area to know their fill price.
- **No confirmation modals.** Speed is a core mechanic. The TRADE_RESULT acknowledgement provides post-hoc confirmation.
- Buttons are **disabled and visually dimmed** during the 200ms window after a submission (prevents double-click double-submission). Re-enable on receipt of `TRADE_RESULT`.

---

### 3.4 Glassmorphic News Ticker

- Fixed overlay anchored to the top of the viewport.
- CSS: `backdrop-filter: blur(12px)`, `background: rgba(255,255,255,0.6)`, `border-bottom: 1px solid rgba(0,0,0,0.06)`.
- Only renders when a `news_alert` WebSocket message is received. Slides in from the top over 300ms (Framer Motion `y` animation from `-100%` to `0`). Automatically slides out when `duration_seconds` expires.
- **Crash events** use a red-tinted background: `rgba(239,68,68,0.08)` — subtle enough to maintain the minimalist aesthetic while unmistakably signalling danger.
- Contains: Sentiment icon (▲ BULLISH / ▼ BEARISH / ⚡ CRASH / 🚀 MOON), headline text, and a countdown timer showing remaining event duration.

---

### 3.5 Live Leaderboard

- Anchored to the right sidebar, full height.
- Minimalist table: rank number, username, total portfolio value, PnL (absolute and percentage).
- Uses Framer Motion `layout` prop — rows animate their Y position smoothly when ranks change, rather than snapping. Duration: 400ms, ease: `easeInOut`.
- The current participant's row is highlighted with a left-border `3px solid #3B82F6` and a very faint blue background (`rgba(59,130,246,0.04)`).
- Leaderboard recalculates **immediately on every `trade` event** (the new LTP marks all open positions to market).

---

## 4. Micro-Interaction Rules

All micro-interactions serve a functional purpose — they are information delivery mechanisms, not decoration.

| Interaction | Trigger | Implementation | Purpose |
|---|---|---|---|
| **PnL 300ms Flash** | `trade` WebSocket message changes user's unrealised PnL | Text color animates to `#10B981` (gain) or `#EF4444` (loss) over 300ms, then fades to `#111827` | Immediate confirmation that the price move affected the user's position |
| **Order Book Price Scroll** | `orderbook_update` message | Ask/Bid values animate count-up or count-down to new values over 150ms | Communicates direction and magnitude of the House Bot's re-quote |
| **Spread Amber Flash** | Spread widens > 50% in one update | Spread row background briefly flashes `#FEF3C7` over 500ms | Alerts participant to a liquidity condition change (news event consequence) |
| **Button Depress** | Participant clicks BUY or SELL | Framer Motion `whileTap: { scale: 0.95 }` over 80ms | Haptic feedback analogue; confirms the click registered |
| **Chart Shake** | `news_alert` with `sentiment: "CRASH"` | Framer Motion `x` keyframe: `[0, -6, 6, -4, 4, 0]` over 100ms | Physical registration of the crash event; visceral market impact signal |
| **Leaderboard Row Shuffle** | `leaderboard_update` message | Framer Motion `layout` animation, 400ms `easeInOut` | Communicates rank changes without disorienting sudden jumps |
| **Trade Fill Toast** | `TRADE_RESULT: SUCCESS` received | Slide-in toast (bottom-right), 2s auto-dismiss, shows fill price | Post-execution confirmation; replaces the confirmation modal |
| **Fill Failure Toast** | `TRADE_RESULT: FAILED` received | Same toast in `#EF4444` tint, shows failure reason code | Communicates rejection without blocking the UI |

---

## 5. Layout Specification (Desktop — 1440px Reference)

```
┌──────────────────────────────────────────────────────────────────┐
│  [News Ticker — slides in from top when active]                   │
├────────────────────────────────────────────┬─────────────────────┤
│                                            │                     │
│   TradingView Chart (LTP)                  │   Live Leaderboard  │
│   ~65% width                               │   ~25% width        │
│                                            │                     │
│                                            │                     │
├──────────────┬─────────────────────────────┤                     │
│ Order Book   │  [BUY SIM]   [SELL SIM]     │                     │
│ Spread Panel │  @ 143.25    @ 141.75       │                     │
│ ~10% width   │  ~25% width                 │                     │
└──────────────┴─────────────────────────────┴─────────────────────┘
```

**Mobile (375px):** Order Book Spread panel and Execution Buttons are stacked vertically and pinned to the bottom of the viewport as a persistent action tray. Chart is full-width and scrollable. Leaderboard collapses to a 3-row preview accessible via a bottom sheet.
