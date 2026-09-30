export const BLOCK_SUBSIDY_BTC = 3.125;
export const BLOCKS_PER_DAY = 144;
const HASHES_PER_TH = 1e12;

export function estimateMining({
  hashrateTHs,
  powerWatts,
  electricityPrice,
  poolFeePercent,
  networkHashrate,
  btcPrice,
}) {
  const values = [hashrateTHs, powerWatts, electricityPrice, poolFeePercent, networkHashrate, btcPrice];
  if (!values.every(Number.isFinite)) {
    throw new TypeError("Mining estimate inputs must be finite numbers.");
  }
  if (hashrateTHs <= 0 || powerWatts <= 0 || electricityPrice < 0 || networkHashrate <= 0 || btcPrice <= 0) {
    throw new RangeError("Hashrate, power, network hashrate, and BTC price must be positive; electricity cannot be negative.");
  }
  if (poolFeePercent < 0 || poolFeePercent > 100) {
    throw new RangeError("Pool fee must be between 0 and 100 percent.");
  }

  const shareOfNetwork = (hashrateTHs * HASHES_PER_TH) / networkHashrate;
  const grossBtcPerDay = shareOfNetwork * BLOCKS_PER_DAY * BLOCK_SUBSIDY_BTC;
  const payoutBtcPerDay = grossBtcPerDay * (1 - poolFeePercent / 100);
  const payoutUsdPerDay = payoutBtcPerDay * btcPrice;
  const powerCostUsdPerDay = (powerWatts / 1000) * 24 * electricityPrice;
  const results = [
    payoutBtcPerDay,
    payoutUsdPerDay,
    powerCostUsdPerDay,
    payoutUsdPerDay - powerCostUsdPerDay,
    payoutUsdPerDay / ((powerWatts / 1000) * 24),
  ];
  if (!results.every(Number.isFinite)) {
    throw new RangeError("Mining estimate is outside the supported numeric range.");
  }

  return {
    payoutBtcPerDay,
    payoutUsdPerDay,
    powerCostUsdPerDay,
    netUsdPerDay: results[3],
    breakEvenElectricityPrice: results[4],
  };
}

export function estimateCloudContract({
  hashrateTHs,
  upfrontCostUsd,
  dailyFeeUsd,
  termDays,
  poolFeePercent,
  networkHashrate,
  btcPrice,
}) {
  const values = [hashrateTHs, upfrontCostUsd, dailyFeeUsd, termDays, poolFeePercent, networkHashrate, btcPrice];
  if (!values.every(Number.isFinite)) {
    throw new TypeError("Cloud contract estimate inputs must be finite numbers.");
  }
  if (hashrateTHs <= 0 || upfrontCostUsd < 0 || dailyFeeUsd < 0 || termDays <= 0 || networkHashrate <= 0 || btcPrice <= 0) {
    throw new RangeError("Hashrate, term, network hashrate, and BTC price must be positive; contract cost and daily fee cannot be negative.");
  }
  if (poolFeePercent < 0 || poolFeePercent > 100) {
    throw new RangeError("Pool fee must be between 0 and 100 percent.");
  }

  const shareOfNetwork = (hashrateTHs * HASHES_PER_TH) / networkHashrate;
  const payoutBtcPerDay =
    shareOfNetwork * BLOCKS_PER_DAY * BLOCK_SUBSIDY_BTC * (1 - poolFeePercent / 100);
  const payoutUsdPerDay = payoutBtcPerDay * btcPrice;
  const totalCostsUsd = upfrontCostUsd + dailyFeeUsd * termDays;
  const netUsdPerDay = payoutUsdPerDay - dailyFeeUsd - upfrontCostUsd / termDays;
  const netUsdForTerm = payoutUsdPerDay * termDays - totalCostsUsd;
  const breakEvenBtcPrice = payoutBtcPerDay > 0 ? totalCostsUsd / (payoutBtcPerDay * termDays) : null;
  const results = [payoutBtcPerDay, payoutUsdPerDay, totalCostsUsd, netUsdPerDay, netUsdForTerm];
  if (!results.every(Number.isFinite) || (breakEvenBtcPrice !== null && !Number.isFinite(breakEvenBtcPrice))) {
    throw new RangeError("Cloud contract estimate is outside the supported numeric range.");
  }

  return {
    payoutBtcPerDay,
    payoutUsdPerDay,
    upfrontCostPerDayUsd: upfrontCostUsd / termDays,
    dailyFeeUsd,
    netUsdPerDay,
    netUsdForTerm,
    breakEvenBtcPrice,
  };
}

export function networkHashrateFromDifficulty(difficulty) {
  if (!Number.isFinite(difficulty) || difficulty <= 0) {
    throw new RangeError("Network difficulty must be a positive finite number.");
  }
  return (difficulty * 2 ** 32) / 600;
}
