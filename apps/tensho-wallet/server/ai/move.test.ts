import { describe, expect, it } from "vitest";
import { describePercent, moveFacts } from "./move.ts";

const points = [100, 102, 104, 98, 99, 101].map((price, i) => ({ t: `2026-10-24T1${i}:00:00Z`, price: String(price) }));

describe("moveFacts", () => {
  it("finds the nearest point and measures the moves around it", () => {
    const f = moveFacts(points, "2026-10-24T13:10:00Z", 2)!;
    expect(f.at).toBe("2026-10-24T13:00:00Z");
    expect(f.price).toBe(98);
    expect(f.changeBefore).toBeCloseTo(98 / 102 - 1);
    expect(f.changeAfter).toBeCloseTo(101 / 98 - 1);
    expect(f.changeFromStart).toBeCloseTo(-0.02);
    expect([f.rangeLow, f.rangeHigh]).toEqual([98, 104]);
  });

  it("needs at least two prices", () => {
    expect(moveFacts(points.slice(0, 1), "2026-10-24T10:00:00Z")).toBeNull();
  });
});

describe("describePercent", () => {
  it("signs the change", () => {
    expect(describePercent(0.0123)).toBe("+1.23%");
    expect(describePercent(-0.05)).toBe("-5.00%");
    expect(describePercent(null)).toBe("unavailable");
  });
});
