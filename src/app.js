import { estimateCloudContract, estimateMining, networkHashrateFromDifficulty } from "./calculations.js";
import { monthKey, nextMonthlyPlanDate, summarizeMonthlyPayout } from "./monthlyPlan.js";
import { validatePoolConfiguration } from "./poolConfig.js";

const STORAGE_KEY = "hashrate-miner-settings-v1";
const CLOUD_STORAGE_KEY = "hashrate-cloud-settings-v1";
const MONTHLY_STORAGE_KEY = "hashrate-monthly-plan-v1";
const form = document.querySelector("#miner-form");
const cloudForm = document.querySelector("#cloud-form");
const monthlyForm = document.querySelector("#monthly-form");
const poolForm = document.querySelector("#pool-form");
const fields = Object.fromEntries([...form.elements].filter((element) => element.name).map((element) => [element.name, element]));
const cloudFields = Object.fromEntries([...cloudForm.elements].filter((element) => element.name).map((element) => [element.name, element]));
const monthlyFields = Object.fromEntries([...monthlyForm.elements].filter((element) => element.name).map((element) => [element.name, element]));
const poolFields = Object.fromEntries([...poolForm.elements].filter((element) => element.name).map((element) => [element.name, element]));

let market = { btcPrice: null, networkHashrate: null, difficulty: null };
let monthlyPlanState = { month: monthKey(new Date()), completed: false };
let poolSnippet = "";

const formatCurrency = (value, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value);
const formatHashrate = (value) => {
  const units = [["EH/s", 1e18], ["PH/s", 1e15], ["TH/s", 1e12]];
  const [unit, divisor] = units.find(([, threshold]) => value >= threshold) ?? ["H/s", 1];
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value / divisor)} ${unit}`;
};
const formatDifficulty = (value) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value / 1e12)} T`;

function loadSettings() {
  const message = document.querySelector("#form-message");
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    for (const [name, field] of Object.entries(fields)) {
      if (Number.isFinite(saved[name]) && saved[name] >= Number(field.min || 0) && saved[name] <= Number(field.max || Infinity)) {
        field.value = String(saved[name]);
      }
    }
  } catch {
    message.textContent = "Saved settings could not be read; using the example values for this session.";
    message.dataset.kind = "settings";
  }
}

function saveSettings() {
  const message = document.querySelector("#form-message");
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(
      Object.entries(fields).map(([name, field]) => [name, Number(field.value)]),
    )));
    message.textContent = "";
    delete message.dataset.kind;
  } catch {
    message.textContent = "Browser storage is unavailable; settings will last for this session only.";
    message.dataset.kind = "storage";
  }
}

function loadCloudSettings() {
  const message = document.querySelector("#cloud-form-message");
  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_STORAGE_KEY) ?? "{}");
    for (const [name, field] of Object.entries(cloudFields)) {
      if (Number.isFinite(saved[name]) && saved[name] >= Number(field.min || 0) && saved[name] <= Number(field.max || Infinity)) {
        field.value = String(saved[name]);
      }
    }
  } catch {
    message.textContent = "Saved contract inputs could not be read; using illustrative values for this session.";
    message.dataset.kind = "settings";
  }
}

function saveCloudSettings() {
  const message = document.querySelector("#cloud-form-message");
  try {
    localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(Object.fromEntries(
      Object.entries(cloudFields).map(([name, field]) => [name, Number(field.value)]),
    )));
    message.textContent = "";
    delete message.dataset.kind;
  } catch {
    message.textContent = "Browser storage is unavailable; contract inputs will last for this session only.";
    message.dataset.kind = "storage";
  }
}

function loadMonthlyPlan() {
  const message = document.querySelector("#monthly-form-message");
  try {
    const saved = JSON.parse(localStorage.getItem(MONTHLY_STORAGE_KEY) ?? "{}");
    const thisMonth = monthKey(new Date());
    if (saved.month === thisMonth) {
      if (Number.isFinite(saved.payoutBtc) && saved.payoutBtc >= 0 && saved.payoutBtc <= 21_000_000) {
        monthlyFields.payoutBtc.value = String(saved.payoutBtc);
      }
      if (Number.isFinite(saved.transferBtc) && saved.transferBtc >= 0 && saved.transferBtc <= saved.payoutBtc) {
        monthlyFields.transferBtc.value = String(saved.transferBtc);
      }
      if (Number.isInteger(saved.contributionDay) && saved.contributionDay >= 1 && saved.contributionDay <= 28) {
        monthlyFields.contributionDay.value = String(saved.contributionDay);
      }
      monthlyPlanState = { ...monthlyPlanState, month: thisMonth, completed: saved.completed === true };
    }
  } catch {
    message.textContent = "Saved monthly plan could not be read; using $0 and the first day for this session.";
    message.dataset.kind = "settings";
  }
}

function saveMonthlyPlan() {
  const message = document.querySelector("#monthly-form-message");
  try {
    localStorage.setItem(MONTHLY_STORAGE_KEY, JSON.stringify({
      month: monthKey(new Date()),
      payoutBtc: Number(monthlyFields.payoutBtc.value),
      transferBtc: Number(monthlyFields.transferBtc.value),
      contributionDay: Number(monthlyFields.contributionDay.value),
      completed: monthlyPlanState.completed,
    }));
    message.textContent = "";
    delete message.dataset.kind;
  } catch {
    message.textContent = "Browser storage is unavailable; the monthly plan note will last for this session only.";
    message.dataset.kind = "storage";
  }
}

function renderMonthlyPlan() {
  const message = document.querySelector("#monthly-form-message");
  if (!monthlyForm.checkValidity()) {
    message.textContent = "Enter BTC amounts from 0 to 21,000,000 and a whole planned day from 1 to 28.";
    document.querySelector("#monthly-btc-amount").innerHTML = "— <span>BTC / month</span>";
    document.querySelector("#monthly-usd-amount").textContent = "— estimated value at spot";
    document.querySelector("#monthly-transfer-btc").textContent = "—";
    document.querySelector("#monthly-transfer-usd").textContent = "—";
    document.querySelector("#monthly-next-date").textContent = "—";
    document.querySelector("#monthly-plan-status").textContent = "Valid plan inputs are required.";
    document.querySelector("#monthly-complete-button").disabled = true;
    return;
  }

  const day = Number(monthlyFields.contributionDay.value);
  const payoutBtc = Number(monthlyFields.payoutBtc.value);
  const transferBtc = Number(monthlyFields.transferBtc.value);
  if (transferBtc > payoutBtc) {
    message.textContent = "The BTC you plan to send cannot be greater than the mining payout you entered.";
    document.querySelector("#monthly-btc-amount").innerHTML = "— <span>BTC received</span>";
    document.querySelector("#monthly-usd-amount").textContent = "— estimated value at spot";
    document.querySelector("#monthly-transfer-btc").textContent = "—";
    document.querySelector("#monthly-transfer-usd").textContent = "—";
    document.querySelector("#monthly-plan-status").textContent = "Lower the planned transfer or enter the actual BTC payout received.";
    document.querySelector("#monthly-complete-button").disabled = true;
    return;
  }
  const now = new Date();
  const key = monthKey(now);
  if (monthlyPlanState.month !== key) {
    monthlyPlanState = { ...monthlyPlanState, month: key, completed: false };
  }
  const isCompleted = monthlyPlanState.completed;
  const dateReference = isCompleted ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  const scheduledDate = nextMonthlyPlanDate(day, dateReference);

  document.querySelector("#monthly-next-date").textContent = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(scheduledDate);
  document.querySelector("#monthly-completion").textContent = isCompleted
    ? "Marked complete on this device"
    : "Not marked complete";
  const completeButton = document.querySelector("#monthly-complete-button");
  completeButton.disabled = transferBtc === 0;
  completeButton.textContent = isCompleted ? "Undo this month's note" : "Mark this month's transfer completed elsewhere";

  if (market.btcPrice) {
    try {
      const summary = summarizeMonthlyPayout(payoutBtc, transferBtc, market.btcPrice);
      document.querySelector("#monthly-btc-amount").innerHTML = `${payoutBtc.toFixed(8)} <span>BTC received</span>`;
      document.querySelector("#monthly-usd-amount").textContent = `${formatCurrency(summary.payoutUsd)} estimated value at spot`;
      document.querySelector("#monthly-transfer-btc").textContent = `${transferBtc.toFixed(8)} BTC`;
      document.querySelector("#monthly-transfer-usd").textContent = `${formatCurrency(summary.transferUsd)} at spot`;
      document.querySelector("#monthly-plan-status").textContent = `About ${summary.remainingBtc.toFixed(8)} BTC remains after the planned transfer. Enter the real pool payout yourself; no miner or pool is connected.`;
    } catch (error) {
      message.textContent = error.message;
      document.querySelector("#monthly-btc-amount").innerHTML = "— <span>BTC received</span>";
      document.querySelector("#monthly-usd-amount").textContent = "— estimated value at spot";
      document.querySelector("#monthly-transfer-btc").textContent = "—";
      document.querySelector("#monthly-transfer-usd").textContent = "—";
      document.querySelector("#monthly-plan-status").textContent = "The transfer amount must not exceed this month's entered mining payout.";
      completeButton.disabled = true;
    }
  } else {
    document.querySelector("#monthly-btc-amount").innerHTML = `${payoutBtc.toFixed(8)} <span>BTC received</span>`;
    document.querySelector("#monthly-usd-amount").textContent = "— BTC/USD price unavailable";
    document.querySelector("#monthly-transfer-btc").textContent = `${transferBtc.toFixed(8)} BTC`;
    document.querySelector("#monthly-transfer-usd").textContent = "—";
    document.querySelector("#monthly-plan-status").textContent = "USD values need live BTC spot price. This is only a manual note; no transaction is scheduled.";
  }
  if (!message.dataset.kind) message.textContent = "";
}

function preparePoolConfiguration(event) {
  event.preventDefault();
  const message = document.querySelector("#pool-form-message");
  const output = document.querySelector("#pool-config-output");
  const copyButton = document.querySelector("#pool-copy-button");
  try {
    const config = validatePoolConfiguration({
      endpoint: poolFields.poolEndpoint.value,
      worker: poolFields.poolWorker.value,
    });
    poolSnippet = `Pool URL: ${config.endpoint}\nWorker: ${config.worker}\nPassword: set directly on the ASIC`;
    output.textContent = poolSnippet;
    output.hidden = false;
    copyButton.disabled = false;
    message.textContent = config.encrypted
      ? "Settings prepared. SSL encryption is selected; confirm the pool and ASIC support this endpoint."
      : "Settings prepared, but this endpoint uses unencrypted Stratum TCP. Prefer the pool's SSL endpoint if available.";
    message.dataset.kind = config.encrypted ? "success" : "warning";
  } catch (error) {
    poolSnippet = "";
    output.textContent = "";
    output.hidden = true;
    copyButton.disabled = true;
    message.textContent = error.message;
    message.dataset.kind = "error";
  }
}

async function copyPoolConfiguration() {
  const message = document.querySelector("#pool-form-message");
  if (!poolSnippet) return;
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard access is unavailable. Select and copy the settings shown below.");
    }
    await navigator.clipboard.writeText(poolSnippet);
    message.textContent = "Settings copied. Enter them only in your ASIC's trusted local admin interface.";
    message.dataset.kind = "success";
  } catch (error) {
    message.textContent = error.message;
    message.dataset.kind = "error";
  }
}

function clearCloudEstimate(status) {
  document.querySelector("#cloud-daily-payout").innerHTML = "— <span>BTC / day</span>";
  document.querySelector("#cloud-daily-usd").textContent = "— estimated pool payout / day at spot";
  document.querySelector("#cloud-amortized-cost").textContent = "—";
  document.querySelector("#cloud-daily-fees").textContent = "—";
  for (const selector of ["#cloud-net-daily", "#cloud-net-term"]) {
    const result = document.querySelector(selector);
    result.textContent = "—";
    result.classList.remove("negative");
  }
  document.querySelector("#cloud-break-even").textContent = "—";
  document.querySelector("#cloud-estimate-status").textContent = status;
}

function renderCloudEstimate() {
  const message = document.querySelector("#cloud-form-message");
  if (!cloudForm.checkValidity()) {
    message.textContent = "Check the hashrate, contract cost, daily fees, contract term, and pool fee.";
    clearCloudEstimate("Valid contract inputs are required.");
    return;
  }
  if (!market.networkHashrate || !market.btcPrice) {
    clearCloudEstimate("Live network and BTC market data are needed to calculate this estimate.");
    return;
  }

  try {
    const inputNames = {
      cloudHashrateTHs: "hashrateTHs",
      cloudUpfrontCost: "upfrontCostUsd",
      cloudDailyFee: "dailyFeeUsd",
      cloudTermDays: "termDays",
      cloudPoolFeePercent: "poolFeePercent",
    };
    const estimate = estimateCloudContract({
      ...Object.fromEntries(Object.entries(cloudFields).map(([name, field]) => [inputNames[name], Number(field.value)])),
      networkHashrate: market.networkHashrate,
      btcPrice: market.btcPrice,
    });
    document.querySelector("#cloud-daily-payout").innerHTML = `${estimate.payoutBtcPerDay.toFixed(8)} <span>BTC / day</span>`;
    document.querySelector("#cloud-daily-usd").textContent = `${formatCurrency(estimate.payoutUsdPerDay)} estimated pool payout / day at spot`;
    document.querySelector("#cloud-amortized-cost").textContent = `${formatCurrency(estimate.upfrontCostPerDayUsd)} / day`;
    document.querySelector("#cloud-daily-fees").textContent = `${formatCurrency(estimate.dailyFeeUsd)} / day`;
    for (const [selector, value] of [
      ["#cloud-net-daily", estimate.netUsdPerDay],
      ["#cloud-net-term", estimate.netUsdForTerm],
    ]) {
      const result = document.querySelector(selector);
      result.textContent = `${formatCurrency(value)}${selector === "#cloud-net-daily" ? " / day" : ""}`;
      result.classList.toggle("negative", value < 0);
    }
    document.querySelector("#cloud-break-even").textContent = estimate.breakEvenBtcPrice === null
      ? "No finite price"
      : `${formatCurrency(estimate.breakEvenBtcPrice, 0)} / BTC`;
    document.querySelector("#cloud-estimate-status").textContent = "Scenario only, not a provider quote or payout. Future network difficulty, BTC price, pool performance, and contract delivery can differ.";
    if (!message.dataset.kind) message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
    clearCloudEstimate("The contract scenario could not be calculated.");
  }
}

function clearEstimate(status) {
  document.querySelector("#daily-payout").innerHTML = "— <span>BTC / day</span>";
  document.querySelector("#daily-payout-usd").textContent = "— USD / day at spot";
  document.querySelector("#daily-power-cost").textContent = "—";
  const net = document.querySelector("#daily-net");
  net.textContent = "—";
  net.classList.remove("negative");
  document.querySelector("#break-even-rate").textContent = "—";
  document.querySelector("#estimate-status").textContent = status;
}

function renderEstimate() {
  const message = document.querySelector("#form-message");
  if (!form.checkValidity()) {
    message.textContent = "Check the configured hashrate, power draw, electricity price, and pool fee.";
    clearEstimate("Valid configuration inputs are required.");
    return;
  }
  if (!market.networkHashrate || !market.btcPrice) {
    clearEstimate("Live network and BTC market data are needed to calculate this estimate.");
    return;
  }

  try {
    const estimate = estimateMining({
      ...Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, Number(field.value)])),
      networkHashrate: market.networkHashrate,
      btcPrice: market.btcPrice,
    });
    document.querySelector("#daily-payout").innerHTML = `${estimate.payoutBtcPerDay.toFixed(8)} <span>BTC / day</span>`;
    document.querySelector("#daily-payout-usd").textContent = `${formatCurrency(estimate.payoutUsdPerDay)} USD / day at spot`;
    document.querySelector("#daily-power-cost").textContent = `${formatCurrency(estimate.powerCostUsdPerDay)} / day`;
    const net = document.querySelector("#daily-net");
    net.textContent = `${formatCurrency(estimate.netUsdPerDay)} / day`;
    net.classList.toggle("negative", estimate.netUsdPerDay < 0);
    document.querySelector("#break-even-rate").textContent = `${formatCurrency(estimate.breakEvenElectricityPrice, 4)} / kWh`;
    document.querySelector("#estimate-status").textContent = "Modelled from your inputs and latest available public data. This is not a miner or pool reading.";
    if (!message.dataset.kind) message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

async function loadMarketData() {
  const updated = document.querySelector("#data-updated");
  const button = document.querySelector("#refresh-button");
  button.disabled = true;
  updated.textContent = "Refreshing public data…";

  const [priceResult, networkResult] = await Promise.allSettled([
    fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot").then(async (response) => {
      if (!response.ok) throw new Error(`Market data request failed (${response.status}).`);
      const body = await response.json();
      const price = Number(body.data?.amount);
      if (!Number.isFinite(price) || price <= 0) throw new Error("Market data response was invalid.");
      return price;
    }),
    fetch("https://mempool.space/api/v1/mining/hashrate/3d").then(async (response) => {
      if (!response.ok) throw new Error(`Network data request failed (${response.status}).`);
      const body = await response.json();
      const difficulty = Number(body.currentDifficulty);
      const hashrate = Number(body.currentHashrate);
      if ((!Number.isFinite(hashrate) || hashrate <= 0) && (!Number.isFinite(difficulty) || difficulty <= 0)) {
        throw new Error("Network data response did not contain a valid hashrate or difficulty.");
      }
      return { difficulty, hashrate: Number.isFinite(hashrate) && hashrate > 0 ? hashrate : networkHashrateFromDifficulty(difficulty) };
    }),
  ]);

  if (priceResult.status === "fulfilled") {
    market.btcPrice = priceResult.value;
    document.querySelector("#btc-price").textContent = formatCurrency(market.btcPrice, 0);
    document.querySelector("#btc-price-status").textContent = "Coinbase spot · USD";
  } else {
    market.btcPrice = null;
    document.querySelector("#btc-price").textContent = "Unavailable";
    document.querySelector("#btc-price-status").textContent = "Coinbase market data could not be loaded";
    console.error(priceResult.reason);
  }
  if (networkResult.status === "fulfilled") {
    market.networkHashrate = networkResult.value.hashrate;
    market.difficulty = Number.isFinite(networkResult.value.difficulty) ? networkResult.value.difficulty : null;
    document.querySelector("#network-hashrate").textContent = formatHashrate(market.networkHashrate);
    document.querySelector("#network-hashrate-status").textContent = "Mempool.space · estimated network total";
    document.querySelector("#network-difficulty").textContent = market.difficulty
      ? formatDifficulty(market.difficulty)
      : "Unavailable";
    document.querySelector("#network-difficulty-status").textContent = market.difficulty
      ? "Current Bitcoin mining difficulty"
      : "Current difficulty unavailable";
  } else {
    market.networkHashrate = null;
    market.difficulty = null;
    document.querySelector("#network-hashrate").textContent = "Unavailable";
    document.querySelector("#network-hashrate-status").textContent = "Mempool.space network data could not be loaded";
    document.querySelector("#network-difficulty").textContent = "Unavailable";
    document.querySelector("#network-difficulty-status").textContent = "Mempool.space network data could not be loaded";
    console.error(networkResult.reason);
  }

  const failures = [priceResult, networkResult].filter((result) => result.status === "rejected").length;
  updated.textContent = failures === 0 ? `Updated ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())}` : `${failures} public data source${failures > 1 ? "s" : ""} unavailable`;
  const dataStatus = failures
    ? "One or more public data sources are unavailable; the estimate updates when all required data loads."
    : "Using live public data. This is not a miner or pool reading.";
  document.querySelector("#estimate-status").textContent = dataStatus;
  button.disabled = false;
  renderEstimate();
  renderCloudEstimate();
  renderMonthlyPlan();
}

loadSettings();
loadCloudSettings();
loadMonthlyPlan();
form.addEventListener("submit", (event) => event.preventDefault());
cloudForm.addEventListener("submit", (event) => event.preventDefault());
monthlyForm.addEventListener("submit", (event) => event.preventDefault());
poolForm.addEventListener("submit", preparePoolConfiguration);
poolForm.addEventListener("input", () => {
  poolSnippet = "";
  document.querySelector("#pool-config-output").hidden = true;
  document.querySelector("#pool-copy-button").disabled = true;
  document.querySelector("#pool-form-message").textContent = "";
});
form.addEventListener("input", () => {
  saveSettings();
  renderEstimate();
});
cloudForm.addEventListener("input", () => {
  saveCloudSettings();
  renderCloudEstimate();
});
monthlyForm.addEventListener("input", () => {
  monthlyPlanState.completed = false;
  if (monthlyForm.checkValidity() && Number(monthlyFields.transferBtc.value) <= Number(monthlyFields.payoutBtc.value)) {
    saveMonthlyPlan();
  }
  renderMonthlyPlan();
});
document.querySelector("#monthly-complete-button").addEventListener("click", () => {
  monthlyPlanState.completed = !monthlyPlanState.completed;
  saveMonthlyPlan();
  renderMonthlyPlan();
});
document.querySelector("#pool-copy-button").addEventListener("click", copyPoolConfiguration);
document.querySelector("#refresh-button").addEventListener("click", loadMarketData);
function updateActiveNavigation() {
  const activeHash = window.location.hash || "#dashboard";
  for (const link of document.querySelectorAll(".nav-link")) {
    if (link.getAttribute("href") === activeHash) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
    }
  }
}
window.addEventListener("hashchange", updateActiveNavigation);
updateActiveNavigation();
renderEstimate();
renderCloudEstimate();
renderMonthlyPlan();
loadMarketData();
