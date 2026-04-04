const crypto = require('crypto');
function stripDots(email) {
  const [local, domain] = email.split('@');
  return local.replace(/\./g, '') + '@' + domain;
}
function createNasaniToken(timestamp) {
  const secret = process.env.NASANI_API_SECRET;
  if (!secret) throw new Error('NASANI_API_SECRET chưa được cấu hình trong .env');
  return crypto.createHmac('sha256', secret).update(timestamp.toString()).digest('base64');
}
module.exports = { stripDots, createNasaniToken };