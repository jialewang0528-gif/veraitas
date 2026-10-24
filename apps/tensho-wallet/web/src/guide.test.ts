import { describe, expect, it } from "vitest";
import { aboutToken, guideNumbers } from "./guide.ts";
import { HOLD_MS, holdProgress } from "./hold.ts";

describe("guideNumbers", () => {
  it("computes the card from live quote and market numbers", () => {
    const n = guideNumbers({
      spend: 10,
      qtyOut: 0.1,
      marketPrice: 99,
      sellBack: 9.94,
      feeUsd: 0.02,
      low24h: 94,
      high24h: 103,
      hourPoints: [{ price: "100" }, { price: "99.2" }],
    });
    expect(n.hiddenCost).toBeCloseTo(0.1);
    expect(n.roundTripCost).toBeCloseTo(0.06);
    expect(n.range24h![0]).toBeCloseTo(9.4);
    expect(n.range24h![1]).toBeCloseTo(10.3);
    expect(n.pastHour).toBeCloseTo(-0.008);
  });

  it("leaves a row unavailable when its data is missing", () => {
    const n = guideNumbers({
      spend: 10,
      qtyOut: null,
      marketPrice: null,
      sellBack: null,
      feeUsd: null,
      low24h: null,
      high24h: null,
      hourPoints: [],
    });
    expect(n).toEqual({
      hiddenCost: null,
      sellBack: null,
      sellBackEstimated: false,
      roundTripCost: null,
      range24h: null,
      pastHour: null,
    });
  });

  it("mirrors the buy for the sell-back when there is no sell quote", () => {
    const n = guideNumbers({
      spend: 10,
      qtyOut: 0.1,
      marketPrice: 99.9,
      sellBack: null,
      feeUsd: 0.02,
      low24h: null,
      high24h: null,
      hourPoints: [],
    });
    // Worth $9.99 at the chart, minus the $0.01 spread and $0.02 fee.
    expect(n.sellBack).toBeCloseTo(9.96);
    expect(n.sellBackEstimated).toBe(true);
    expect(n.roundTripCost).toBeCloseTo(0.04);
  });
});

describe("aboutToken", () => {
  it("returns one line for known tokens and nothing otherwise", () => {
    expect(aboutToken("sol")).toBe("SOL: native coin of the Solana network.");
    expect(aboutToken("UNKNOWN")).toBeNull();
  });
});

describe("holdProgress", () => {
  it("runs from 0 to 1 over the hold and clamps", () => {
    expect(holdProgress(null, 500)).toBe(0);
    expect(holdProgress(1000, 1000 + HOLD_MS / 2)).toBeCloseTo(0.5);
    expect(holdProgress(1000, 1000 + HOLD_MS * 3)).toBe(1);
    expect(holdProgress(1000, 900)).toBe(0);
  });
});
