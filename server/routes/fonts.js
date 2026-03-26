const express = require('express');
const router = express.Router();

// In-memory cache: tránh gọi API quá nhiều lần
let cachedFonts = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 giờ

router.get('/', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_FONTS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'GOOGLE_FONTS_API_KEY chưa được cấu hình trong .env' });
    }

    // Trả cache nếu còn hạn
    if (cachedFonts && Date.now() - cacheTime < CACHE_TTL) {
      return res.json(cachedFonts);
    }

    const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Fonts API lỗi: ${response.status}`);
    }

    const data = await response.json();
    const fonts = (data.items || []).map(f => ({ family: f.family, category: f.category }));

    cachedFonts = { fonts };
    cacheTime = Date.now();

    res.json({ fonts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
