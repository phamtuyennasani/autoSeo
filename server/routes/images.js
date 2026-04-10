/**
 * routes/images.js — API tạo ảnh thumbnail bằng Imagen 4 Fast.
 *
 * POST /api/images/thumbnail
 *   Body: { prompt, aspectRatio?, articleId? }
 *   → { dataUrl, cost }
 *
 * Chưa được gọi tự động — dùng khi người dùng chủ động bấm "Tạo ảnh đại diện".
 */

const express = require('express');
const router  = express.Router();
const { generateThumbnailDataUrl } = require('../services/imageGeneration');
const { getEffectiveApiConfig }    = require('../services/apiConfig');

// POST /api/images/thumbnail
router.post('/thumbnail', async (req, res) => {
  const { prompt, aspectRatio = '16:9', articleId } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt không được để trống.' });
  }

  try {
    const userId = req.user?.id;
    const config = await getEffectiveApiConfig(userId);
    if (config.blocked) {
      return res.status(403).json({ error: config.message || 'Bạn chưa có API key.', type: 'no_api_key' });
    }
    const apiKey = config.apiKey;

    const { dataUrl, cost } = await generateThumbnailDataUrl(prompt, { apiKey, aspectRatio });

    res.json({ dataUrl, cost, articleId: articleId || null });
  } catch (err) {
    console.error('[images] generateThumbnail lỗi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
