-- 在 Vercel Postgres 控制台中运行此 SQL
-- 打开 Vercel 项目 → Storage → 你的数据库 → Query 标签页
-- 粘贴并运行

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以按时间倒序查询
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
