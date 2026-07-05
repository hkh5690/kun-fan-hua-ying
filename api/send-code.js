/**
 * /api/send-code — 发送邮箱验证码
 * 生成6位验证码，用 HMAC 签名打包成 token，尝试通过邮件发送
 */
const crypto = require('crypto');
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';

function signToken(payload) {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', SERVICE_ROLE_KEY).update(data).digest('hex');
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
    if (!email?.includes('@')) return res.status(400).json({ error: '邮箱格式不正确' });

    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效

    const token = signToken({ email, code, exp: expiresAt });

    // 尝试发送邮件，失败则返回 code（开发阶段可查看）
    let emailSent = false;
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: '鲲繁花影 <noreply@kunfanhuaying.click>',
          to: [email],
          subject: '鲲繁花影 — 邮箱验证码',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#2B579A">🌸 鲲繁花影</h2>
            <p>您的验证码是：</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1A3C6E;padding:20px;background:#F1F5F9;border-radius:12px;text-align:center;margin:16px 0">${code}</div>
            <p style="color:#64748B;font-size:13px">5分钟内有效，请勿泄露给他人。</p>
          </div>`,
        }),
      });
      emailSent = emailRes.ok;
    } catch {}

    return res.status(200).json({
      success: true,
      token,
      code: emailSent ? undefined : code, // 邮件发送失败时返回 code 供调试
      emailSent,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
