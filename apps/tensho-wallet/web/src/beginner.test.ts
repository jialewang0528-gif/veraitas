import { describe, expect, it } from "vitest";
import { readBeginnerMode } from "./beginner.tsx";

describe("readBeginnerMode", () => {
  it("is on unless the stored value says off", () => {
    expect(readBeginnerMode({ getItem: () => null })).toBe(true);
    expect(readBeginnerMode({ getItem: () => "on" })).toBe(true);
    expect(readBeginnerMode({ getItem: () => "off" })).toBe(false);
  });

  it("falls back to on when storage is missing or throws", () => {
    expect(readBeginnerMode(undefined)).toBe(true);
    expect(
      readBeginnerMode({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(true);
  });
});
