-- 在 Cloudflare D1 控制台中运行此 SQL
-- 进入 Cloudflare 仪表盘 → Workers & Pages → D1 → 你的数据库 → Query

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
