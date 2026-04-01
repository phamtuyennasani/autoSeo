/**
 * metricsService.js — Prometheus metrics cho AutoSEO
 *
 * Expose: GET /metrics  (prometheus text format)
 *
 * Metrics:
 *   - Queue depth: keyword_queue & title_queue theo status
 *   - Processing time: histogram thời gian xử lý mỗi job
 *   - Error rate:     counter theo queue type + status
 *   - Token usage:    counter input/output tokens
 *   - Article count:  counter articles created
 *   - Webhook events: counter theo status
 */

const client = require('prom-client');
const { db }  = require('../data/store');

// ─── Registry + default metrics ────────────────────────────────────────────────
const register = new client.Registry();

client.collectDefaultMetrics({ register });

// ─── Queue Gauges ─────────────────────────────────────────────────────────────
const kwQueueGauge = new client.Gauge({
  name:  'autoseo_keyword_queue_depth',
  help:  'Số job trong keyword_queue theo status',
  labelNames: ['status'],
  registers: [register],
});

const tlQueueGauge = new client.Gauge({
  name:  'autoseo_title_queue_depth',
  help:  'Số job trong title_queue theo status',
  labelNames: ['status'],
  registers: [register],
});

const webhookEventsGauge = new client.Gauge({
  name:  'autoseo_webhook_events_count',
  help:  'Số webhook_events theo status',
  labelNames: ['status'],
  registers: [register],
});

// ─── Processing Histogram ──────────────────────────────────────────────────────
const kwProcessingHistogram = new client.Histogram({
  name:  'autoseo_keyword_processing_seconds',
  help:  'Thời gian xử lý keyword job (seconds)',
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

const tlProcessingHistogram = new client.Histogram({
  name:  'autoseo_title_processing_seconds',
  help:  'Thời gian xử lý title job (seconds)',
  buckets: [5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

// ─── Counters ─────────────────────────────────────────────────────────────────
const jobCounter = new client.Counter({
  name:  'autoseo_jobs_total',
  help:  'Tổng số job đã xử lý',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const webhookEventCounter = new client.Counter({
  name:  'autoseo_webhook_events_total',
  help:  'Tổng số webhook events đã xử lý',
  labelNames: ['status'],
  registers: [register],
});

const tokenCounter = new client.Counter({
  name:  'autoseo_tokens_total',
  help:  'Tổng số tokens đã dùng',
  labelNames: ['type', 'model'],
  registers: [register],
});

const articleCounter = new client.Counter({
  name:  'autoseo_articles_total',
  help:  'Tổng số bài viết đã tạo',
  labelNames: ['source'],
  registers: [register],
});

// ─── Record helpers (gọi từ queue worker / article routes) ───────────────────

function recordKeywordProcessed(durationSec, success) {
  kwProcessingHistogram.observe(durationSec);
  jobCounter.inc({ queue: 'keyword', status: success ? 'done' : 'failed' });
}

function recordTitleProcessed(durationSec, success) {
  tlProcessingHistogram.observe(durationSec);
  jobCounter.inc({ queue: 'title', status: success ? 'done' : 'failed' });
}

function recordWebhookEvent(status) {
  webhookEventCounter.inc({ status });
}

function recordTokens(input, output, model) {
  if (input  > 0) tokenCounter.inc({ type: 'input',  model }, input);
  if (output > 0) tokenCounter.inc({ type: 'output', model }, output);
}

function recordArticle(source = 'manual') {
  articleCounter.inc({ source });
}

// ─── Refresh gauges từ DB (gọi mỗi khi /metrics hit) ───────────────────────────
async function refreshGauges() {
  try {
    // keyword_queue
    const kw = await db.execute(
      `SELECT status, COUNT(*) AS cnt FROM keyword_queue GROUP BY status`
    );
    const kwMap = { pending: 0, processing: 0, done: 0, failed: 0 };
    for (const r of kw.rows) kwMap[r.status] = Number(r.cnt);
    for (const [s, v] of Object.entries(kwMap)) kwQueueGauge.set({ status: s }, v);

    // title_queue
    const tl = await db.execute(
      `SELECT status, COUNT(*) AS cnt FROM title_queue GROUP BY status`
    );
    const tlMap = { pending: 0, processing: 0, done: 0, failed: 0 };
    for (const r of tl.rows) tlMap[r.status] = Number(r.cnt);
    for (const [s, v] of Object.entries(tlMap)) tlQueueGauge.set({ status: s }, v);

    // webhook_events
    const wh = await db.execute(
      `SELECT status, COUNT(*) AS cnt FROM webhook_events GROUP BY status`
    );
    const whMap = { pending: 0, processing: 0, done: 0, failed: 0 };
    for (const r of wh.rows) whMap[r.status] = Number(r.cnt);
    for (const [s, v] of Object.entries(whMap)) webhookEventsGauge.set({ status: s }, v);
  } catch (e) {
    console.warn('[metrics] refreshGauges error:', e.message);
  }
}

// ─── HTTP handler — gắn vào app.get('/metrics') ──────────────────────────────
async function metricsHandler(req, res) {
  try {
    await refreshGauges();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    res.status(500).end(e.message);
  }
}

module.exports = {
  register,
  metricsHandler,
  recordKeywordProcessed,
  recordTitleProcessed,
  recordWebhookEvent,
  recordTokens,
  recordArticle,
};
