import { sql } from '@vercel/postgres';

// 自动建表（只在表不存在时执行）
async function initTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC)
  `;
}

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 确保表已创建
    await initTable();

    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT id, name, content, created_at
        FROM messages
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return res.status(200).json({ messages: rows });
    }

    if (req.method === 'POST') {
      const { name, content } = req.body || {};
      if (!name || !content) {
        return res.status(400).json({ error: '请填写名字和留言内容' });
      }

      const trimmedName = name.trim().slice(0, 50);
      const trimmedContent = content.trim().slice(0, 500);

      if (!trimmedName || !trimmedContent) {
        return res.status(400).json({ error: '名字和留言内容不能为空' });
      }

      const { rows } = await sql`
        INSERT INTO messages (name, content)
        VALUES (${trimmedName}, ${trimmedContent})
        RETURNING id, name, content, created_at
      `;

      return res.status(201).json({ message: rows[0] });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: '服务器内部错误，请稍后再试' });
  }
}
