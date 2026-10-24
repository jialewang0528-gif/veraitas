// Profit and loss from the user's own fills: average cost per coin, gains still open, and the P&L line over time.
import type { TransactionDetail } from "./types.ts";

export interface Fill {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  at: number;
  explorerUrl: string | null;
}

export interface Position {
  qty: number;
  // What the coins still held cost, at average cost.
  cost: number;
  realized: number;
}

export function fills(txs: TransactionDetail[] | undefined): Fill[] {
  return (txs ?? [])
    .filter(
      (t) =>
        t.type === "order" &&
        t.status === "completed" &&
        t.order !== undefined &&
        Number(t.order.executed_qty) > 0 &&
        Number(t.order.executed_vwap) > 0,
    )
    .map((t) => ({
      id: t.id,
      symbol: (t.asset_symbol ?? t.order!.asset_symbol ?? "").toUpperCase(),
      side: t.order!.side,
      qty: Number(t.order!.executed_qty),
      price: Number(t.order!.executed_vwap),
      at: Date.parse(t.created_at),
      explorerUrl: t.explorer_url,
    }))
    .sort((a, b) => a.at - b.at);
}

// Average-cost book as of `until`. A sale only counts against coins we saw bought; anything beyond has no known cost.
export function positions(list: Fill[], until = Infinity): Map<string, Position> {
  const book = new Map<string, Position>();
  for (const f of list) {
    if (f.at > until) break;
    const p = book.get(f.symbol) ?? { qty: 0, cost: 0, realized: 0 };
    if (f.side === "buy") {
      p.qty += f.qty;
      p.cost += f.qty * f.price;
    } else {
      const sold = Math.min(f.qty, p.qty);
      const avg = p.qty > 0 ? p.cost / p.qty : 0;
      p.realized += sold * (f.price - avg);
      p.cost -= sold * avg;
      p.qty -= sold;
    }
    book.set(f.symbol, p);
  }
  return book;
}

export interface HoldingPnl {
  avgCost: number | null;
  // Cost of the part of the holding we have a buy price for.
  cost: number;
  pnl: number | null;
  pct: number | null;
}

export function holdingPnl(position: Position | undefined, heldQty: number, price: number | null): HoldingPnl {
  if (!position || position.qty <= 0 || price === null) return { avgCost: null, cost: 0, pnl: null, pct: null };
  const avgCost = position.cost / position.qty;
  const known = Math.min(heldQty, position.qty);
  const cost = known * avgCost;
  const pnl = known * price - cost;
  return { avgCost, cost, pnl, pct: cost > 0 ? pnl / cost : null };
}

export interface Summary {
  // Everything ever spent buying coins.
  bought: number;
  open: number;
  realized: number;
  pnl: number;
  pct: number | null;
}

export function summarize(list: Fill[], prices: Record<string, number | null>, held: Record<string, number>): Summary {
  const book = positions(list);
  let open = 0;
  let realized = 0;
  for (const [symbol, p] of book) {
    realized += p.realized;
    open += holdingPnl(p, held[symbol] ?? 0, prices[symbol] ?? null).pnl ?? 0;
  }
  const bought = list.filter((f) => f.side === "buy").reduce((sum, f) => sum + f.qty * f.price, 0);
  const pnl = open + realized;
  return { bought, open, realized, pnl, pct: bought > 0 ? pnl / bought : null };
}

export interface PricePoint {
  t: number;
  price: number;
}

// The price in effect at t: the last point at or before it, else the first one.
function priceAt(series: PricePoint[], t: number): number | null {
  if (series.length === 0) return null;
  let lo = 0;
  let hi = series.length - 1;
  if (t < series[0]!.t) return series[0]!.price;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo]!.price;
}

// Dollars made or lost at each moment, from the first trade (or the range start) to now.
export function pnlSeries(list: Fill[], history: Record<string, PricePoint[]>, from: number, now: number): PricePoint[] {
  if (list.length === 0) return [];
  const start = Math.max(from, list[0]!.at);
  const times = new Set<number>([start, now]);
  for (const series of Object.values(history)) for (const p of series) if (p.t > start && p.t < now) times.add(p.t);
  for (const f of list) if (f.at > start && f.at < now) times.add(f.at);

  return [...times]
    .sort((a, b) => a - b)
    .map((t) => {
      let value = 0;
      for (const [symbol, p] of positions(list, t)) {
        value += p.realized;
        const price = priceAt(history[symbol] ?? [], t);
        if (price !== null && p.qty > 0) value += p.qty * price - p.cost;
      }
      return { t, price: value };
    });
}
