'use client';

import { useState, useEffect, useRef } from 'react';
import { useMarketStore } from '../store/marketStore';
import { toast } from 'sonner';

interface Props { onSendOrder: (action: 'BUY' | 'SELL', qty: number) => void; }

const PRESETS = [10, 50, 100, 500];
const fmt2 = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Conditional order watcher ────────────────────────────────────── */
interface ConditionalOrder {
  id: number;
  action: 'BUY' | 'SELL';
  targetPrice: number;
  qty: number;
  condition: 'lte' | 'gte'; // BUY when price ≤ target, SELL when price ≥ target
  label: string;
}

let nextId = 1;

export default function ExecutionControls({ onSendOrder }: Props) {
  /* ── regular trade state ── */
  const [qty,        setQty]        = useState(10);
  const [limitPrice, setLimitPrice] = useState('');
  const [mode,       setMode]       = useState<'market' | 'limit-buy' | 'limit-sell'>('market');

  /* ── conditional order state ── */
  const [showConditional, setShowConditional] = useState(false);
  const [condPrice, setCondPrice] = useState('');
  const [condQty,   setCondQty]   = useState(10);
  const [condAction, setCondAction] = useState<'BUY' | 'SELL'>('BUY');
  const [conditionals, setConditionals] = useState<ConditionalOrder[]>([]);

  /* ── store ── */
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const portfolio        = useMarketStore((s) => s.portfolio);
  const orderbook        = useMarketStore((s) => s.orderbook);
  const selectedPrice    = useMarketStore((s) => s.selectedPrice);
  const selectedQty      = useMarketStore((s) => s.selectedQty);

  const isConnected = connectionStatus === 'connected';

  /* Auto-fill from order book click */
  useEffect(() => {
    if (selectedPrice !== null) {
      setLimitPrice(selectedPrice.toFixed(2));
      setMode('limit-buy');
    }
  }, [selectedPrice]);

  useEffect(() => {
    if (selectedQty !== null) setQty(selectedQty);
  }, [selectedQty]);

  /* ── Conditional order watcher ── */
  const condRef = useRef(conditionals);
  condRef.current = conditionals;

  useEffect(() => {
    if (!orderbook || condRef.current.length === 0) return;
    const mid = (orderbook.best_bid + orderbook.best_ask) / 2;
    const triggered: number[] = [];

    condRef.current.forEach((co) => {
      const hit = co.condition === 'lte' ? mid <= co.targetPrice : mid >= co.targetPrice;
      if (hit) {
        onSendOrder(co.action, co.qty);
        toast.success(
          `✅ Conditional ${co.action} triggered! ${co.qty} units @ market (target $${co.targetPrice.toFixed(2)})`,
          { duration: 5000 }
        );
        triggered.push(co.id);
      }
    });

    if (triggered.length > 0) {
      setConditionals((prev) => prev.filter((c) => !triggered.includes(c.id)));
    }
  }, [orderbook]);

  /* ── derived values ── */
  const parsedLimit  = parseFloat(limitPrice) || 0;
  const activePrice  = mode === 'market' ? (orderbook?.best_ask ?? 0) : parsedLimit;
  const totalAmount  = activePrice * qty;

  const badQty   = qty <= 0 || isNaN(qty) || qty > 100_000;
  const badPrice = mode !== 'market' && parsedLimit <= 0;
  const canBuy   = isConnected && !badQty && !badPrice && (!portfolio || portfolio.fiat  >= totalAmount);
  const canSell  = isConnected && !badQty && !badPrice && (!portfolio || portfolio.oris  >= qty);

  /* ── add conditional ── */
  const addConditional = () => {
    const p = parseFloat(condPrice);
    if (!p || p <= 0 || condQty <= 0) return;
    const condition: 'lte' | 'gte' = condAction === 'BUY' ? 'lte' : 'gte';
    const newOrder: ConditionalOrder = {
      id: nextId++,
      action: condAction,
      targetPrice: p,
      qty: condQty,
      condition,
      label: `${condAction} ${condQty} when price ${condition === 'lte' ? '≤' : '≥'} $${p.toFixed(2)}`,
    };
    setConditionals((prev) => [...prev, newOrder]);
    toast.info(`⏳ Conditional order set: ${newOrder.label}`);
    setCondPrice('');
  };

  const removeConditional = (id: number) =>
    setConditionals((prev) => prev.filter((c) => c.id !== id));

  const currentMid = orderbook
    ? (orderbook.best_bid + orderbook.best_ask) / 2
    : null;

  return (
    <div className="flex flex-col bg-[#111114] h-full">

      {/* ── Title ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#1e293b]/60">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Execute Trade</span>
        <div className="flex items-center gap-2">
          {currentMid && (
            <span className="text-[10px] font-mono text-slate-500">${currentMid.toFixed(2)}</span>
          )}
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
            isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto">

        {/* ── Mode tabs ── */}
        <div className="grid grid-cols-3 gap-1 bg-[#0d1117] rounded-lg p-0.5">
          {(['market', 'limit-buy', 'limit-sell'] as const).map((m) => (
            <button key={m} onClick={() => {
              setMode(m);
              if (m !== 'market' && !parsedLimit && orderbook) {
                setLimitPrice((m === 'limit-buy' ? orderbook.best_bid : orderbook.best_ask).toFixed(2));
              }
            }}
              className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                mode === m
                  ? m === 'limit-buy'
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                    : m === 'limit-sell'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                    : 'bg-slate-700/40 text-slate-300 border border-slate-600/20'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              {m === 'market' ? 'Market' : m === 'limit-buy' ? 'Lmt Buy' : 'Lmt Sell'}
            </button>
          ))}
        </div>

        {/* ── Quantity ── */}
        <div>
          <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Quantity</label>
          <div className="flex gap-1 mb-1.5">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setQty(p)}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                  qty === p
                    ? 'bg-[#1e293b] border-slate-600 text-slate-200'
                    : 'border-[#1e293b]/50 text-slate-600 hover:text-slate-400 hover:border-slate-600/40'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <input type="number" min="1" value={qty || ''}
            onChange={(e) => setQty(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-1.5 text-xs bg-[#0d1117] border border-[#1e293b]/60 rounded-lg
                       focus:ring-1 focus:ring-blue-500/40 outline-none font-mono text-slate-200 placeholder:text-slate-700"
            placeholder="Custom quantity…"
          />
        </div>

        {/* ── Limit price ── */}
        {mode !== 'market' && (
          <div>
            <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">
              {mode === 'limit-buy' ? 'Buy at Price ($)' : 'Sell at Price ($)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-mono text-xs">$</span>
              <input type="number" step="0.01" value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className={`w-full pl-7 pr-3 py-1.5 text-xs bg-[#0d1117] border rounded-lg
                            focus:ring-1 outline-none font-mono text-slate-200 transition-all ${
                              mode === 'limit-buy'
                                ? 'border-blue-500/25 focus:ring-blue-500/30'
                                : 'border-red-500/25 focus:ring-red-500/30'
                            }`}
                placeholder="0.00"
              />
            </div>
            {orderbook && (
              <div className="flex gap-1.5 mt-1.5">
                <button onClick={() => setLimitPrice(orderbook.best_bid.toFixed(2))}
                  className="flex-1 py-1 text-[9px] font-bold text-blue-400 border border-blue-500/15 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg transition-all">
                  BID {orderbook.best_bid.toFixed(2)}
                </button>
                <button onClick={() => setLimitPrice(orderbook.best_ask.toFixed(2))}
                  className="flex-1 py-1 text-[9px] font-bold text-red-400 border border-red-500/15 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition-all">
                  ASK {orderbook.best_ask.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Order summary ── */}
        <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#1e293b]/40 space-y-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-slate-600 font-bold uppercase">Price</span>
            <span className="font-mono text-slate-400">{mode === 'market' ? 'Market' : `$${parsedLimit.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-slate-600 font-bold uppercase">Units</span>
            <span className="font-mono text-slate-400">{qty.toLocaleString()}</span>
          </div>
          <div className="h-px bg-[#1e293b]/60 my-0.5" />
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500 font-bold uppercase">Est. Total</span>
            <span className="font-mono font-bold text-slate-200">${fmt2(totalAmount)}</span>
          </div>
        </div>

        {/* ── Buy / Sell buttons ── */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onSendOrder('BUY', qty)} disabled={!canBuy}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl
                       bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15
                       active:scale-95 transition-all disabled:opacity-25 disabled:cursor-not-allowed">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              {mode === 'limit-buy' ? 'Limit Buy' : 'Buy'}
            </span>
            <span className="text-[9px] font-mono text-emerald-500/60">${fmt2(totalAmount)}</span>
          </button>
          <button onClick={() => onSendOrder('SELL', qty)} disabled={!canSell}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl
                       bg-red-500/10 border border-red-500/20 hover:bg-red-500/15
                       active:scale-95 transition-all disabled:opacity-25 disabled:cursor-not-allowed">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
              {mode === 'limit-sell' ? 'Limit Sell' : 'Sell'}
            </span>
            <span className="text-[9px] font-mono text-red-500/60">${fmt2(totalAmount)}</span>
          </button>
        </div>

        {/* ── Conditional / Trigger Order ────────────────────────────── */}
        <div className="border border-[#1e293b]/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowConditional(!showConditional)}
            className="w-full flex items-center justify-between px-3 py-2 bg-[#0d1117] hover:bg-[#0f1923] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">⚡ Conditional Order</span>
              {conditionals.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-bold rounded-full">
                  {conditionals.length} active
                </span>
              )}
            </div>
            <span className="text-slate-600 text-[10px]">{showConditional ? '▲' : '▼'}</span>
          </button>

          {showConditional && (
            <div className="p-3 space-y-2.5 bg-[#0a0e14]">
              <p className="text-[9px] text-slate-500 leading-relaxed">
                Set a <strong className="text-slate-300">target price</strong>. The system will automatically
                place your order when the market price hits that level.
                <br />
                <em className="text-amber-400/80">Example: BUY 10 units when price drops to $10 (currently ${currentMid?.toFixed(2) ?? '…'}).</em>
              </p>

              {/* Action toggle */}
              <div className="grid grid-cols-2 gap-1 bg-[#0d1117] rounded-lg p-0.5">
                {(['BUY', 'SELL'] as const).map((a) => (
                  <button key={a} onClick={() => setCondAction(a)}
                    className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                      condAction === a
                        ? a === 'BUY'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/15 text-red-400 border border-red-500/20'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}>
                    {a === 'BUY' ? 'Buy when ≤' : 'Sell when ≥'}
                  </button>
                ))}
              </div>

              {/* Target price */}
              <div>
                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">
                  Target Price ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-mono text-xs">$</span>
                  <input type="number" step="0.01" value={condPrice}
                    onChange={(e) => setCondPrice(e.target.value)}
                    className={`w-full pl-7 pr-3 py-1.5 text-xs bg-[#0d1117] border rounded-lg
                                focus:ring-1 outline-none font-mono text-slate-200 ${
                                  condAction === 'BUY'
                                    ? 'border-emerald-500/25 focus:ring-emerald-500/30'
                                    : 'border-red-500/25 focus:ring-red-500/30'
                                }`}
                    placeholder={condAction === 'BUY' ? 'e.g. 10.00 (below market)' : 'e.g. 200.00 (above market)'}
                  />
                </div>
                {currentMid && condPrice && (
                  <p className="text-[9px] mt-1 text-slate-500">
                    {condAction === 'BUY'
                      ? parseFloat(condPrice) >= currentMid
                        ? <span className="text-amber-400">⚠ Target ≥ current price. Will trigger immediately.</span>
                        : <span className="text-emerald-400/70">Will trigger when price drops ${(currentMid - parseFloat(condPrice)).toFixed(2)} more.</span>
                      : parseFloat(condPrice) <= currentMid
                        ? <span className="text-amber-400">⚠ Target ≤ current price. Will trigger immediately.</span>
                        : <span className="text-emerald-400/70">Will trigger when price rises ${(parseFloat(condPrice) - currentMid).toFixed(2)} more.</span>
                    }
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Qty</label>
                <input type="number" min="1" value={condQty}
                  onChange={(e) => setCondQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs bg-[#0d1117] border border-[#1e293b]/60 rounded-lg
                             focus:ring-1 focus:ring-amber-500/30 outline-none font-mono text-slate-200"
                  placeholder="Units"
                />
              </div>

              <button
                onClick={addConditional}
                disabled={!condPrice || !condQty}
                className="w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider
                           bg-amber-500/10 border border-amber-500/20 text-amber-400
                           hover:bg-amber-500/15 active:scale-95 transition-all
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ⚡ Set Conditional Order
              </button>

              {/* Active conditionals list */}
              {conditionals.length > 0 && (
                <div className="space-y-1.5 mt-1">
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Active Watchers</p>
                  {conditionals.map((c) => (
                    <div key={c.id}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-[#0d1117] rounded-lg border border-amber-500/10">
                      <span className="text-[9px] font-mono text-slate-400">{c.label}</span>
                      <button onClick={() => removeConditional(c.id)}
                        className="ml-2 text-slate-700 hover:text-red-400 text-[10px] transition-colors" title="Cancel">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Portfolio footer ── */}
      <div className="shrink-0 border-t border-[#1e293b]/60 px-3 py-2 flex justify-between items-center">
        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Balance</span>
        <div className="text-right">
          <div className="text-[10px] font-mono text-slate-300 font-bold">
            ${portfolio?.fiat != null ? fmt2(portfolio.fiat) : '—'}
          </div>
          <div className="text-[8px] font-mono text-slate-600">
            {portfolio?.oris?.toLocaleString() ?? '0'} ORIS
          </div>
        </div>
      </div>
    </div>
  );
}
