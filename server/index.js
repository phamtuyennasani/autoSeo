const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const checkDailyLimits = require('./middleware/checkLimits');

// Routes
app.use('/api/keywords', require('./routes/keywords'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/batch-jobs', require('./routes/batch-jobs'));

// Articles — gắn middleware giới hạn cho các POST (viết bài tốn token)
const articlesRouter = require('./routes/articles');
app.use('/api/articles', (req, res, next) => {
  // Chỉ check khi POST (viết bài), GET/DELETE không cần check
  if (req.method === 'POST') return checkDailyLimits(req, res, next);
  next();
}, articlesRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Khởi động background scheduler check Gemini Batch Jobs
  const { startBatchJobChecker } = require('./jobs/batchJobChecker');
  startBatchJobChecker();
});


