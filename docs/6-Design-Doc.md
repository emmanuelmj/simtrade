# UI/UX & Design System: simtrade

## 1. Core Design Principles
* **Apple-Style Minimalism:** The UI must feel premium, sparse, and extremely intentional. Heavy use of whitespace, refined typography (e.g., Inter or SF Pro), and absence of unnecessary borders or heavy drop shadows.
* **Strictly Light Theme:** Unlike standard crypto exchanges which default to dark mode, simtrade distinguishes itself with a clean, blindingly crisp light theme to feel institutional, trustworthy, and modern.
* **Data over Decoration:** The chart and the numbers are the heroes. UI chrome should fade into the background.

## 2. Color Palette Specifications
* **Backgrounds:**
  * App Background: `#F9FAFB` (Very light gray, almost white)
  * Panel / Card Background: `#FFFFFF` (Pure white) with 40% opacity for glassmorphism.
* **Typography:**
  * Primary Text: `#111827` (Near black for maximum contrast)
  * Secondary Text: `#6B7280` (Muted gray for axis labels, timestamps)
* **Status Colors:**
  * Success Green (Uptick, Profit): `#10B981` (Vibrant, high contrast)
  * Danger Red (Downtick, Loss, Crash): `#EF4444`
  * UI Accent (e.g., active tabs, focus rings): `#3B82F6` (Apple blue)

## 3. Component Specifications

### The Chart (TradingView)
* Positioned centrally, taking up the majority of the viewport.
* Grid lines should be extremely subtle (`#F3F4F6`) or completely hidden.
* Candlesticks follow the standard Green/Red palette, with no borders.

### Glassmorphic Ticker (News Alerts)
* A fixed overlay at the top or bottom of the screen.
* Uses CSS `backdrop-filter: blur(12px)`.
* Only appears when a News Event is active. Slides in from off-screen.

### Live Leaderboard
* Anchored to the right sidebar.
* Minimalist table. 
* Uses Framer Motion `layout` prop so rows smoothly slide past each other when ranks change, rather than snapping instantly.

### 1-Click Execution Buttons
* Massive, highly tappable target areas at the bottom of the screen or adjacent to the chart.
* **BUY:** Solid Green background, white text.
* **SELL:** Solid Red background, white text.
* No confirmation modals. Speed is paramount.

## 4. Micro-Interaction Rules

To make the platform feel "alive" and deterministic, haptic visual feedback is crucial:

1. **The 300ms Flash:** Whenever the 1-second tick updates the user's PnL, the text color of the PnL must quickly flash Green (if increased) or Red (if decreased) before fading back to the default dark text over 300ms.
2. **Button Depress:** Clicking Buy/Sell must physically scale down the button (`scale: 0.95` via Framer Motion) to simulate a mechanical switch.
3. **News Impact Shake:** If an admin triggers a "Market Crash," the entire chart container should execute a subtle 100ms X-axis shake animation to physically register the impact of the event.
