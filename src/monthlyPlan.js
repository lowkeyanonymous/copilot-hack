export function monthKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required.");
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonthlyPlanDate(day, now = new Date()) {
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    throw new RangeError("The planned day must be a whole number from 1 to 28.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("A valid current date is required.");
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  if (thisMonth >= today) {
    return thisMonth;
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, day);
}

export function summarizeMonthlyPayout(payoutBtc, transferBtc, btcPriceUsd) {
  if (![payoutBtc, transferBtc, btcPriceUsd].every(Number.isFinite)) {
    throw new TypeError("The mining payout, planned transfer, and BTC spot price must be finite numbers.");
  }
  if (payoutBtc < 0 || transferBtc < 0 || btcPriceUsd <= 0) {
    throw new RangeError("BTC amounts cannot be negative and the BTC spot price must be positive.");
  }
  if (transferBtc > payoutBtc) {
    throw new RangeError("The planned transfer cannot exceed the mining payout entered for this month.");
  }
  if (![payoutBtc, transferBtc].every((amount) => {
    const satoshis = Math.round(amount * 1e8);
    return Number.isSafeInteger(satoshis)
      && Math.abs(amount * 1e8 - satoshis) <= Number.EPSILON * Math.max(1, satoshis) * 2;
  })) {
    throw new RangeError("BTC amounts must be entered in whole satoshis, up to eight decimal places.");
  }
  if (payoutBtc > 21_000_000 || transferBtc > 21_000_000) {
    throw new RangeError("BTC amounts cannot exceed Bitcoin's 21 million BTC supply limit.");
  }
  const payoutUsd = payoutBtc * btcPriceUsd;
  const transferUsd = transferBtc * btcPriceUsd;
  const remainingBtc = payoutBtc - transferBtc;
  if (![payoutUsd, transferUsd, remainingBtc].every(Number.isFinite)) {
    throw new RangeError("The monthly payout summary is outside the supported numeric range.");
  }
  return { payoutUsd, transferUsd, remainingBtc };
}
