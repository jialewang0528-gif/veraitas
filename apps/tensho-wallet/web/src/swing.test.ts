import { describe, expect, it } from "vitest";
import { dailyMoves, median, swingSummary } from "./swing.ts";

const points = [
  { t: "2026-10-01T00:00:00Z", price: "90" },
  { t: "2026-10-01T20:00:00Z", price: "100" },
  { t: "2026-10-02T20:00:00Z", price: "110" },
  { t: "2026-10-03T20:00:00Z", price: "99" },
  { t: "2026-10-04T20:00:00Z", price: "99" },
];

describe("swing check", () => {
  it("uses the last sample of each day as its close", () => {
    const moves = dailyMoves(points);
    expect(moves.map((m) => m.day)).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(moves[0]!.change).toBeCloseTo(0.1);
    expect(moves[1]!.change).toBeCloseTo(-0.1);
    expect(moves[2]!.change).toBeCloseTo(0);
  });

  it("takes the median of an even or odd list", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("puts the typical move and the worst day in dollars", () => {
    const summary = swingSummary(points, 20)!;
    expect(summary.typicalUsd).toBeCloseTo(2);
    expect(summary.worstDay).toBe("2026-10-03");
    expect(summary.worstValueUsd).toBeCloseTo(18);
  });

  it("needs at least two days of moves", () => {
    expect(swingSummary(points.slice(0, 2), 20)).toBeNull();
  });
});
