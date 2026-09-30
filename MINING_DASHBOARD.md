# Bitcoin mining desk dashboard

A lightweight, browser-based Bitcoin ASIC and cloud-mining contract profitability dashboard. It does not mine Bitcoin, sell hashpower, discover hardware, read miner telemetry, connect to a pool or cloud-mining provider, send payouts, or guarantee earnings.

## Run locally

Requires Node.js 18 or newer for the tests. No package installation is needed.

```sh
npm test
python -m http.server 4173
```

Open `http://localhost:4173`. Alternatively, serve the project root with any static HTTP server; ES modules and public-data requests may not work from a `file://` URL.

## What it does

- Loads BTC/USD spot price from Coinbase and current Bitcoin network hashrate/difficulty from Mempool.space, with visible errors if a public source is unavailable.
- Estimates a configured ASIC's daily pool payout from its hashrate, network hashrate, the current 3.125 BTC block subsidy, and the entered pool fee; estimates electricity cost and net operating margin from the entered power draw and tariff.
- Models an entered cloud-mining contract's estimated pool payout against its upfront price, daily hosting/maintenance charge, and contract term, including a full-term net and break-even BTC price.
- Offers a monthly mining-payout tracker: manually records a pool payout the user actually received, checks that a planned transfer does not exceed it, shows spot USD values and a selected manual transfer day (1–28), and keeps a local note when the user marks an external transfer complete.
- Prepares a basic ASIC pool settings snippet from a user-supplied Stratum endpoint and worker name. It rejects embedded credentials and unsafe/invalid input, recommends SSL where available, and never asks for or stores the pool password.
- Keeps ASIC, cloud-contract, and monthly tracker settings in this browser's local storage only. The illustrative defaults are not a provider quote, hardware reading, connected account, or actual payout.
- Provides a practical checklist for an authorized, real ASIC and pool setup.
- Explains one possible third-party Bitcoin-to-Cash-App route, subject to the mining service's withdrawal support and Cash App's current account eligibility; the dashboard cannot send or convert money.

The monthly feature is a manual tracker, not SSI, a public benefit, recurring BTC purchase, wallet, or transfer service. BTC amounts must be entered by the user from a real pool payout; the app does not access the miner or verify balances. The current month's payout amount, planned transfer, date, and completion note stay in this browser's local storage and do not trigger or verify a transaction. A pool payout is not guaranteed every month.

The mining estimates assume 144 blocks per day and apply today's network hashrate, BTC price, and pool fee across the entire contract term. They exclude changes in difficulty or price, transaction fees, downtime, payout thresholds, cooling, hardware purchase/depreciation, and other operating costs. Actual rewards are variable; profitability is not guaranteed. Cloud contracts are risky purchases, not dependable income. Do not borrow or spend money needed for essentials on a speculative contract.

## Privacy and safety

No wallet seed phrase, private key, Cash App login, pool password, worker credential, or account login is requested or stored. Pool settings are held in the current page only and are cleared on reload; configure them in the miner's own trusted local admin interface. Other scenario settings stay in browser local storage; public market and network requests go to Coinbase and Mempool.space. Never pay extra to “unlock” a payout, share a recovery phrase, or assume a Cash App $Cashtag is a Bitcoin deposit address. Confirm deposit eligibility and supported Bitcoin network in the official Cash App before sharing a receiving address with any third party.
