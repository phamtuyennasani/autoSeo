const axios = require('axios');

// Đọc và parse danh sách key từ env (hỗ trợ nhiều key cách nhau bởi dấu phẩy)
function getKeys() {
  const raw = process.env.SERPAPI_API_KEY || '';
  return raw.split(',').map(k => k.trim()).filter(Boolean);
}

/**
 * Mỗi lần gọi chọn ngẫu nhiên 1 key để phân tải đều.
 * Trả về string kết quả tìm kiếm, hoặc null nếu không có key / lỗi.
 */
async function getSearchContext(keyword) {
  const keys = getKeys();

  if (keys.length === 0) {
    console.log('[SERP] Không có SERPAPI_API_KEY — AI sẽ tự sinh tiêu đề.');
    return null;
  }

  // Xáo trộn thứ tự keys để thử lần lượt theo random, không lặp lại key cũ
  const shuffled = [...keys].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < shuffled.length; attempt++) {
    const key = shuffled[attempt];
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: { engine: 'google', q: keyword, hl: 'vi', gl: 'vn', num: 5, api_key: key },
      });
      const organicResults = response.data.organic_results || [];
      return organicResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n') || null;
    } catch (error) {
      console.warn(`[SERP] key[${attempt + 1}/${shuffled.length}] lỗi: ${error.message}${attempt + 1 < shuffled.length ? ' — thử key khác.' : ' — hết key.'}`);
    }
  }

  console.error('[SERP] Tất cả key đều thất bại — AI sẽ tự sinh tiêu đề.');
  return null;
}

module.exports = { getSearchContext };
