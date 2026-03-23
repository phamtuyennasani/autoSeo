# Keyword Planner — Implementation Plan

Tính năng **Keyword Planner** giúp người dùng lập kế hoạch nội dung SEO từ danh sách keyword:
nhập keyword → AI tự động phân tích & nhóm cluster → tạo bài viết từng cái hoặc batch → theo dõi tiến độ xuất bản.

Luồng hoạt động: **Tạo Plan → AI Cluster → Tạo bài → Lên lịch publish → Track tiến độ**

---

## Proposed Changes

### 1. Database Schema

#### [MODIFY] [store.js](file:///h:/laragon/www/autoSeo/server/data/store.js)

Thêm 2 bảng mới vào `CREATE TABLE`:

```sql
-- Bảng kế hoạch keyword
CREATE TABLE IF NOT EXISTS keyword_plans (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  companyId   TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | analyzed | publishing | done
  keywords    TEXT NOT NULL,                   -- JSON array of keywords
  createdBy   TEXT,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT
);

-- Bảng items trong plan (sau khi AI phân tích)
CREATE TABLE IF NOT EXISTS keyword_plan_items (
  id           TEXT PRIMARY KEY,
  planId       TEXT NOT NULL REFERENCES keyword_plans(id),
  keyword      TEXT NOT NULL,
  cluster_name TEXT,
  cluster_idx  INTEGER,
  item_type    TEXT NOT NULL DEFAULT 'cluster',  -- pillar | cluster
  search_intent TEXT,   -- Informational | Commercial | Navigational | Transactional
  content_angle TEXT,   -- How-to | Listicle | Comparison | Review | Case Study | FAQ
  status       TEXT NOT NULL DEFAULT 'draft',    -- draft | created | scheduled | published | error
  articleId    TEXT,    -- link tới articles.id khi đã tạo bài
  scheduled_at TEXT,
  createdAt    TEXT NOT NULL
);
```

---

### 2. Backend API

#### [NEW] [keyword-plans.js](file:///h:/laragon/www/autoSeo/server/routes/keyword-plans.js)

REST API đầy đủ:

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/keyword-plans` | Danh sách tất cả plans |
| `POST` | `/api/keyword-plans` | Tạo plan mới (name, keywords[], companyId) |
| `GET` | `/api/keyword-plans/:id` | Chi tiết plan + items |
| `PUT` | `/api/keyword-plans/:id` | Cập nhật plan |
| `DELETE` | `/api/keyword-plans/:id` | Xóa plan (không xóa articles liên quan) |
| `POST` | `/api/keyword-plans/:id/analyze` | Gọi AI phân tích & clustering |
| `PUT` | `/api/keyword-plans/:id/items/:itemId` | Chỉnh sửa item (cluster, intent, type...) |
| `POST` | `/api/keyword-plans/:id/items/:itemId/create-article` | Tạo bài từ 1 keyword |
| `POST` | `/api/keyword-plans/:id/batch-create` | Batch tạo nhiều bài |
| `POST` | `/api/keyword-plans/:id/schedule` | Lên lịch publish (interval) |
| `GET` | `/api/keyword-plans/:id/progress` | Tiến độ plan |
| `POST` | `/api/keyword-plans/:id/duplicate` | Nhân bản plan |

#### [NEW] [keywordPlanner.js](file:///h:/laragon/www/autoSeo/server/services/keywordPlanner.js)

Service AI clustering, gọi Gemini với prompt yêu cầu:
- Phân loại search intent (Informational/Commercial/Navigational/Transactional)
- Gợi ý content angle
- Nhóm thành clusters, xác định pillar page mỗi cluster

#### [MODIFY] [index.js](file:///h:/laragon/www/autoSeo/server/index.js)

Thêm:
```js
app.use('/api/keyword-plans', require('./routes/keyword-plans'));
```

---

### 3. Frontend UI

#### [NEW] [KeywordPlanner.jsx](file:///h:/laragon/www/autoSeo/client/src/pages/KeywordPlanner.jsx)

Page chính với 2 view:
1. **View danh sách Plans** — bảng plans (tên, số keyword, số cluster, tiến độ %, status)
2. **View chi tiết Plan** — sau khi click vào 1 plan:
   - Panel trên: thông tin plan + nút "Phân tích AI" / "Batch tạo bài"
   - Panel dưới: clusters dạng accordion. Mỗi cluster hiển thị pillar + cluster articles, mỗi item có trạng thái badge + nút "Tạo bài"
   - Tab "Tiến độ": progress bar tổng + filter theo status/cluster/intent
   - Nút xuất CSV/JSON

#### [MODIFY] [App.jsx](file:///h:/laragon/www/autoSeo/client/src/App.jsx)

```jsx
import KeywordPlanner from './pages/KeywordPlanner';
// Thêm route
<Route path="keyword-planner" element={<KeywordPlanner />} />
```

#### [MODIFY] [Layout.jsx](file:///h:/laragon/www/autoSeo/client/src/components/Layout.jsx)

Thêm menu item "Keyword Planner" (icon: `📋` hoặc lucide `ListTodo`) vào sidebar.

---

## Trạng thái & badge màu

| Status | Màu |
|--------|-----|
| `draft` | Xám |
| `created` | Xanh dương |
| `scheduled` | Vàng/cam |
| `published` | Xanh lá |
| `error` | Đỏ |

---

## Verification Plan

### Tự động (manual browser test)
1. Khởi động server: `cd server && node index.js`
2. Khởi động client: `cd client && npm run dev`
3. Truy cập `http://localhost:5173/keyword-planner`

### Test flow thủ công
1. **Tạo Plan**: Click "+ Tạo kế hoạch", nhập tên + dán 10 keyword, save → plan xuất hiện trong danh sách, status = Draft
2. **AI Phân tích**: Click plan → "Phân tích AI" → đợi vài giây → xem clusters accordion xuất hiện, mỗi keyword được gán intent + cluster
3. **Chỉnh sửa cluster**: Kéo keyword giữa cluster, đổi tên cluster, đổi pillar/cluster type
4. **Tạo bài đơn**: Chọn 1 keyword trong cluster → "Tạo bài viết" → chuyển sang Keywords page với keyword đã điền
5. **Batch tạo**: Chọn nhiều checkbox → "Tạo hàng loạt" → kiểm tra batch-jobs có job mới
6. **Track tiến độ**: Tab tiến độ hiện progress bar, filter theo status
7. **Xuất CSV**: Click "Xuất CSV" → file download với đúng columns
8. **Xóa plan**: Xóa plan → confirm dialog → plan biến mất, articles liên quan vẫn còn
