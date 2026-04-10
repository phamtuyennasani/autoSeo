const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
// ── Log Dashboard WebSocket ────────────────────────────────────────────────────
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

// Dùng __dirname + override:true để đảm bảo .env luôn được load đúng
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const app = express();
// Tạo WS server riêng trên port 3002
const wsServer = new WebSocketServer({ port: 3002 });
const logClients = new Set();

wsServer.on('connection', (ws) => {
  logClients.add(ws);
  ws.send(JSON.stringify({ time: new Date().toISOString(), level: 'info', text: '✅ Đã kết nối Log Dashboard' }));
  ws.on('close', () => logClients.delete(ws));
});

function broadcastLog(level, ...args) {
  if (!logClients.size) return;
  const msg = JSON.stringify({
    time: new Date().toISOString(),
    level,
    text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
  });
  logClients.forEach(ws => ws.readyState === 1 && ws.send(msg));
}

// Override console
const _log   = console.log.bind(console);
const _error = console.error.bind(console);
const _warn  = console.warn.bind(console);
const _info  = console.info.bind(console);

console.log   = (...a) => { _log(...a);   broadcastLog('log',   ...a); };
console.error = (...a) => { _error(...a); broadcastLog('error', ...a); };
console.warn  = (...a) => { _warn(...a);  broadcastLog('warn',  ...a); };
console.info  = (...a) => { _info(...a);  broadcastLog('info',  ...a); };
// End WS
app.use(cors());

// ── Prometheus metrics endpoint (không cần auth) ───────────────────────────────
const { metricsHandler } = require('./services/metricsService');
app.get('/metrics', metricsHandler);

// IMPORTANT: webhooks route phải đặt TRƯỚC express.json() để express.raw() nhận được Buffer thô,
// nếu không HMAC verification sẽ không hoạt động (body đã bị parse rồi).
app.use('/api/webhooks', require('./routes/webhooks'));

app.use(express.json());

// ── Middleware xác thực (global, trước tất cả routes) ─────────────────────────
const authenticate = require('./middleware/authenticate');
const requireAdmin = require('./middleware/requireAdmin');
const requireManager = require('./middleware/requireManager');
const requireRoot = require('./middleware/requireRoot');
const checkDailyLimits = require('./middleware/checkLimits');

app.use(authenticate);

// ── Auth routes (không cần authenticate thêm — /login không cần, nhưng /me tự check bên trong) ──
app.use('/api/auth', require('./routes/auth'));

// ── User management routes (manager trở lên) ─────────────────────────────────
app.use('/api/users', requireManager, require('./routes/users'));

// ── Các routes chính ──────────────────────────────────────────────────────────
app.use('/api/keywords',   require('./routes/keywords'));
app.use('/api/companies',  require('./routes/companies'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/stats',      require('./routes/stats'));
app.use('/api/batch-jobs', require('./routes/batch-jobs'));
app.use('/api/write-queue', require('./routes/write-queue'));
app.use('/api/keyword-plans', require('./routes/keyword-plans'));
app.use('/api/chat',         require('./routes/chat'));
app.use('/api/fonts',        require('./routes/fonts'));
app.use('/api/images',            require('./routes/images'));
app.use('/api/website-analysis',  require('./routes/website-analysis'));

// ── Hợp Đồng & Webhook Events (root-only) ────────────────────────────────────
app.use('/api/hop-dong',       requireRoot, require('./routes/hopDong'));
app.use('/api/webhook-events', requireRoot, require('./routes/webhookEvents'));

// ── CRM Queue monitor (root-only) ─────────────────────────────────────────────
app.use('/api/queue', requireRoot, require('./routes/queue'));

// ── Error Logs (root-only) ─────────────────────────────────────────────────────
app.use('/api/error-logs', requireRoot, require('./routes/errorLogs'));

// Articles — gắn middleware giới hạn cho các POST (viết bài tốn token)
const articlesRouter = require('./routes/articles');
app.use('/api/articles', (req, res, next) => {
  if (req.method === 'POST') return checkDailyLimits(req, res, next);
  next();
}, articlesRouter);

// Publisher — publish bài viết lên CRM2 (tách riêng để dễ bảo trì)
const { router: publisherRouter } = require('./services/publisher');
app.use('/api/publish', publisherRouter);

const PORT = process.env.PORT || 3001;

// Khởi động: init DB trước, sau đó mới listen
const { initDb } = require('./data/store');

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server đang chạy tại cổng ${PORT}`);
      // Khởi động background scheduler check Gemini Batch Jobs
      const { startBatchJobChecker } = require('./jobs/batchJobChecker');
      startBatchJobChecker();
      // Khởi động CRM Queue Workers (keyword → title → article)
      const { startQueueWorkers } = require('./services/crmQueueWorker');
      //startQueueWorkers();
    });
  })
  .catch((err) => {
    console.error('❌ Lỗi khởi tạo DB:', err.message);
    process.exit(1);
  });
