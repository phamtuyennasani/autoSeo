# Keyword Planner — Walkthrough

## Tổng Quan

Đã implement đầy đủ tính năng **Keyword Planner** theo tài liệu GenSeo với 4 module:

## Files Đã Tạo / Sửa

### Backend

| File | Thay đổi |
|------|---------|
| [store.js](file:///h:/laragon/www/autoSeo/server/data/store.js) | Thêm 2 bảng `keyword_plans` + `keyword_plan_items` |
| [keywordPlanner.js](file:///h:/laragon/www/autoSeo/server/services/keywordPlanner.js) | **[NEW]** Service AI gọi Gemini phân tích + cluster keyword |
| [keyword-plans.js](file:///h:/laragon/www/autoSeo/server/routes/keyword-plans.js) | **[NEW]** REST API đầy đủ (12 endpoints) |
| [index.js](file:///h:/laragon/www/autoSeo/server/index.js) | Đăng ký route `/api/keyword-plans` |

### Frontend

| File | Thay đổi |
|------|---------|
| [KeywordPlanner.jsx](file:///h:/laragon/www/autoSeo/client/src/pages/KeywordPlanner.jsx) | **[NEW]** Page hoàn chỉnh |
| [Layout.jsx](file:///h:/laragon/www/autoSeo/client/src/components/Layout.jsx) | Thêm menu "Keyword Planner" |
| [App.jsx](file:///h:/laragon/www/autoSeo/client/src/App.jsx) | Thêm route `/keyword-planner` |

## API Endpoints

```
GET    /api/keyword-plans                          — Danh sách plans
POST   /api/keyword-plans                          — Tạo plan mới
GET    /api/keyword-plans/:id                      — Chi tiết plan + items
PUT    /api/keyword-plans/:id                      — Cập nhật plan
DELETE /api/keyword-plans/:id                      — Xóa plan
POST   /api/keyword-plans/:id/duplicate            — Nhân bản plan
POST   /api/keyword-plans/:id/analyze              — AI phân tích & clustering
PUT    /api/keyword-plans/:id/items/:itemId        — Sửa item
DELETE /api/keyword-plans/:id/items/:itemId        — Xóa item
POST   /api/keyword-plans/:id/items               — Thêm keyword thủ công
POST   /api/keyword-plans/:id/items/:itemId/create-article — Tạo bài
GET    /api/keyword-plans/:id/progress             — Thống kê tiến độ
GET    /api/keyword-plans/:id/export?format=csv|json — Xuất báo cáo
```

## Cách Sử Dụng

```
1. Vào sidebar → Keyword Planner
2. Click "+ Tạo kế hoạch" → nhập tên + dán danh sách keyword (mỗi dòng 1 từ)
3. Trong plan detail → click "AI Phân tích" → đợi Gemini xử lý
4. Kết quả: keyword được nhóm thành clusters, có pillar page + intent + content angle
5. Click "+ Tạo bài" ở từng item để tạo bài viết
6. Tab "Tiến độ" để xem progress bar tổng + theo cluster
7. Xuất CSV/JSON để báo cáo
```

## DB Schema

```sql
keyword_plans (id, name, description, companyId, status, keywords, createdBy, createdAt, updatedAt)
keyword_plan_items (id, planId, keyword, cluster_name, cluster_idx, item_type, search_intent, content_angle, status, articleId, scheduled_at, createdAt)
```

**Status plan:** `draft` → `analyzed` → `publishing` → `done`  
**Status item:** `draft` → `created` → `scheduled` → `published` / `error`
