'use strict';

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function summarize(latenciesMs, wallMs, ok, ko) {
  const s = [...latenciesMs].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    ok, ko,
    throughputTps: +(ok / (wallMs / 1000)).toFixed(2),
    latency_ms: {
      mean: +(sum / (s.length || 1)).toFixed(1),
      p50: +percentile(s, 50).toFixed(1),
      p95: +percentile(s, 95).toFixed(1),
      p99: +percentile(s, 99).toFixed(1),
      max: +(s[s.length - 1] || 0).toFixed(1),
    },
  };
}

// Pool de concurrence borne : au plus `concurrency` taches en vol simultanement
async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  async function loop() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, loop));
  return results;
}

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
};

module.exports = { summarize, runWithConcurrency, arg };