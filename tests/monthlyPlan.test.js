import test from "node:test";
import assert from "node:assert/strict";
import { monthKey, nextMonthlyPlanDate, summarizeMonthlyPayout } from "../src/monthlyPlan.js";

test("summarizes a real monthly pool payout and planned manual transfer", () => {
  assert.deepEqual(summarizeMonthlyPayout(0.001, 0.0004, 50_000), {
    payoutUsd: 50,
    transferUsd: 20,
    remainingBtc: 0.0006,
  });
});

test("a zero payout can only plan a zero transfer", () => {
  assert.deepEqual(summarizeMonthlyPayout(0, 0, 50_000), {
    payoutUsd: 0,
    transferUsd: 0,
    remainingBtc: 0,
  });
});

test("rejects negative, excessive, fractional-satoshi, or unfunded transfers", () => {
  assert.throws(() => summarizeMonthlyPayout(-1, 0, 50_000), RangeError);
  assert.throws(() => summarizeMonthlyPayout(0.001, 0.00100001, 50_000), RangeError);
  assert.throws(() => summarizeMonthlyPayout(0.000000001, 0, 50_000), RangeError);
  assert.throws(() => summarizeMonthlyPayout(0, 0, 0), RangeError);
  assert.throws(() => summarizeMonthlyPayout(Number.NaN, 0, 50_000), TypeError);
});

test("plans for the selected day this month when it has not passed yet", () => {
  const now = new Date(2026, 8, 10, 18, 30);
  const result = nextMonthlyPlanDate(15, now);
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 8);
  assert.equal(result.getDate(), 15);
});

test("rolls a passed planned day into the following month", () => {
  const result = nextMonthlyPlanDate(5, new Date(2026, 8, 10, 8));
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 9);
  assert.equal(result.getDate(), 5);
});

test("uses day 28 for every month and builds local month keys", () => {
  const result = nextMonthlyPlanDate(28, new Date(2026, 1, 28, 12));
  assert.equal(result.getMonth(), 2);
  assert.equal(result.getDate(), 28);
  assert.equal(monthKey(new Date(2026, 0, 1)), "2026-01");
  assert.throws(() => nextMonthlyPlanDate(29), RangeError);
});
