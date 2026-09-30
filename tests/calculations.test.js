import test from "node:test";
import assert from "node:assert/strict";
import { estimateCloudContract, estimateMining, networkHashrateFromDifficulty } from "../src/calculations.js";

const fixture = {
  hashrateTHs: 100,
  powerWatts: 3500,
  electricityPrice: 0.08,
  poolFeePercent: 2,
  networkHashrate: 600e18,
  btcPrice: 60_000,
};

test("estimates pool payout, electricity cost, net and break-even tariff", () => {
  const result = estimateMining(fixture);

  assert.ok(Math.abs(result.payoutBtcPerDay - 0.0000735) < 1e-12);
  assert.ok(Math.abs(result.payoutUsdPerDay - 4.41) < 1e-10);
  assert.equal(result.powerCostUsdPerDay, 6.72);
  assert.ok(Math.abs(result.netUsdPerDay - (-2.31)) < 1e-10);
  assert.ok(Math.abs(result.breakEvenElectricityPrice - 0.0525) < 1e-12);
});

test("a 100 percent pool fee leaves no payout", () => {
  const result = estimateMining({ ...fixture, poolFeePercent: 100 });
  assert.equal(result.payoutBtcPerDay, 0);
  assert.equal(result.payoutUsdPerDay, 0);
  assert.equal(result.breakEvenElectricityPrice, 0);
});

test("estimates cloud-contract fees, net and break-even spot price", () => {
  const result = estimateCloudContract({
    hashrateTHs: 10,
    upfrontCostUsd: 500,
    dailyFeeUsd: 3,
    termDays: 180,
    poolFeePercent: 2,
    networkHashrate: 600e18,
    btcPrice: 60_000,
  });

  assert.ok(Math.abs(result.payoutBtcPerDay - 0.00000735) < 1e-12);
  assert.ok(Math.abs(result.payoutUsdPerDay - 0.441) < 1e-10);
  assert.ok(Math.abs(result.upfrontCostPerDayUsd - 500 / 180) < 1e-12);
  assert.equal(result.dailyFeeUsd, 3);
  assert.ok(Math.abs(result.netUsdPerDay - (0.441 - 3 - 500 / 180)) < 1e-10);
  assert.ok(Math.abs(result.netUsdForTerm - (0.441 * 180 - 500 - 3 * 180)) < 1e-10);
  assert.ok(Math.abs(result.breakEvenBtcPrice - (1040 / (0.00000735 * 180))) < 1e-7);
  assert.ok(result.netUsdForTerm < 0);
});

test("a cloud contract with no rewards has no finite break-even BTC price", () => {
  const result = estimateCloudContract({
    hashrateTHs: 10,
    upfrontCostUsd: 0,
    dailyFeeUsd: 0,
    termDays: 30,
    poolFeePercent: 100,
    networkHashrate: 600e18,
    btcPrice: 60_000,
  });
  assert.equal(result.payoutBtcPerDay, 0);
  assert.equal(result.breakEvenBtcPrice, null);
});

test("rejects invalid cloud contract terms", () => {
  const terms = {
    hashrateTHs: 10,
    upfrontCostUsd: 500,
    dailyFeeUsd: 3,
    termDays: 180,
    poolFeePercent: 2,
    networkHashrate: 600e18,
    btcPrice: 60_000,
  };
  assert.throws(() => estimateCloudContract({ ...terms, termDays: 0 }), RangeError);
  assert.throws(() => estimateCloudContract({ ...terms, dailyFeeUsd: -1 }), RangeError);
  assert.throws(() => estimateCloudContract({ ...terms, upfrontCostUsd: Number.NaN }), TypeError);
});

test("rejects invalid estimates", () => {
  assert.throws(() => estimateMining({ ...fixture, hashrateTHs: 0 }), RangeError);
  assert.throws(() => estimateMining({ ...fixture, poolFeePercent: 101 }), RangeError);
  assert.throws(() => estimateMining({ ...fixture, btcPrice: Number.NaN }), TypeError);
  assert.throws(() => estimateMining({ ...fixture, hashrateTHs: Number.MAX_VALUE }), RangeError);
});

test("derives network hashrate from difficulty at a 600-second block interval", () => {
  assert.equal(networkHashrateFromDifficulty(1), (2 ** 32) / 600);
  assert.throws(() => networkHashrateFromDifficulty(0), RangeError);
});
