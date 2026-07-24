import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const BLOG_PASSWORD = process.env.BLOG_PASSWORD || "110206";

async function initTable() {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC)"
    );
  } finally { client.release(); }
}

function checkAuth(req) {
  const pw = req.body?.password || req.query?.password || "";
  return pw === BLOG_PASSWORD;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    await initTable();

    // GET：无需密码
    if (req.method === "GET") {
      const id = parseInt(req.query?.id, 10);
      const client = await pool.connect();
      try {
        if (id && id > 0) {
          const r = await client.query("SELECT id, title, content, created_at, updated_at FROM posts WHERE id = $1", [id]);
          if (r.rows.length === 0) return res.status(404).json({ error: "文章不存在" });
          return res.status(200).json({ post: r.rows[0] });
        }
        const r = await client.query("SELECT id, title, LEFT(content, 200) AS excerpt, created_at FROM posts ORDER BY created_at DESC LIMIT 50");
        return res.status(200).json({ posts: r.rows });
      } finally { client.release(); }
    }

    // 以下操作需要密码
    if (!checkAuth(req)) return res.status(401).json({ error: "密码错误" });

    // POST：创建文章
    if (req.method === "POST") {
      const { title, content } = req.body || {};
      if (!title || !content) return res.status(400).json({ error: "请填写标题和内容" });
      const tt = title.trim().slice(0, 200), tc = content.trim();
      if (!tt || !tc) return res.status(400).json({ error: "内容不能为空" });
      const client = await pool.connect();
      try {
        const r = await client.query(
          "INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING id, title, content, created_at",
          [tt, tc]
        );
        return res.status(201).json({ post: r.rows[0] });
      } finally { client.release(); }
    }

    // PUT：更新文章
    if (req.method === "PUT") {
      const { id, title, content } = req.body || {};
      const pid = parseInt(id, 10);
      if (!pid || pid < 1) return res.status(400).json({ error: "缺少文章 id" });
      if (!title || !content) return res.status(400).json({ error: "请填写标题和内容" });
      const tt = title.trim().slice(0, 200), tc = content.trim();
      if (!tt || !tc) return res.status(400).json({ error: "内容不能为空" });
      const client = await pool.connect();
      try {
        const r = await client.query(
          "UPDATE posts SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING id, title, content, created_at, updated_at",
          [tt, tc, pid]
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "文章不存在" });
        return res.status(200).json({ post: r.rows[0] });
      } finally { client.release(); }
    }

    // DELETE：删除文章
    if (req.method === "DELETE") {
      const id = parseInt(req.body?.id || req.query?.id, 10);
      if (!id || id < 1) return res.status(400).json({ error: "缺少文章 id" });
      const client = await pool.connect();
      try {
        const r = await client.query("DELETE FROM posts WHERE id = $1 RETURNING id", [id]);
        if (r.rows.length === 0) return res.status(404).json({ error: "文章不存在" });
        return res.status(200).json({ deleted: true });
      } finally { client.release(); }
    }

    return res.status(405).json({ error: "方法不允许" });
  } catch (err) {
    console.error("Posts API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
