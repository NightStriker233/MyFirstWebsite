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
      "CREATE TABLE IF NOT EXISTS site_stats (id SERIAL PRIMARY KEY, path VARCHAR(200) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())"
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
      const client = await pool.connect();
      try {
        const r = await client.query("SELECT COUNT(*)::int AS total FROM site_stats");
        return res.status(200).json({ total: r.rows[0]?.total || 0 });
      } finally { client.release(); }
    }
    if (req.method === "POST") {
      const path = (req.body?.path || '/').slice(0, 200);
      const client = await pool.connect();
      try {
        await client.query("INSERT INTO site_stats (path) VALUES ($1)", [path]);
        const r = await client.query("SELECT COUNT(*)::int AS total FROM site_stats");
        return res.status(201).json({ total: r.rows[0]?.total || 0 });
      } finally { client.release(); }
    }
    return res.status(405).json({ error: "方法不允许" });
  } catch (err) {
    console.error("Stats API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
