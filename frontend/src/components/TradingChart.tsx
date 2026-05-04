'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
  LineSeries,
  ColorType,
} from 'lightweight-charts';
import { useMarketStore } from '../store/marketStore';

interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const CANDLE_INTERVAL_S = 5;      // 5-second candles
const IST_OFFSET_S      = 19800;  // UTC+5:30 in seconds

/** Convert a UTC Unix-seconds timestamp to an IST-shifted value
 *  that Lightweight Charts will display as the correct IST time. */
const toIST = (utcSec: number) => (utcSec + IST_OFFSET_S) as Time;

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const candleRef = useRef<OHLC | null>(null);
  // Per-symbol candle history
  const historyMapRef = useRef<Record<string, OHLC[]>>({});
  const prevSymbolRef = useRef<string | null>(null);

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const marketPrices   = useMarketStore((s) => s.marketPrices);
  const data = marketPrices[selectedSymbol];

  const [prevClose, setPrevClose]       = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange]   = useState<number>(0);
  const [istTime, setIstTime]           = useState('');
  const [istDate, setIstDate]           = useState('');
  const [selectedRange, setSelectedRange] = useState('1H');
  const [showIndicators, setShowIndicators] = useState(false);
  const [showDrawingMenu, setShowDrawingMenu] = useState(false);

  // Live IST clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setIstTime(now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }));
      setIstDate(now.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Chart initialisation ─────────────────────────────────────────── */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.6)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.6)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#1e293b',
        barSpacing: 12,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: { top: 0.15, bottom: 0.1 },
      },
      crosshair: {
        vertLine: { color: '#3b82f6', width: 1, style: 3, labelBackgroundColor: '#3b82f6' },
        horzLine: { color: '#3b82f6', width: 1, style: 3, labelBackgroundColor: '#3b82f6' },
      },
      localization: {
        timeFormatter: (utcSec: number) => {
          const realUtcMs = (utcSec - IST_OFFSET_S) * 1000;
          return new Date(realUtcMs).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
          });
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:            '#10b981', 
      downColor:          '#f43f5e', 
      borderUpColor:      '#10b981',
      borderDownColor:    '#f43f5e',
      wickUpColor:        '#10b981',
      wickDownColor:      '#f43f5e',
    });

    // EMA Indicators (hidden by default, toggled via button)
    const ema20 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'EMA 20', priceLineVisible: false, visible: false });
    const ema50 = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'EMA 50', priceLineVisible: false, visible: false });
    const ema200 = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, title: 'EMA 200', priceLineVisible: false, visible: false });

    // RSI Indicator (hidden by default)
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#ec4899',
      lineWidth: 2,
      title: 'RSI 14',
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(236, 72, 153, 0.4)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'OVERBOUGHT',
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(236, 72, 153, 0.4)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'OVERSOLD',
    });

    chartRef.current = chart;
    seriesRef.current = series;
    (chart as any).ema20 = ema20;
    (chart as any).ema50 = ema50;
    (chart as any).ema200 = ema200;
    (chart as any).rsiSeries = rsiSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  /* ── Technical Indicators Utility ────────────────────────────────── */
  const calculateEMA = (data: OHLC[], period: number) => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    let ema = data[0].close;
    const results = [{ time: data[0].time as Time, value: ema }];
    for (let i = 1; i < data.length; i++) {
      ema = (data[i].close - ema) * k + ema;
      results.push({ time: data[i].time as Time, value: ema });
    }
    return results;
  };

  const calculateRSI = (data: OHLC[], period: number = 14) => {
    if (data.length <= period) return [];
    const results = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      results.push({ time: data[i].time as Time, value: rsi });
    }
    return results;
  };

  /* ── Update chart precision based on symbol ── */
  useEffect(() => {
    if (!seriesRef.current) return;
    const precision = (selectedSymbol.includes('USD') || selectedSymbol.includes('EUR')) ? 4 : 2;
    seriesRef.current.applyOptions({
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: precision === 4 ? 0.0001 : 0.01,
      }
    });
  }, [selectedSymbol]);

  /* ── When selectedSymbol changes, wipe chart and load symbol's history ── */
  useEffect(() => {
    if (!seriesRef.current) return;
    if (prevSymbolRef.current === selectedSymbol) return;

    // Save the current candle to the old symbol's history
    if (prevSymbolRef.current && candleRef.current) {
      const oldHistory = historyMapRef.current[prevSymbolRef.current] || [];
      historyMapRef.current[prevSymbolRef.current] = [...oldHistory, { ...candleRef.current }].slice(-500);
    }
    candleRef.current = null;

    // Load new symbol's history
    const newHistory = historyMapRef.current[selectedSymbol] || [];
    seriesRef.current.setData(newHistory.map((c) => ({ ...c, time: c.time as Time })));
    
    // Update Indicators
    const c = chartRef.current as any;
    if (c) {
      c.ema20.setData(calculateEMA(newHistory, 20));
      c.ema50.setData(calculateEMA(newHistory, 50));
      c.ema200.setData(calculateEMA(newHistory, 200));
      c.rsiSeries.setData(calculateRSI(newHistory, 14));
    }

    if (newHistory.length > 0) {
      const lastCandle = newHistory[newHistory.length - 1];
      setCurrentPrice(lastCandle.close);
      setPrevClose(lastCandle.open);
      setPriceChange(lastCandle.close - lastCandle.open);
    } else {
      setCurrentPrice(null);
      setPrevClose(null);
      setPriceChange(0);
    }

    prevSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const now = Math.floor(Date.now() / 1000) + IST_OFFSET_S;

    let seconds = 0;
    switch (range) {
      case '1H':  seconds = 3600; break;
      case '4H':  seconds = 4 * 3600; break;
      case '1D':  seconds = 24 * 3600; break;
      case '2D':  seconds = 48 * 3600; break;
      case '1W':  seconds = 7 * 24 * 3600; break;
      case '1M':  seconds = 30 * 24 * 3600; break;
      case 'ALL': timeScale.fitContent(); return;
      default:    seconds = 3600;
    }

    timeScale.setVisibleRange({
      from: (now - seconds) as Time,
      to:   now as Time,
    });
  };

  /* ── Feed price ticks into candle aggregator ─────────────────────── */
  useEffect(() => {
    if (!seriesRef.current || !data) return;
    if (data.symbol !== selectedSymbol) return;

    const mid = (data.best_bid + data.best_ask) / 2;
    const nowSec     = Math.floor(Date.now() / 1000);
    const bucketUTC  = Math.floor(nowSec / CANDLE_INTERVAL_S) * CANDLE_INTERVAL_S;
    const bucketTime = bucketUTC + IST_OFFSET_S;

    setCurrentPrice(mid);

    const existing = candleRef.current;
    const history = historyMapRef.current[selectedSymbol] || [];

    if (!existing || existing.time !== bucketTime) {
      if (existing) {
        const closed = { ...existing };
        historyMapRef.current[selectedSymbol] = [...history, closed].slice(-500);
        setPrevClose(closed.close);
        setPriceChange(closed.close - closed.open);
        
        // Update EMA on closed candle
        const c = chartRef.current as any;
        if (c) {
          const newHist = historyMapRef.current[selectedSymbol];
          c.ema20.setData(calculateEMA(newHist, 20));
          c.ema50.setData(calculateEMA(newHist, 50));
          c.ema200.setData(calculateEMA(newHist, 200));
          c.rsiSeries.setData(calculateRSI(newHist, 14));
        }
      }
      const newCandle: OHLC = { time: bucketTime, open: mid, high: mid, low: mid, close: mid };
      candleRef.current = newCandle;

      const allData = [...(historyMapRef.current[selectedSymbol] || []), newCandle];
      seriesRef.current.setData(allData.map((c) => ({ ...c, time: c.time as Time })));
    } else {
      const updated: OHLC = {
        ...existing,
        high:  Math.max(existing.high, mid),
        low:   Math.min(existing.low, mid),
        close: mid,
      };
      candleRef.current = updated;
      seriesRef.current.update({ ...updated, time: updated.time as Time });
    }
  }, [data, selectedSymbol]);

  const isUp = currentPrice !== null && prevClose !== null ? currentPrice >= prevClose : true;
  const priceColor = isUp ? '#10b981' : '#f43f5e';

  return (
    <div className="w-full h-full relative bg-white dark:bg-[#0d1117]">
      {/* Price overlay */}
      <div className="absolute top-4 left-5 z-10 pointer-events-none select-none">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
              ${selectedSymbol}
            </p>
            {currentPrice !== null && (
              <div className="flex items-baseline gap-3">
                <span
                  className="text-2xl font-mono font-black tracking-tighter transition-colors duration-300"
                  style={{ color: priceColor }}
                >
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  className="text-[11px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5"
                  style={{ color: priceColor }}
                >
                  {priceChange >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(priceChange).toFixed(2)}
                </span>
                <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20 animate-pulse">
                  PRO DATA
                </span>
              </div>
            )}
            {istTime && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums tracking-widest">
                  {istTime}
                </span>
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">Kolkata IST</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Chart Toolbar (Top Right) ───────────────────── */}
      <div className="absolute top-4 right-5 z-20 flex items-center gap-2">
        {/* Indicators Toggle */}
        <button
          onClick={() => {
            const next = !showIndicators;
            setShowIndicators(next);
            const c = chartRef.current as any;
            if (c) {
              const visible = next;
              c.ema20.applyOptions({ visible });
              c.ema50.applyOptions({ visible });
              c.ema200.applyOptions({ visible });
              c.rsiSeries.applyOptions({ visible });
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all border backdrop-blur-xl ${
            showIndicators
              ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
              : 'bg-white/90 dark:bg-[#16161a]/90 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e293b]/50 hover:text-blue-500 hover:border-blue-400'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Indicators
        </button>

        {/* Drawing Tools */}
        <div className="relative">
          <button
            onClick={() => setShowDrawingMenu(!showDrawingMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all border backdrop-blur-xl ${
              showDrawingMenu
                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20'
                : 'bg-white/90 dark:bg-[#16161a]/90 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e293b]/50 hover:text-purple-500 hover:border-purple-400'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
              <circle cx="11" cy="11" r="2"/>
            </svg>
            Draw
          </button>
          {showDrawingMenu && (
            <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-[#16161a] border border-slate-200 dark:border-[#1e293b] rounded-xl shadow-2xl p-2 space-y-0.5 z-30">
              {['Trend Line', 'Horizontal Line', 'Fib Retracement', 'Rectangle', 'Text Note'].map(tool => (
                <button
                  key={tool}
                  onClick={() => setShowDrawingMenu(false)}
                  className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {tool}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Indicators Legend (only when active) */}
      {showIndicators && (
        <div className="absolute top-14 right-5 z-10 flex gap-4 bg-white/80 dark:bg-[#16161a]/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1e293b]/40">
          {[
            { label: 'EMA 20', color: 'bg-amber-500' },
            { label: 'EMA 50', color: 'bg-blue-500' },
            { label: 'EMA 200', color: 'bg-purple-500' },
            { label: 'RSI 14', color: 'bg-pink-500' },
          ].map(ind => (
            <div key={ind.label} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${ind.color}`} />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{ind.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart canvas */}
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* Range Selector */}
      <div className="absolute bottom-3 right-5 z-20 flex items-center gap-0.5 bg-white/90 dark:bg-[#16161a]/90 backdrop-blur-xl p-1 rounded-lg border border-slate-200 dark:border-[#1e293b]/50 shadow-2xl">
        {['1H', '4H', '1D', '2D', '1W', '1M', 'ALL'].map((range) => (
          <button
            key={range}
            onClick={() => handleRangeChange(range)}
            className={`px-3 py-1.5 rounded-md text-[9px] font-black tracking-[0.1em] transition-all duration-200 ${
              selectedRange === range
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}
