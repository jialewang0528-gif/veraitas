import { describe, expect, it } from "vitest";
import { targetPrice, targetReached } from "./exits.ts";

describe("auto-sell targets", () => {
  it("prices take-profits above and stop-losses below the fill", () => {
    expect(targetPrice("100", 10)).toBe("110");
    expect(targetPrice("100", -5)).toBe("95");
  });

  it("triggers a take-profit at or above its target and a stop-loss at or below it", () => {
    const takeProfit = { target_pct: 10 as const, target_price: "110" };
    const stopLoss = { target_pct: -5 as const, target_price: "95" };
    expect(targetReached(takeProfit, 109.99)).toBe(false);
    expect(targetReached(takeProfit, 110)).toBe(true);
    expect(targetReached(stopLoss, 95.01)).toBe(false);
    expect(targetReached(stopLoss, 95)).toBe(true);
    expect(targetReached(stopLoss, Number.NaN)).toBe(false);
  });
});
