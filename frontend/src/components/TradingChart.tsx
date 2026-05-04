'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
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
      upColor:            '#22c55e',
      downColor:          '#ef4444',
      borderUpColor:      '#16a34a',
      borderDownColor:    '#dc2626',
      wickUpColor:        '#22c55e',
      wickDownColor:      '#ef4444',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

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

  /* ── When selectedSymbol changes, wipe chart and load symbol's history ── */
  useEffect(() => {
    if (!seriesRef.current) return;
    if (prevSymbolRef.current === selectedSymbol) return;

    // Save the current candle to the old symbol's history
    if (prevSymbolRef.current && candleRef.current) {
      const oldHistory = historyMapRef.current[prevSymbolRef.current] || [];
      historyMapRef.current[prevSymbolRef.current] = [...oldHistory, { ...candleRef.current }].slice(-300);
    }
    candleRef.current = null;

    // Load new symbol's history
    const newHistory = historyMapRef.current[selectedSymbol] || [];
    seriesRef.current.setData(newHistory.map((c) => ({ ...c, time: c.time as Time })));

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
    // Only process ticks for the currently selected symbol
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
        historyMapRef.current[selectedSymbol] = [...history, closed].slice(-300);
        setPrevClose(closed.close);
        setPriceChange(closed.close - closed.open);
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
  const priceColor = isUp ? '#22c55e' : '#ef4444';

  return (
    <div className="w-full h-full relative bg-white dark:bg-[#0d1117]">
      {/* Price overlay */}
      <div className="absolute top-4 left-5 z-10 pointer-events-none select-none">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
              ${selectedSymbol}
            </p>
            {currentPrice !== null && (
              <div className="flex items-baseline gap-3">
                <span
                  className="text-2xl font-mono font-bold tracking-tighter transition-colors duration-300"
                  style={{ color: priceColor }}
                >
                  ${currentPrice.toFixed(2)}
                </span>
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: priceColor }}
                >
                  {priceChange >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(priceChange).toFixed(2)}
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold animate-pulse">
                  LIVE
                </span>
              </div>
            )}
            {istTime && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums tracking-wider">
                  {istTime}
                </span>
                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">IST</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-600">{istDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-3 left-5 z-10 flex items-center gap-3 pointer-events-none">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e] inline-block" />
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase">Bull</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444] inline-block" />
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase">Bear</span>
        </div>
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-700">{CANDLE_INTERVAL_S}s · IST</span>
      </div>

      {/* Range Selector */}
      <div className="absolute bottom-3 right-5 z-20 flex items-center gap-0.5 bg-white/90 dark:bg-[#16161a]/90 backdrop-blur-xl p-0.5 rounded border border-slate-200 dark:border-[#1e293b]/50">
        {['1H', '4H', '1D', '2D', '1W', '1M', 'ALL'].map((range) => (
          <button
            key={range}
            onClick={() => handleRangeChange(range)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-wider transition-all duration-200 ${
              selectedRange === range
                ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-600 dark:hover:text-slate-400 border border-transparent'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}
