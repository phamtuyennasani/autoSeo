const axios = require('axios');
require('dotenv').config();

// Trả về string kết quả tìm kiếm, hoặc null nếu không có key / lỗi
async function getSearchContext(keyword) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.log('[SERP] Không có SERPAPI_API_KEY — AI sẽ tự sinh tiêu đề.');
    return null;
  }

  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google', q: keyword, hl: 'vi', gl: 'vn', num: 5, api_key: apiKey }
    });
    const organicResults = response.data.organic_results || [];
    return organicResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n') || null;
  } catch (error) {
    console.error('[SERP] Lỗi:', error.message, '— AI sẽ tự sinh tiêu đề.');
    return null;
  }
}

module.exports = { getSearchContext };
