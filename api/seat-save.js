// 座位表保存 API：按关键词保存/读取座位表
// GET  /api/seat-save?key=xxx  → 读取
// POST /api/seat-save {key, data} → 保存（upsert）
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function initTable() {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS seat_saves (" +
      "key VARCHAR(100) PRIMARY KEY, " +
      "data TEXT NOT NULL, " +
      "created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())"
    );
  } finally { client.release(); }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await initTable();

    if (req.method === "GET") {
      const key = (req.query.key || "").trim();
      if (!key) return res.status(400).json({ error: "缺少 key" });
      const r = await pool.query("SELECT data FROM seat_saves WHERE key = $1", [key]);
      if (r.rows.length === 0) return res.status(404).json({ error: "未找到该关键词的座位表" });
      return res.status(200).json({ data: JSON.parse(r.rows[0].data) });
    }

    if (req.method === "POST") {
      const { key, data } = req.body || {};
      if (!key || !data) return res.status(400).json({ error: "缺少 key 或 data" });
      const k = String(key).trim().slice(0, 100);
      if (!k) return res.status(400).json({ error: "key 不能为空" });
      await pool.query(
        "INSERT INTO seat_saves (key, data, created_at) VALUES ($1, $2, NOW()) " +
        "ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, created_at = NOW()",
        [k, JSON.stringify(data)]
      );
      return res.status(200).json({ ok: true, key: k });
    }

    return res.status(405).json({ error: "方法不允许" });
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
