const axios = require('axios');
require('dotenv').config();

async function getSearchContext(keyword) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
      console.warn("SERPAPI_API_KEY is not configured. Skipping SerpAPI search context.");
      return "Không có dữ liệu SerpAPI.";
  }

  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: keyword,
        hl: 'vi',
        gl: 'vn',
        num: 5,
        api_key: apiKey
      }
    });

    const organicResults = response.data.organic_results || [];
    const searchContext = organicResults.map(res => `- ${res.title}: ${res.snippet}`).join('\n');
    return searchContext;
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu SerpAPI:", error.message);
    return "Lỗi SerpAPI, sử dụng kiến thức AI.";
  }
}

module.exports = { getSearchContext };
