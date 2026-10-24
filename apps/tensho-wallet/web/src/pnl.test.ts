import { describe, expect, it } from "vitest";
import { fills, holdingPnl, pnlSeries, positions, summarize, type Fill } from "./pnl.ts";
import type { TransactionDetail } from "./types.ts";

const buy = (symbol: string, qty: number, price: number, at: number): Fill => ({
  id: `${symbol}-${at}`,
  symbol,
  side: "buy",
  qty,
  price,
  at,
  explorerUrl: null,
});
const sell = (symbol: string, qty: number, price: number, at: number): Fill => ({ ...buy(symbol, qty, price, at), side: "sell" });

describe("fills", () => {
  it("keeps completed orders, oldest first", () => {
    const tx = (id: string, status: TransactionDetail["status"], at: string): TransactionDetail => ({
      id,
      type: "order",
      asset_flow: "in",
      status,
      created_at: at,
      qty: "2",
      asset_symbol: "SOL",
      explorer_url: null,
      failure_reason: null,
      order: {
        order_id: id,
        base_asset: "x",
        side: "buy",
        qty: "200",
        executed_qty: "2",
        executed_vwap: "100",
        status: "complete",
        created_at: at,
      },
    });
    const list = fills([
      tx("b", "completed", "2026-10-24T21:00:00Z"),
      tx("a", "completed", "2026-10-24T20:00:00Z"),
      tx("c", "failed", "2026-10-24T22:00:00Z"),
    ]);
    expect(list.map((f) => f.id)).toEqual(["a", "b"]);
    expect(list[0]).toMatchObject({ symbol: "SOL", qty: 2, price: 100 });
  });
});

describe("positions", () => {
  it("averages buys and books gains on sells", () => {
    const p = positions([buy("SOL", 1, 100, 1), buy("SOL", 1, 120, 2), sell("SOL", 1, 130, 3)]).get("SOL")!;
    expect(p.qty).toBe(1);
    expect(p.cost).toBeCloseTo(110);
    expect(p.realized).toBeCloseTo(20);
  });

  it("stops at the given time", () => {
    expect(positions([buy("SOL", 1, 100, 1), buy("SOL", 1, 120, 5)], 3).get("SOL")!.qty).toBe(1);
  });
});

describe("holdingPnl", () => {
  it("compares today's price with what was paid", () => {
    const r = holdingPnl({ qty: 28.792351, cost: 48, realized: 0 }, 28.792351, 1.6637);
    expect(r.avgCost).toBeCloseTo(1.66711);
    expect(r.pnl).toBeCloseTo(28.792351 * 1.6637 - 48);
    expect(r.pct).toBeCloseTo(r.pnl! / 48);
  });

  it("has nothing to say without a buy or a price", () => {
    expect(holdingPnl(undefined, 1, 10).pnl).toBeNull();
    expect(holdingPnl({ qty: 1, cost: 10, realized: 0 }, 1, null).pnl).toBeNull();
  });
});

describe("summarize", () => {
  it("adds open and booked gains against everything bought", () => {
    const s = summarize([buy("SOL", 1, 100, 1), buy("TRUMP", 10, 5, 2), sell("SOL", 1, 110, 3)], { TRUMP: 4, SOL: 110 }, { TRUMP: 10 });
    expect(s.bought).toBe(150);
    expect(s.realized).toBeCloseTo(10);
    expect(s.open).toBeCloseTo(-10);
    expect(s.pnl).toBeCloseTo(0);
  });
});

describe("pnlSeries", () => {
  it("starts at the first trade and follows prices", () => {
    const series = pnlSeries(
      [buy("SOL", 2, 100, 10)],
      {
        SOL: [
          { t: 0, price: 90 },
          { t: 20, price: 105 },
          { t: 30, price: 95 },
        ],
      },
      0,
      40,
    );
    expect(series.map((p) => p.t)).toEqual([10, 20, 30, 40]);
    expect(series.map((p) => p.price)).toEqual([-20, 10, -10, -10]);
  });

  it("is empty before any trade", () => {
    expect(pnlSeries([], {}, 0, 10)).toEqual([]);
  });
});
