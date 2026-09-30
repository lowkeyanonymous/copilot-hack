const SUPPORTED_PROTOCOLS = new Set(["stratum+ssl:", "stratum+tcp:"]);
const WORKER_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function validatePoolConfiguration({ endpoint, worker }) {
  if (typeof endpoint !== "string" || typeof worker !== "string") {
    throw new TypeError("Enter a pool endpoint and worker name.");
  }

  let parsed;
  try {
    parsed = new URL(endpoint.trim());
  } catch {
    throw new TypeError("Enter a complete pool URL, such as stratum+ssl://pool.example:443.");
  }
  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new RangeError("Use a Stratum TCP or SSL endpoint supplied by your mining pool.");
  }
  const port = Number(parsed.port);
  if (!parsed.hostname || !Number.isInteger(port) || port < 1 || port > 65_535 || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new RangeError("The endpoint must include a host and port, without credentials, paths, or query parameters.");
  }
  if (!WORKER_PATTERN.test(worker.trim())) {
    throw new RangeError("Use 1–128 letters, numbers, periods, underscores, or hyphens for the worker name.");
  }

  return {
    endpoint: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
    worker: worker.trim(),
    encrypted: parsed.protocol === "stratum+ssl:",
  };
}
