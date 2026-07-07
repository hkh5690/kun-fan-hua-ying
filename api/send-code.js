/**
 * /api/send-code — send verification code via email (Resend)
 */
const crypto = require('crypto');

// 使用独立的 HMAC 密钥（不要用 service_role JWT）
const HMAC_KEY = process.env.VERIFY_HMAC_KEY || crypto.randomBytes(32).toString('hex');

function signToken(payload) {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', HMAC_KEY).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, hmac })).toString('base64url');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body || {};
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const token = signToken({ email, code, exp: expiresAt });

    let emailSent = false;
    let emailError = null;

    try {
      const RESEND_KEY = process.env.RESEND_API_KEY || '';
      if (!RESEND_KEY) {
        emailError = 'RESEND_API_KEY 未配置';
      } else {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'noreply@kunfanhuaying.click',
            to: [email],
            subject: '鲲繁花影 - 邮箱验证码',
            html: '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px"><h2 style="color:#2B579A">🌸 鲲繁花影</h2><p>您的验证码是：</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1A3C6E;padding:20px;background:#F1F5F9;border-radius:12px;text-align:center;margin:16px 0">' + code + '</div><p style="color:#64748B;font-size:13px">5分钟内有效，请勿泄露给他人。</p></div>',
          }),
        });
        emailSent = emailRes.ok;
        if (!emailSent) { const b = await emailRes.text(); emailError = b.substring(0, 200); }
      }
    } catch (e) { emailError = e.message; }

    if (emailSent) {
      return res.status(200).json({ success: true, token, emailSent: true });
    }
    // 邮件发送失败时不返回验证码（安全：防止绕过邮箱验证）
    return res.status(200).json({ success: true, token, emailSent: false, emailError });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
