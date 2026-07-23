export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, content, created_at FROM messages ORDER BY created_at DESC LIMIT 100"
      ).all();
      return new Response(JSON.stringify({ messages: results }), { headers });
    }

    if (request.method === "POST") {
      const { name, content } = await request.json();
      if (!name || !content) {
        return new Response(JSON.stringify({ error: "请填写名字和留言内容" }), { status: 400, headers });
      }
      const tName = name.trim().slice(0, 50);
      const tContent = content.trim().slice(0, 500);
      if (!tName || !tContent) {
        return new Response(JSON.stringify({ error: "名字和留言内容不能为空" }), { status: 400, headers });
      }
      const result = await env.DB.prepare(
        "INSERT INTO messages (name, content) VALUES (?, ?) RETURNING id, name, content, created_at"
      ).bind(tName, tContent).first();
      return new Response(JSON.stringify({ message: result }), { status: 201, headers });
    }

    return new Response(JSON.stringify({ error: "方法不允许" }), { status: 405, headers });
  } catch (err) {
    console.error("API Error:", err.message);
    return new Response(JSON.stringify({ error: "服务器内部错误，请稍后再试" }), { status: 500, headers });
  }
}
