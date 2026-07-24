import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function initTable() {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS clips (id SERIAL PRIMARY KEY, code VARCHAR(10) UNIQUE NOT NULL, content TEXT NOT NULL, burn_after_read BOOLEAN DEFAULT false, expires_at TIMESTAMP WITH TIME ZONE, view_count INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())"
    );
  } finally { client.release(); }
}

function genCode() {
  return crypto.randomBytes(4).toString("hex"); // 8 位 hex
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await initTable();

    // GET: 查看剪切板内容（API 返回 JSON，供前端用 / 直接访问返回 HTML）
    if (req.method === "GET") {
      const code = req.query?.code;
      if (!code) return res.status(400).json({ error: "缺少 code 参数" });
      const client = await pool.connect();
      try {
        const r = await client.query(
          "SELECT id, code, content, burn_after_read, expires_at, view_count, created_at FROM clips WHERE code = $1",
          [code]
        );
        if (r.rows.length === 0) {
          return res.status(404).send(wrapHTML("404", "<h2>🔗 链接不存在或已过期</h2><p>该剪切板内容可能已被删除。</p>"));
        }
        const clip = r.rows[0];
        // 检查过期
        if (clip.expires_at && new Date(clip.expires_at) < new Date()) {
          await client.query("DELETE FROM clips WHERE id = $1", [clip.id]);
          return res.status(410).send(wrapHTML("已过期", "<h2>⏰ 内容已过期</h2><p>该剪切板已超过有效期。</p>"));
        }
        // 更新浏览量
        await client.query("UPDATE clips SET view_count = view_count + 1 WHERE id = $1", [clip.id]);
        // 阅后即焚
        if (clip.burn_after_read) {
          await client.query("DELETE FROM clips WHERE id = $1", [clip.id]);
        }
        // 返回 HTML 页面
        const burnNote = clip.burn_after_read ? '<p style="color:#DC2626;font-size:0.85rem">⚠️ 此内容已被删除（阅后即焚）</p>' : '';
        return res.status(200).send(wrapHTML("剪切板 - " + code, `
          <pre style="background:#FAFAF9;padding:24px;border-radius:8px;font-size:0.95rem;line-height:1.8;white-space:pre-wrap;word-break:break-all;border:1px solid #E8E4E0">${escapeHtml(clip.content)}</pre>
          <p style="color:#94A3B8;font-size:0.8rem;margin-top:12px">${clip.view_count + 1} 次浏览 · 创建于 ${new Date(clip.created_at).toLocaleString("zh-CN")}</p>
          ${burnNote}
        `));
      } finally { client.release(); }
    }

    // POST: 创建剪切板
    if (req.method === "POST") {
      const { content, burn_after_read, expire_hours } = req.body || {};
      if (!content || !content.trim()) return res.status(400).json({ error: "内容不能为空" });
      const tc = content.trim().slice(0, 50000); // 最大 50KB
      const burn = !!burn_after_read;
      const expires = expire_hours ? new Date(Date.now() + expire_hours * 3600000).toISOString() : null;
      const code = genCode();
      const client = await pool.connect();
      try {
        await client.query(
          "INSERT INTO clips (code, content, burn_after_read, expires_at) VALUES ($1, $2, $3, $4)",
          [code, tc, burn, expires]
        );
        return res.status(201).json({ code, url: "/api/clips?code=" + code, burn_after_read: burn });
      } finally { client.release(); }
    }

    return res.status(405).json({ error: "方法不允许" });
  } catch (err) {
    console.error("Clips API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapHTML(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body style="background:#FAFAF9;min-height:100vh;display:flex;align-items:center;justify-content:center">
  <div style="max-width:700px;width:90%;background:#fff;border:1px solid #E8E4E0;border-radius:8px;padding:40px">
    ${body}
    <p style="margin-top:24px"><a href="/tools.html" style="color:#1E293B">← 返回工具箱</a></p>
  </div>
</body>
</html>`;
}
