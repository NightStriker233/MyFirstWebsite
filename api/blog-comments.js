import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function initTable() {
  const client = await pool.connect();
  try {
    // 博客评论表
    await client.query(
      `CREATE TABLE IF NOT EXISTS blog_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        name VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_bc_post_id ON blog_comments (post_id, created_at)"
    );
    // 博客回复表
    await client.query(
      `CREATE TABLE IF NOT EXISTS blog_replies (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL REFERENCES blog_comments(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_br_comment_id ON blog_replies (comment_id, created_at)"
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
      const postId = parseInt(req.query?.post_id, 10);
      if (!postId || postId < 1) return res.status(400).json({ error: "缺少 post_id 参数" });
      const client = await pool.connect();
      try {
        const r = await client.query(
          `SELECT c.id, c.post_id, c.name, c.content, c.created_at,
            (SELECT COUNT(*) FROM blog_replies r WHERE r.comment_id = c.id)::int AS reply_count
           FROM blog_comments c
           WHERE c.post_id = $1
           ORDER BY c.created_at DESC
           LIMIT 100`,
          [postId]
        );
        return res.status(200).json({ comments: r.rows });
      } finally { client.release(); }
    }
    if (req.method === "POST") {
      const { post_id, name, content } = req.body || {};
      const pid = parseInt(post_id, 10);
      if (!pid || pid < 1) return res.status(400).json({ error: "缺少 post_id" });
      if (!name || !content) return res.status(400).json({ error: "请填写名字和评论内容" });
      const tn = name.trim().slice(0, 50), tc = content.trim().slice(0, 500);
      if (!tn || !tc) return res.status(400).json({ error: "内容不能为空" });
      const client = await pool.connect();
      try {
        const r = await client.query(
          "INSERT INTO blog_comments (post_id, name, content) VALUES ($1, $2, $3) RETURNING id, post_id, name, content, created_at",
          [pid, tn, tc]
        );
        return res.status(201).json({ comment: r.rows[0] });
      } finally { client.release(); }
    }
    return res.status(405).json({ error: "方法不允许" });
  } catch (err) {
    console.error("Blog Comments API Error:", err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
