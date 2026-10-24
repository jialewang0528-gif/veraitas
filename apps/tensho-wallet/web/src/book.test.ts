import { describe, expect, it } from "vitest";
import { cumulative, summarize } from "./book.ts";

const bids = [
  { px: "100", sz: "2" },
  { px: "99", sz: "1" },
];
const asks = [
  { px: "100.5", sz: "1" },
  { px: "101", sz: "3" },
];

describe("summarize", () => {
  it("reads best prices, spread and which side has more money waiting", () => {
    const s = summarize(bids, asks)!;
    expect(s.bestBid).toBe(100);
    expect(s.bestAsk).toBe(100.5);
    expect(s.spread).toBeCloseTo(0.5);
    expect(s.spreadBps).toBeCloseTo((0.5 / 100.25) * 10_000);
    expect(s.bidDepthUsd).toBeCloseTo(299);
    expect(s.askDepthUsd).toBeCloseTo(403.5);
    expect(s.bidShare).toBeCloseTo(299 / 702.5);
  });

  it("needs both sides", () => {
    expect(summarize([], asks)).toBeNull();
  });
});

describe("cumulative", () => {
  it("adds sizes from the best price outward", () => {
    expect(cumulative(asks)).toEqual([1, 4]);
  });
});
