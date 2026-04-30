'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, AreaSeries } from 'lightweight-charts';
import { useMarketStore } from '../store/marketStore';

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const orderbook = useMarketStore((state) => state.orderbook);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#71717a', // zinc-500
        fontFamily: 'var(--font-inter), sans-serif',
      },
      grid: {
        vertLines: { color: '#f4f4f5' }, // zinc-100
        horzLines: { color: '#f4f4f5' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#e4e4e7', // zinc-200
      },
      rightPriceScale: {
        borderColor: '#e4e4e7',
      },
      crosshair: {
        vertLine: {
          color: '#a1a1aa', // zinc-400
          width: 1,
          style: 3, // dashed
          labelBackgroundColor: '#18181b', // zinc-900
        },
        horzLine: {
          color: '#a1a1aa',
          width: 1,
          style: 3,
          labelBackgroundColor: '#18181b',
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#18181b', // zinc-900
      topColor: 'rgba(24, 24, 27, 0.1)',
      bottomColor: 'rgba(24, 24, 27, 0.0)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
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

  // Update chart data
  useEffect(() => {
    if (!seriesRef.current || !orderbook) return;

    const midPrice = (orderbook.best_bid + orderbook.best_ask) / 2;
    // timestamp from backend might be milliseconds, lightweight-charts expects seconds for timestamp
    // Assuming backend sends milliseconds (Unix timestamp) or seconds. 
    // Python time.time() is seconds. Let's check how the backend sends it. Wait, normally it's seconds in Python.
    // If it's a JS Date.now() it would be ms. Let's assume the backend sends a float seconds timestamp or int ms.
    // We'll normalize it to seconds (or use JS Date to get time).
    
    // To be safe and always have a strictly increasing timestamp for lightweight-charts, 
    // we can use Date.now() / 1000 or the provided timestamp if it's in ms/s.
    // Actually, lightweight-charts Time type requires it to be a valid business day or Unix timestamp in seconds.
    const time = Math.floor(Date.now() / 1000) as Time;

    seriesRef.current.update({
      time,
      value: midPrice,
    });
  }, [orderbook]);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          $ORIS <span className="text-zinc-400 font-normal">Synthex Index</span>
        </h2>
        {orderbook && (
          <div className="text-2xl font-mono mt-1 text-zinc-900 tracking-tight">
            ${((orderbook.best_bid + orderbook.best_ask) / 2).toFixed(2)}
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
