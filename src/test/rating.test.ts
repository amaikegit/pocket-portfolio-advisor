import { describe, it, expect } from "vitest";
import { computeRating, DEFAULT_RATING_SETTINGS } from "@/lib/rating";

const baseInput = {
  pvp: 0.9,
  monthlyProfitability: 0.85,
  priceVariation: -1,
  averagePrice: 20,
  difference: 200,
  totalInvested: 2000,
  portfolioProportion: 10,
  dividendMonthsLast12: 11,
};

describe("computeRating", () => {
  it("returns stars between 1 and 5", () => {
    const r = computeRating(baseInput);
    expect(r.stars).toBeGreaterThanOrEqual(1);
    expect(r.stars).toBeLessThanOrEqual(5);
  });

  it("gives a high score when all criteria are excellent", () => {
    const r = computeRating({
      ...baseInput,
      pvp: 0.6,
      monthlyProfitability: 1.5,
      priceVariation: -3,
      difference: 1500,
      portfolioProportion: 10,
      dividendMonthsLast12: 12,
    });
    expect(r.stars).toBe(5);
    expect(r.total).toBeGreaterThan(85);
  });

  it("gives a low score when all criteria are poor", () => {
    const r = computeRating({
      pvp: 1.5,
      monthlyProfitability: 0.1,
      priceVariation: 5,
      averagePrice: 20,
      difference: -800,
      totalInvested: 2000,
      portfolioProportion: 40,
      dividendMonthsLast12: 0,
    });
    expect(r.stars).toBeLessThanOrEqual(2);
  });

  it("treats P/VP=0 as neutral, not penalty", () => {
    const withData = computeRating({ ...baseInput, pvp: 0.7 });
    const withoutData = computeRating({ ...baseInput, pvp: 0 });
    const valWith = withData.items.find((i) => i.key === "valuation")!;
    const valWithout = withoutData.items.find((i) => i.key === "valuation")!;
    expect(valWithout.score).toBeGreaterThan(0);
    expect(valWithout.score).toBeLessThan(valWith.score);
  });

  it("ignores disabled criteria and renormalizes", () => {
    const r = computeRating(baseInput, {
      ...DEFAULT_RATING_SETTINGS,
      enabledCriteria: ["valuation", "dividendYield"],
    });
    const totalWeight = r.items.reduce((s, it) => s + it.weight, 0);
    expect(Math.round(totalWeight)).toBe(100);
    expect(r.items.find((i) => i.key === "concentration")!.enabled).toBe(false);
  });

  it("handles zero investment without crashing", () => {
    const r = computeRating({ ...baseInput, totalInvested: 0, difference: 0, averagePrice: 0 });
    expect(r.stars).toBeGreaterThanOrEqual(1);
  });
});