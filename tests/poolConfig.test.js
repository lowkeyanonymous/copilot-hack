import test from "node:test";
import assert from "node:assert/strict";
import { validatePoolConfiguration } from "../src/poolConfig.js";

test("prepares an SSL Stratum endpoint and worker without a password", () => {
  assert.deepEqual(validatePoolConfiguration({
    endpoint: "stratum+ssl://btc.pool.example:443",
    worker: "account.worker_1",
  }), {
    endpoint: "stratum+ssl://btc.pool.example:443",
    worker: "account.worker_1",
    encrypted: true,
  });
});

test("accepts a provider's TCP endpoint but marks it unencrypted", () => {
  assert.equal(validatePoolConfiguration({
    endpoint: "stratum+tcp://pool.example:3333",
    worker: "worker-1",
  }).encrypted, false);
});

test("rejects non-Stratum or incomplete endpoints", () => {
  assert.throws(() => validatePoolConfiguration({ endpoint: "https://pool.example:443", worker: "worker" }), RangeError);
  assert.throws(() => validatePoolConfiguration({ endpoint: "stratum+ssl://pool.example", worker: "worker" }), RangeError);
  assert.throws(() => validatePoolConfiguration({ endpoint: "stratum+ssl://pool.example:0", worker: "worker" }), RangeError);
  assert.throws(() => validatePoolConfiguration({ endpoint: "stratum+ssl://pool.example:65536", worker: "worker" }), TypeError);
  assert.throws(() => validatePoolConfiguration({ endpoint: "not a URL", worker: "worker" }), TypeError);
});

test("rejects embedded usernames, paths, query parameters, and fragments", () => {
  for (const endpoint of [
    "stratum+ssl://username@pool.example:443",
    "stratum+ssl://pool.example:443/path",
    "stratum+ssl://pool.example:443?token=example",
    "stratum+ssl://pool.example:443#fragment",
  ]) {
    assert.throws(() => validatePoolConfiguration({ endpoint, worker: "worker" }), RangeError);
  }
});

test("rejects invalid worker names", () => {
  for (const worker of ["", "worker name", "worker\nmalicious", "a".repeat(129)]) {
    assert.throws(() => validatePoolConfiguration({
      endpoint: "stratum+ssl://pool.example:443",
      worker,
    }), RangeError);
  }
});
