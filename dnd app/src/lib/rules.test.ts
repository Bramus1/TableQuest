import { describe, it, expect } from "vitest";
import { hpPercent, nextTurn, ordered } from "./rules";
describe("combat helpers", () => {
  it("sorts descending initiative with explicit tie priority", () => {
    expect(
      ordered(
        [
          { id: "a", initiative: 12, turn_order: 1 },
          { id: "b", initiative: 18, turn_order: 2 },
          { id: "c", initiative: 18, turn_order: 0 },
        ],
        true,
      ).map((x) => x.id),
    ).toEqual(["c", "b", "a"]);
  });
  it("retains running order after combat starts", () => {
    expect(
      ordered(
        [
          { id: "a", initiative: 30, turn_order: 1 },
          { id: "b", initiative: 2, turn_order: 0 },
        ],
        false,
      ).map((x) => x.id),
    ).toEqual(["b", "a"]);
  });
  it("wraps and increments rounds", () => {
    expect(nextTurn(2, 2, 3, 1)).toEqual({ round: 3, turn: 0 });
    expect(nextTurn(2, 0, 3, -1)).toEqual({ round: 1, turn: 2 });
  });
  it("cannot rewind before round one", () =>
    expect(nextTurn(1, 0, 3, -1)).toEqual({ round: 1, turn: 0 }));
  it("rejects empty encounters", () =>
    expect(() => nextTurn(1, 0, 0, 1)).toThrow());
});
describe("HP display", () => {
  it("clamps percentage without changing game state", () => {
    expect(hpPercent(38, 45)).toBeCloseTo(84.44);
    expect(hpPercent(-1, 10)).toBe(0);
    expect(hpPercent(20, 10)).toBe(100);
    expect(hpPercent(2, 0)).toBe(0);
  });
});
