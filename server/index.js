const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Middleware xác thực (global, trước tất cả routes) ─────────────────────────
const authenticate = require('./middleware/authenticate');
const requireAdmin = require('./middleware/requireAdmin');
const requireManager = require('./middleware/requireManager');
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

// Articles — gắn middleware giới hạn cho các POST (viết bài tốn token)
const articlesRouter = require('./routes/articles');
app.use('/api/articles', (req, res, next) => {
  if (req.method === 'POST') return checkDailyLimits(req, res, next);
  next();
}, articlesRouter);

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
    });
  })
  .catch((err) => {
    console.error('❌ Lỗi khởi tạo DB:', err.message);
    process.exit(1);
  });
