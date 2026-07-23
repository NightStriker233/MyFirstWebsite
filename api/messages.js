import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function initTable() {
  const client = await pool.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())");
    await client.query("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC)");
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
      const client = await pool.connect();
      try {
        const r = await client.query("SELECT id, name, content, created_at FROM messages ORDER BY created_at DESC LIMIT 100");
        return res.status(200).json({ messages: r.rows });
      } finally { client.release(); }
    }
    if (req.method === "POST") {
      const { name, content } = req.body || {};
      if (!name || !content) return res.status(400).json({ error: "请填写名字和留言内容" });
      const tn = name.trim().slice(0, 50), tc = content.trim().slice(0, 500);
      if (!tn || !tc) return res.status(400).json({ error: "内容不能为空" });
      const client = await pool.connect();
      try {
        const r = await client.query("INSERT INTO messages (name, content) VALUES ($1, $2) RETURNING id, name, content, created_at", [tn, tc]);
        return res.status(201).json({ message: r.rows[0] });
      } finally { client.release(); }
    }
    return res.status(405).json({ error: "方法不允许" });
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}