/**
 * agent-tools.js
 *
 * AI Agent Tools cho AutoSEO.
 * Các tool KHÔNG yêu cầu AI truyền đúng ID — tự resolve name → ID.
 */

const { db } = require('../data/store');
const { getEffectiveApiConfig } = require('./apiConfig');
const { getSearchContext } = require('./serp');
const { generateTitles } = require('./gemini');
const { getVisibleUserIds } = require('./permissions');
const { getSetting } = require('../routes/settings');
const { isRoot } = require('./permissions');

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER — resolve company: thử ID trước, sau đó fuzzy match theo tên
───────────────────────────────────────────────────────────────────────────── */
async function resolveCompany(companyIdOrName, user) {
  let result;

  // Thử query theo ID trước
  result = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyIdOrName] });
  if (result.rows[0]) return { company: result.rows[0], resolvedBy: 'id' };

  // Thử fuzzy match theo tên (LIKE %name%)
  const likeName = `%${companyIdOrName}%`;
  const visibleIds = await getVisibleUserIds(user.id, user.role);
  let sql = 'SELECT * FROM companies WHERE name LIKE ?';
  const args = [likeName];

  if (visibleIds !== null) {
    const placeholders = visibleIds.map(() => '?').join(',');
    sql += ` AND createdBy IN (${placeholders})`;
    args.push(...visibleIds);
  }
  sql += ' LIMIT 5';

  result = await db.execute({ sql, args });

  if (result.rows.length === 0) {
    return { company: null, error: `Không tìm thấy công ty "${companyIdOrName}".` };
  }
  if (result.rows.length > 1) {
    return {
      company: null,
      ambiguous: true,
      options: result.rows.map(c => ({ id: c.id, name: c.name, url: c.url })),
      error: `Có ${result.rows.length} công ty phù hợp với "${companyIdOrName}". Vui lòng cho biết chính xác tên.` };
  }
  return { company: result.rows[0], resolvedBy: 'name' };
}

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER — resolve keyword: thử ID trước, sau đó fuzzy match theo tên
───────────────────────────────────────────────────────────────────────────── */
async function resolveKeyword(keywordIdOrText, user) {
  let result;

  result = await db.execute({ sql: 'SELECT k.*, c.name as company_name FROM keywords k LEFT JOIN companies c ON k.companyId = c.id WHERE k.id = ?', args: [keywordIdOrText] });
  if (result.rows[0]) return { keyword: result.rows[0], resolvedBy: 'id' };

  const likeText = `%${keywordIdOrText}%`;
  const visibleIds = await getVisibleUserIds(user.id, user.role);
  let sql = 'SELECT k.*, c.name as company_name FROM keywords k LEFT JOIN companies c ON k.companyId = c.id WHERE k.keyword LIKE ?';
  const args = [likeText];

  if (visibleIds !== null) {
    const placeholders = visibleIds.map(() => '?').join(',');
    sql += ` AND k.createdBy IN (${placeholders})`;
    args.push(...visibleIds);
  }
  sql += ' ORDER BY k.createdAt DESC LIMIT 5';

  result = await db.execute({ sql, args });

  if (result.rows.length === 0) {
    return { keyword: null, error: `Không tìm thấy từ khóa "${keywordIdOrText}".` };
  }
  if (result.rows.length > 1) {
    return {
      keyword: null,
      ambiguous: true,
      options: result.rows.map(k => ({ id: k.id, keyword: k.keyword, company: k.company_name })),
      error: `Có ${result.rows.length} từ khóa phù hợp. Vui lòng cho biết chính xác.` };
  }
  return { keyword: result.rows[0], resolvedBy: 'text' };
}


/* ─────────────────────────────────────────────────────────────────────────────
   TOOL DECLARATIONS
───────────────────────────────────────────────────────────────────────────── */
const TOOL_DECLARATIONS = [
  {
    name: 'create_company',
    description: 'Tạo công ty/website mới. GỌI KHI: user yêu cầu tạo mới công ty, thêm công ty, đăng ký công ty. CHỈ cần name và url — các trường khác có thể bỏ trống.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Tên công ty/website. BẮT BUỘC.',
        },
        url: {
          type: 'string',
          description: 'URL website công ty. VD: "https://dienmayxanh.com". BẮT BUỘC.',
        },
        industry: {
          type: 'string',
          description: 'Ngành nghề công ty. VD: "Điện máy", "Thời trang", "F&B".',
        },
        info: {
          type: 'string',
          description: 'Mô tả ngắn về công ty.',
        },
        contract_code: {
          type: 'string',
          description: 'Mã hợp đồng (nếu có).',
        },
      },
      required: ['name', 'url'],
    },
  },
  {
    name: 'create_keywords',
    description: 'Tạo từ khóa SEO mới cho công ty. GỌI KHI: user muốn tạo/thêm từ khóa. Có thể truyền tên công ty hoặc ID — hệ thống tự resolve.',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          description: 'Mảng từ khóa. VD: ["laptop gaming", "điện thoại flagship"]',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 10,
        },
        company_name: {
          type: 'string',
          description: 'TÊN hoặc ID công ty. VD: "Điện Máy Xanh" hoặc "comp_001". Hệ thống sẽ tự tìm.',
        },
        title_count: {
          type: 'integer',
          description: 'Số tiêu đề/từ khóa. Mặc định: 10. Tối đa: 30.',
          default: 10,
        },
      },
      required: ['keywords', 'company_name'],
    },
  },
  {
    name: 'write_articles',
    description: 'Viết bài viết SEO. GỌI KHI: user muốn viết/tạo bài viết cho từ khóa. Hệ thống tự resolve từ khóa.',
    parameters: {
      type: 'object',
      properties: {
        keyword_name: {
          type: 'string',
          description: 'TÊN hoặc ID từ khóa cần viết bài. VD: "laptop gaming" hoặc "kw_001".',
        },
        titles: {
          type: 'array',
          description: 'Danh sách tiêu đề cụ thể cần viết. Bỏ trống = viết tất cả trong từ khóa.',
          items: { type: 'string' },
        },
        company_name: {
          type: 'string',
          description: 'TÊN hoặc ID công ty. Hệ thống tự resolve.',
        },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'list_companies',
    description: 'Liệt kê công ty của user. GỌI KHI: cần biết công ty để chọn, hoặc user hỏi danh sách công ty.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_keywords',
    description: 'Liệt kê từ khóa. GỌI KHI: user hỏi xem từ khóa hiện có.',
    parameters: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Lọc theo tên/ID công ty.',
        },
        search: {
          type: 'string',
          description: 'Tìm kiếm theo tên từ khóa.',
        },
        limit: {
          type: 'integer',
          description: 'Số lượng kết quả. Mặc định: 10.',
          default: 10,
        },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Lấy thống kê hệ thống: tổng từ khóa, bài viết, số bài hôm nay, từ khóa tuần này.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_articles',
    description: 'Liệt kê bài viết. GỌI KHI: user hỏi xem bài viết, bài nào chưa đăng, bài viết của công ty nào.',
    parameters: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Lọc theo tên/ID công ty.',
        },
        keyword_name: {
          type: 'string',
          description: 'Lọc theo tên/ID từ khóa.',
        },
        status: {
          type: 'string',
          description: 'Lọc theo trạng thái: "pending" (chưa đăng), "published" (đã đăng), "all" (tất cả). Mặc định: "all".',
          enum: ['pending', 'published', 'all'],
        },
        limit: {
          type: 'integer',
          description: 'Số lượng kết quả. Mặc định: 10.',
          default: 10,
        },
      },
    },
  },
  {
    name: 'get_keyword_detail',
    description: 'Xem chi tiết một từ khóa cụ thể: danh sách tiêu đề đã tạo, số bài đã viết, số bài còn lại chưa viết. GỌI KHI: user nói "chi tiết từ khóa [tên]", "xem tiêu đề của [từ khóa]", "từ khóa [tên] có bao nhiêu tiêu đề", "bài viết trong từ khóa [tên]".',
    parameters: {
      type: 'object',
      properties: {
        keyword_name: {
          type: 'string',
          description: 'Tên hoặc ID từ khóa cần xem chi tiết. Ví dụ: "Thiết kế web giá rẻ" hoặc "kw-123". BẮT BUỘC.',
        },
      },
      required: ['keyword_name'],
    },
  },
  {
    name: 'check_write_job',
    description: 'Kiểm tra tiến độ job viết bài đang chạy nền. GỌI KHI: user hỏi bài xong chưa, tiến độ job thế nào.',
    parameters: {
      type: 'object',
      properties: {
        job_id: {
          type: 'string',
          description: 'ID của job viết bài (được trả về từ write_articles). BẮT BUỘC.',
        },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'analyze_website',
    description: 'Bắt đầu phân tích website để gợi ý từ khóa SEO. Crawl website → AI phân tích → trả về danh sách từ khóa gợi ý. GỌI KHI: user nói "phân tích website [URL]", "tìm từ khóa cho [domain]", "crawl [URL]"',
    parameters: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Tên hoặc ID công ty. Lấy URL từ company. BẮT BUỘC.',
        },
        url: {
          type: 'string',
          description: 'URL cần phân tích (tùy chọn, mặc định lấy từ company).',
        },
        max_pages: {
          type: 'integer',
          description: 'Số trang tối đa crawl. Mặc định: 100. Tối đa: 500.',
          default: 100,
        },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'get_analysis_results',
    description: 'Lấy kết quả phân tích website: danh sách từ khóa gợi ý kèm priority, search intent, cluster. GỌI KHI: user nói "kết quả phân tích", "từ khóa gợi ý", "xem phân tích của [công ty]"',
    parameters: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Tên hoặc ID công ty. BẮT BUỘC.',
        },
        analysis_id: {
          type: 'string',
          description: 'ID của job phân tích (tùy chọn). Mặc định: lấy phân tích mới nhất.',
        },
        priority: {
          type: 'string',
          description: 'Lọc theo mức ưu tiên: "Cao", "Trung bình", "Thấp".',
        },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'publish_article',
    description: 'Đăng bài viết lên website qua API. GỌI KHI: user nói "đăng bài [tiêu đề]", "publish bài", "đăng bài lên website".',
    parameters: {
      type: 'object',
      properties: {
        article_title: {
          type: 'string',
          description: 'Tiêu đề bài cần đăng. Tìm bài theo tiêu đề. BẮT BUỘC.',
        },
        company_name: {
          type: 'string',
          description: 'Tên hoặc ID công ty (tùy chọn, để xác định publish_api_url).',
        },
      },
      required: ['article_title'],
    },
  },
  {
    name: 'delete_keyword',
    description: 'Xóa từ khóa khỏi hệ thống. Sẽ cảnh báo nếu có bài viết liên quan và không xóa được. GỌI KHI: user nói "xóa từ khóa [tên]", "bỏ từ khóa [tên]".',
    parameters: {
      type: 'object',
      properties: {
        keyword_name: {
          type: 'string',
          description: 'Tên hoặc ID từ khóa cần xóa. BẮT BUỘC.',
        },
        confirm: {
          type: 'boolean',
          description: 'Xác nhận xóa. Nếu có bài viết liên quan, cần confirm=true mới xóa.',
          default: false,
        },
      },
      required: ['keyword_name'],
    },
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: create_company
───────────────────────────────────────────────────────────────────────────── */
async function toolCreateCompany({ name, url, industry, info, contract_code }, user) {
  if (!name?.trim()) return { error: 'Thiếu tên công ty. Cần cung cấp: name.' };
  if (!url?.trim())  return { error: 'Thiếu URL website. Cần cung cấp: url.' };

  // Chuẩn hóa URL
  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  try {
    // Kiểm tra trùng tên
    const dup = await db.execute({ sql: 'SELECT id FROM companies WHERE name = ?', args: [name.trim()] });
    if (dup.rows[0]) {
      return { error: `Công ty "${name}" đã tồn tại trong hệ thống.`, existing_id: dup.rows[0].id };
    }

    const id       = Date.now().toString();
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: 'INSERT INTO companies (id, name, url, info, contract_code, industry, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        id,
        name.trim(),
        normalizedUrl,
        info?.trim() || '',
        contract_code?.trim() || '',
        industry?.trim() || '',
        createdAt,
        user.id,
      ],
    });

    return {
      success: true,
      company: {
        id,
        name: name.trim(),
        url: normalizedUrl,
        industry: industry?.trim() || '',
        info: info?.trim() || '',
        contract_code: contract_code?.trim() || '',
        createdAt,
      },
      message: `✅ Đã tạo công ty "${name.trim()}" thành công! Website: ${normalizedUrl}`,
    };
  } catch (e) {
    return { error: 'Lỗi khi tạo công ty: ' + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: create_keywords
───────────────────────────────────────────────────────────────────────────── */
async function toolCreateKeywords({ keywords, company_name, title_count = 10 }, user) {
  if (!company_name) return { error: 'Thiếu tên công ty. Vui lòng gọi list_companies() trước.' };
  if (!keywords || keywords.length === 0) return { error: 'Thiếu danh sách từ khóa.' };

  const { company, error, ambiguous, options } = await resolveCompany(company_name, user);
  if (error && !ambiguous) return { error };
  if (ambiguous) return { error, options };

  const results = [];
  const errors = [];
  const apiConfig = await getEffectiveApiConfig(user.id);
  if (apiConfig.blocked) return { error: apiConfig.message };

  for (const kw of keywords.slice(0, 10)) {
    try {
      const count = Math.max(1, Math.min(30, title_count));
      let titles = [];
      try {
        const searchContext = await getSearchContext(kw, apiConfig.serpApiKey);
        const titleResult = await generateTitles(kw, searchContext, count, { ...apiConfig, contentType: 'blog' });
        titles = (titleResult.titles || []).slice(0, count);
      } catch (e) {
        titles = [`${kw} — Hướng dẫn chi tiết`];
      }

      const id = `kw-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const createdAt = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO keywords (id, keyword, titles, companyId, createdAt, createdBy, content_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, kw, JSON.stringify(titles.map(t => ({ title: t.title || t, topic: '' }))), company.id, createdAt, user.id, 'blog'],
      });

      results.push({
        keyword: kw,
        id,
        titles_generated: titles.length,
        titles: titles.slice(0, 3),
        company: company.name,
      });
    } catch (e) {
      errors.push(`"${kw}": ${e.message}`);
    }
  }

  return { results, errors, total_created: results.length };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: write_articles
───────────────────────────────────────────────────────────────────────────── */
async function toolWriteArticles({ keyword_name, titles, company_name }, user) {
  if (!company_name && !keyword_name) {
    return { error: 'Cần cung cấp từ khóa hoặc công ty.' };
  }

  // Resolve keyword
  let keyword = null;
  let resolvedCompany = null;

  if (keyword_name) {
    const result = await resolveKeyword(keyword_name, user);
    if (result.error && !result.ambiguous) return { error: result.error };
    if (result.ambiguous) return { error: result.error, options: result.options };
    keyword = result.keyword;
    resolvedCompany = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [keyword.companyId] }).then(r => r.rows[0]);
  }

  // Resolve company
  if (!resolvedCompany && company_name) {
    const result = await resolveCompany(company_name, user);
    if (result.error && !result.ambiguous) return { error: result.error };
    if (result.ambiguous) return { error: result.error, options: result.options };
    resolvedCompany = result.company;
  }

  if (!resolvedCompany) return { error: 'Không xác định được công ty.' };

  // Lấy titles từ keyword
  let titlesToWrite = titles || [];
  if (!titlesToWrite.length && keyword) {
    try {
      const parsed = JSON.parse(keyword.titles || '[]');
      titlesToWrite = parsed.map(t => typeof t === 'string' ? t : t.title);
    } catch {}
  }

  if (!titlesToWrite.length) return { error: 'Không có tiêu đề nào để viết.' };

  titlesToWrite = titlesToWrite.slice(0, 20);

  const apiConfig = await getEffectiveApiConfig(user.id);
  if (apiConfig.blocked) return { error: apiConfig.message };

  // Giới hạn bài/ngày — chỉ áp dụng khi dùng key hệ thống
  if (apiConfig.usingSystemKey && !isRoot(user)) {
    const today = new Date().toISOString().slice(0, 10);
    let userArticleLimit = 0;
    if (process.env.AUTH_ENABLED === 'true') {
      const r = await db.execute({ sql: 'SELECT daily_article_limit FROM users WHERE id = ?', args: [user.id] });
      userArticleLimit = Number(r.rows[0]?.daily_article_limit || 0);
    }
    const globalArticleLimit = Number(await getSetting('daily_article_limit')) || 0;
    const articleLimit = userArticleLimit > 0 ? userArticleLimit : globalArticleLimit;
    if (articleLimit > 0) {
      const usageResult = await db.execute({
        sql: `SELECT COUNT(*) AS cnt FROM token_usage WHERE (type = 'article' OR type = 'article-batch') AND createdAt LIKE ? AND createdBy = ?`,
        args: [`${today}%`, user.id],
      });
      const used = Number(usageResult.rows[0]?.cnt || 0);
      if (used >= articleLimit) {
        return { error: `Đã đạt giới hạn ${articleLimit} bài viết hôm nay. Vui lòng thử lại vào ngày mai.` };
      }
    }
  }

  // Đảm bảo keywordText không rỗng để bài viết lưu đúng keyword vào DB
  const keywordText = keyword?.keyword || titlesToWrite[0] || 'SEO';

  const { startJob } = require('./writeQueue');
  const { generateAndSave } = require('../routes/articles');
  const jobId = `wq-agent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  // Thử viết bài đầu tiên ngay (đồng bộ) để phát hiện lỗi API sớm
  try {
    await generateAndSave(keywordText, titlesToWrite[0], resolvedCompany.id, resolvedCompany, user.id, apiConfig, keyword?.id || null);
  } catch (e) {
    return { error: `Không thể viết bài: ${e.message}` };
  }

  // Các bài còn lại chạy nền
  if (titlesToWrite.length > 1) {
    await startJob(jobId, keywordText, resolvedCompany.id, titlesToWrite.slice(1), resolvedCompany, generateAndSave, user.id, apiConfig, keyword?.id || null);
  }

  return {
    job_id: jobId,
    total: titlesToWrite.length,
    done_sync: 1,
    titles: titlesToWrite,
    company: resolvedCompany.name,
    status: 'writing',
    message: `Đã viết xong bài đầu tiên. ${titlesToWrite.length > 1 ? `${titlesToWrite.length - 1} bài còn lại đang viết trong nền.` : ''} Vào mục Bài Viết để xem.`,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: list_companies
───────────────────────────────────────────────────────────────────────────── */
async function toolListCompanies({}, user) {
  const visibleIds = await getVisibleUserIds(user.id, user.role);
  let sql = 'SELECT id, name, url, createdAt FROM companies';
  const args = [];

  if (visibleIds !== null) {
    const placeholders = visibleIds.map(() => '?').join(',');
    sql += ` WHERE createdBy IN (${placeholders})`;
    args.push(...visibleIds);
  }
  sql += ' ORDER BY createdAt DESC LIMIT 20';

  const result = await db.execute({ sql, args });
  return { companies: result.rows };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: list_keywords
───────────────────────────────────────────────────────────────────────────── */
async function toolListKeywords({ company_name, search, limit = 10 }, user) {
  const conditions = [];
  const args = [];

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  if (visibleIds !== null) {
    const placeholders = visibleIds.map(() => '?').join(',');
    conditions.push(`k.createdBy IN (${placeholders})`);
    args.push(...visibleIds);
  }

  if (company_name) {
    const resolved = await resolveCompany(company_name, user);
    if (resolved.company) {
      conditions.push('k.companyId = ?');
      args.push(resolved.company.id);
    }
  }

  if (search) {
    conditions.push('k.keyword LIKE ?');
    args.push(`%${search}%`);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const result = await db.execute({
    sql: `SELECT k.id, k.keyword, k.companyId, k.createdAt, k.titles, c.name as company_name,
                 (SELECT COUNT(*) FROM articles a WHERE a.keywordId = k.id) as article_count
          FROM keywords k LEFT JOIN companies c ON k.companyId = c.id
          ${where}
          ORDER BY k.createdAt DESC LIMIT ?`,
    args: [...args, Math.min(50, limit)],
  });

  const data = result.rows.map(r => {
    let titles = [];
    try { titles = JSON.parse(r.titles); } catch {}
    return { ...r, titles_count: titles.length };
  });

  return { keywords: data };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: get_stats
───────────────────────────────────────────────────────────────────────────── */
async function toolGetStats({}, user) {
  const visibleIds = await getVisibleUserIds(user.id, user.role);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const weekStartStr = weekStart.toISOString();

  let userCond = '';
  const baseArgs = [];
  if (visibleIds !== null) {
    const placeholders = visibleIds.map(() => '?').join(',');
    userCond = `createdBy IN (${placeholders})`;
    baseArgs.push(...visibleIds);
  }

  const w = (extra) => {
    const parts = [userCond, extra].filter(Boolean);
    return parts.length ? 'WHERE ' + parts.join(' AND ') : '';
  };

  const [r1, r2, r3, r4] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) as n FROM keywords ${w()}`, args: [...baseArgs] }),
    db.execute({ sql: `SELECT COUNT(*) as n FROM articles ${w()}`, args: [...baseArgs] }),
    db.execute({ sql: `SELECT COUNT(*) as n FROM articles ${w('createdAt >= ?')}`, args: [...baseArgs, todayStart] }),
    db.execute({ sql: `SELECT COUNT(*) as n FROM keywords ${w('createdAt >= ?')}`, args: [...baseArgs, weekStartStr] }),
  ]);

  return {
    total_keywords: Number(r1.rows[0]?.n || 0),
    total_articles: Number(r2.rows[0]?.n || 0),
    articles_today: Number(r3.rows[0]?.n || 0),
    keywords_this_week: Number(r4.rows[0]?.n || 0),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: list_articles
───────────────────────────────────────────────────────────────────────────── */
async function toolListArticles({ company_name, keyword_name, status = 'all', limit = 10 }, user) {
  const conditions = [];
  const args = [];

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  if (visibleIds !== null) {
    const placeholders = visibleIds.map(() => '?').join(',');
    conditions.push(`a.createdBy IN (${placeholders})`);
    args.push(...visibleIds);
  }

  if (company_name) {
    const resolved = await resolveCompany(company_name, user);
    if (resolved.company) {
      conditions.push('a.companyId = ?');
      args.push(resolved.company.id);
    }
  }

  if (keyword_name) {
    const resolved = await resolveKeyword(keyword_name, user);
    if (resolved.keyword) {
      conditions.push('a.keywordId = ?');
      args.push(resolved.keyword.id);
    } else {
      // fallback: tìm theo text
      conditions.push('a.keyword LIKE ?');
      args.push(`%${keyword_name}%`);
    }
  }

  if (status && status !== 'all') {
    conditions.push('a.publish_status = ?');
    args.push(status);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const result = await db.execute({
    sql: `SELECT a.id, a.title, a.keyword, a.publish_status, a.createdAt, a.published_at,
                 c.name as company_name
          FROM articles a
          LEFT JOIN companies c ON a.companyId = c.id
          ${where}
          ORDER BY a.createdAt DESC LIMIT ?`,
    args: [...args, Math.min(50, limit)],
  });

  return {
    articles: result.rows,
    total: result.rows.length,
    filter: { company_name, keyword_name, status },
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: get_keyword_detail
───────────────────────────────────────────────────────────────────────────── */
async function toolGetKeywordDetail({ keyword_name }, user) {
  if (!keyword_name) return { error: 'Cần cung cấp tên hoặc ID từ khóa.' };

  const { keyword, error, ambiguous, options } = await resolveKeyword(keyword_name, user);
  if (error && !ambiguous) return { error };
  if (ambiguous) return { error, options };

  // Parse danh sách titles
  let titles = [];
  try {
    titles = JSON.parse(keyword.titles || '[]');
    titles = titles.map(t => (typeof t === 'string' ? { title: t } : t));
  } catch {}

  // Đếm bài viết đã viết theo từng title
  const articlesResult = await db.execute({
    sql: 'SELECT title FROM articles WHERE keywordId = ?',
    args: [keyword.id],
  });

  const writtenTitles = new Set(articlesResult.rows.map(r => r.title));

  const titlesWithStatus = titles.map(t => ({
    title: t.title || t,
    written: writtenTitles.has(t.title || t),
  }));

  return {
    id: keyword.id,
    keyword: keyword.keyword,
    company: keyword.company_name,
    total_titles: titles.length,
    written_count: writtenTitles.size,
    remaining_count: Math.max(0, titles.length - writtenTitles.size),
    titles: titlesWithStatus,
    createdAt: keyword.createdAt,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: check_write_job
───────────────────────────────────────────────────────────────────────────── */
async function toolCheckWriteJob({ job_id }, _user) {
  if (!job_id) return { error: 'Cần cung cấp job_id.' };

  const { getJob } = require('./writeQueue');
  const job = getJob(job_id);

  if (!job) {
    return {
      job_id,
      found: false,
      message: 'Không tìm thấy job này. Job có thể đã hoàn thành và bị xóa khỏi bộ nhớ (sau 60 phút), hoặc job_id không đúng.',
    };
  }

  return {
    job_id,
    found: true,
    status: job.status,
    keyword: job.keyword,
    total: job.total,
    done: job.done,
    succeeded: job.succeeded,
    failed: job.failed,
    current_title: job.currentTitle,
    progress_percent: job.total > 0 ? Math.round((job.done / job.total) * 100) : 0,
    results: job.results,
    startedAt: job.startedAt,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: analyze_website
───────────────────────────────────────────────────────────────────────────── */
async function toolAnalyzeWebsite({ company_name, url, max_pages = 100 }, user) {
  if (!company_name) return { error: 'Cần cung cấp tên công ty (company_name).' };

  const { company, error } = await resolveCompany(company_name, user);
  if (error) return { error };

  const targetUrl = url?.trim() || company?.url;
  if (!targetUrl) return { error: 'Không có URL website để phân tích.' };

  try { new URL(targetUrl); } catch {
    return { error: `URL không hợp lệ: ${targetUrl}` };
  }

  const { db } = require('../data/store');
  const { runAnalysis } = require('../services/websiteAnalyzer');

  const id        = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  const maxPages  = Math.min(Math.max(1, parseInt(max_pages) || 100), 500);

  await db.execute({
    sql:  `INSERT INTO website_analyses (id, companyId, url, status, config, createdAt, createdBy)
           VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    args: [id, company.id, targetUrl, JSON.stringify({ maxPages: maxPages, maxDepth: 3 }), createdAt, user.id],
  });

  runAnalysis(id, targetUrl, { name: company.name, info: company.info }, {
    maxPages: maxPages,
    maxDepth: 3,
    delayMs: 300,
    userId: user.id,
  }).catch(err => console.error('[agent] analyze_website background error:', err.message));

  return {
    analysis_id: id,
    url: targetUrl,
    company: company.name,
    max_pages: maxPages,
    status: 'pending',
    message: `Đã bắt đầu phân tích website ${targetUrl}. Dùng tool **get_analysis_results** sau 1-2 phút để xem kết quả.`,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: get_analysis_results
───────────────────────────────────────────────────────────────────────────── */
async function toolGetAnalysisResults({ company_name, analysis_id, priority }, user) {
  const { db } = require('../data/store');

  let resolvedAnalysisId = analysis_id;

  if (!resolvedAnalysisId && company_name) {
    const { company, error } = await resolveCompany(company_name, user);
    if (error) return { error };

    const visibleIds = await getVisibleUserIds(user.id, user.role);
    let sql = 'SELECT id FROM website_analyses WHERE companyId = ?';
    const args = [company.id];

    if (visibleIds !== null) {
      sql += ` AND createdBy IN (${visibleIds.map(() => '?').join(',')})`;
      args.push(...visibleIds);
    }
    sql += ' ORDER BY createdAt DESC LIMIT 1';

    const r = await db.execute({ sql, args });
    if (!r.rows[0]) return { error: `Chưa có phân tích nào cho công ty "${company.name}".` };
    resolvedAnalysisId = r.rows[0].id;
  }

  if (!resolvedAnalysisId) return { error: 'Cần cung cấp company_name hoặc analysis_id.' };

  const [metaR, kwR] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM website_analyses WHERE id = ?', args: [resolvedAnalysisId] }),
    (async () => {
      let sql = 'SELECT * FROM website_analysis_keywords WHERE analysisId = ?';
      const args = [resolvedAnalysisId];
      if (priority) { sql += ' AND priority = ?'; args.push(priority); }
      sql += " ORDER BY CASE priority WHEN 'Cao' THEN 1 WHEN 'Trung bình' THEN 2 ELSE 3 END";
      return db.execute({ sql, args });
    })(),
  ]);

  if (!metaR.rows[0]) return { error: 'Không tìm thấy phân tích.' };

  const meta = metaR.rows[0];
  const summary = meta.summary ? (typeof meta.summary === 'string' ? JSON.parse(meta.summary) : meta.summary) : {};

  return {
    analysis_id: resolvedAnalysisId,
    url: meta.url,
    status: meta.status,
    total_pages: meta.totalPages || 0,
    summary: summary,
    keywords_count: kwR.rows.length,
    keywords: kwR.rows,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: publish_article
───────────────────────────────────────────────────────────────────────────── */
async function toolPublishArticle({ article_title }, user) {
  if (!article_title) return { error: 'Cần cung cấp tiêu đề bài viết (article_title).' };

  const { db } = require('../data/store');

  // Tìm article theo title (LIKE %title%)
  let sql  = `SELECT a.*, c.name as company_name, c.url as company_url
              FROM articles a LEFT JOIN companies c ON a.companyId = c.id WHERE a.title LIKE ?`;
  const args = [`%${article_title}%`];

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  if (visibleIds !== null) {
    sql += ` AND a.createdBy IN (${visibleIds.map(() => '?').join(',')})`;
    args.push(...visibleIds);
  }
  sql += ' LIMIT 5';

  const result = await db.execute({ sql, args });
  if (result.rows.length === 0) return { error: `Không tìm thấy bài viết nào với tiêu đề "${article_title}".` };

  let article = result.rows[0];
  if (result.rows.length > 1) {
    return {
      ambiguous: true,
      options: result.rows.map(a => ({ id: a.id, title: a.title, company: a.company_name })),
      error: `Có ${result.rows.length} bài viết phù hợp. Vui lòng cho biết chính xác tiêu đề.` };
  }

  if (article.publish_status === 'published') {
    return { error: `Bài "${article.title}" đã được đăng rồi. Không cần đăng lại.` };
  }

  // Xác định publish_api_url từ cài đặt hệ thống
  const apiUrl = await getSetting('publish_api_url');
  if (!apiUrl) {
    return { error: 'Chưa cấu hình publish API URL. Vui lòng cập nhật trong Cài Đặt hệ thống.' };
  }

  const { publishArticle } = require('../routes/articles');
  const company = { url: article.company_url };
  const email = await (async () => {
    try {
      const r = await db.execute({ sql: 'SELECT u.email FROM keywords k LEFT JOIN users u ON k.createdBy = u.id WHERE k.id = ?', args: [article.keywordId] });
      return r.rows[0]?.email || '';
    } catch { return ''; }
  })();

  try {
    await publishArticle(article.id, article, company, apiUrl, email);
    return { success: true, article_id: article.id, title: article.title, message: `Đã đăng bài "${article.title}" thành công.` };
  } catch (e) {
    return { error: `Đăng bài thất bại: ${e.message}` };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL: delete_keyword
───────────────────────────────────────────────────────────────────────────── */
async function toolDeleteKeyword({ keyword_name, confirm = false }, user) {
  if (!keyword_name) return { error: 'Cần cung cấp tên từ khóa (keyword_name).' };

  const { keyword, error, ambiguous, options } = await resolveKeyword(keyword_name, user);
  if (error && !ambiguous) return { error };
  if (ambiguous) return { error, options };

  // Check số articles liên quan
  const articlesResult = await db.execute({
    sql: 'SELECT COUNT(*) as n FROM articles WHERE keywordId = ?',
    args: [keyword.id],
  });
  const articleCount = Number(articlesResult.rows[0]?.n || 0);

  if (articleCount > 0 && !confirm) {
    return {
      warning: true,
      article_count: articleCount,
      message: `Từ khóa "${keyword.keyword}" có ${articleCount} bài viết liên quan. Nếu muốn xóa, hãy xác nhận với confirm=true. Bài viết sẽ vẫn giữ nguyên nhưng mất liên kết từ khóa.`,
    };
  }

  await db.execute({ sql: 'DELETE FROM keywords WHERE id = ?', args: [keyword.id] });

  return {
    success: true,
    keyword: keyword.keyword,
    deleted_articles_linked: articleCount,
    message: `Đã xóa từ khóa "${keyword.keyword}" cùng ${articleCount} bài viết (bài viết không bị xóa).`,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   DISPATCHER
───────────────────────────────────────────────────────────────────────────── */
const TOOL_IMPLS = {
  create_company: toolCreateCompany,
  create_keywords: toolCreateKeywords,
  write_articles: toolWriteArticles,
  list_companies: toolListCompanies,
  list_keywords: toolListKeywords,
  get_stats: toolGetStats,
  list_articles: toolListArticles,
  get_keyword_detail: toolGetKeywordDetail,
  check_write_job: toolCheckWriteJob,
  analyze_website: toolAnalyzeWebsite,
  get_analysis_results: toolGetAnalysisResults,
  publish_article: toolPublishArticle,
  delete_keyword: toolDeleteKeyword,
};

async function executeTool(name, args, user) {
  const impl = TOOL_IMPLS[name];
  if (!impl) throw new Error(`Tool "${name}" không tồn tại.`);
  return impl(args, user);
}

module.exports = {
  TOOL_DECLARATIONS,
  executeTool,
};