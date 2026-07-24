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
      "CREATE TABLE IF NOT EXISTS replies (id SERIAL PRIMARY KEY, message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, name VARCHAR(50) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_replies_message_id ON replies (message_id, created_at)"
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
      const messageId = parseInt(req.query?.message_id, 10);
      if (!messageId || messageId < 1) return res.status(400).json({ error: "缺少 message_id 参数" });
      const client = await pool.connect();
      try {
        const r = await client.query(
          "SELECT id, message_id, name, content, created_at FROM replies WHERE message_id = $1 ORDER BY created_at ASC LIMIT 50",
          [messageId]
        );
        return res.status(200).json({ replies: r.rows });
      } finally { client.release(); }
    }
    if (req.method === "POST") {
      const { message_id, name, content } = req.body || {};
      const mid = parseInt(message_id, 10);
      if (!mid || mid < 1) return res.status(400).json({ error: "缺少 message_id" });
      if (!name || !content) return res.status(400).json({ error: "请填写名字和回复内容" });
      const tn = name.trim().slice(0, 50), tc = content.trim().slice(0, 300);
      if (!tn || !tc) return res.status(400).json({ error: "内容不能为空" });
      const client = await pool.connect();
      try {
        const r = await client.query(
          "INSERT INTO replies (message_id, name, content) VALUES ($1, $2, $3) RETURNING id, message_id, name, content, created_at",
          [mid, tn, tc]
        );
        return res.status(201).json({ reply: r.rows[0] });
      } finally { client.release(); }
    }
    return res.status(405).json({ error: "方法不允许" });
  } catch (err) {
    console.error("Replies API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
