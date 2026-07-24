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
      "CREATE TABLE IF NOT EXISTS likes (id SERIAL PRIMARY KEY, message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, ip_address VARCHAR(45) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(message_id, ip_address))"
    );
  } finally { client.release(); }
}

function getClientIP(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.headers["x-real-ip"]
    || req.socket?.remoteAddress
    || "0.0.0.0";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "方法不允许" });
  try {
    await initTable();
    const { message_id } = req.body || {};
    const mid = parseInt(message_id, 10);
    if (!mid || mid < 1) return res.status(400).json({ error: "缺少 message_id" });

    const ip = getClientIP(req);
    const client = await pool.connect();
    try {
      // 检查是否已点赞
      const existing = await client.query(
        "SELECT id FROM likes WHERE message_id = $1 AND ip_address = $2",
        [mid, ip]
      );
      if (existing.rows.length > 0) {
        // 已点赞 → 取消赞
        await client.query("DELETE FROM likes WHERE message_id = $1 AND ip_address = $2", [mid, ip]);
        await client.query("UPDATE messages SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1", [mid]);
        const updated = await client.query("SELECT like_count FROM messages WHERE id = $1", [mid]);
        return res.status(200).json({ liked: false, like_count: updated.rows[0]?.like_count ?? 0 });
      }
      // 未点赞 → 点赞
      await client.query(
        "INSERT INTO likes (message_id, ip_address) VALUES ($1, $2)",
        [mid, ip]
      );
      await client.query("UPDATE messages SET like_count = like_count + 1 WHERE id = $1", [mid]);
      const updated = await client.query("SELECT like_count FROM messages WHERE id = $1", [mid]);
      return res.status(201).json({ liked: true, like_count: updated.rows[0]?.like_count ?? 1 });
    } finally { client.release(); }
  } catch (err) {
    // 唯一约束冲突 → 已点赞（并发情况）
    if (err.code === "23505") {
      return res.status(200).json({ liked: true, like_count: null, note: "already liked" });
    }
    console.error("Likes API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
