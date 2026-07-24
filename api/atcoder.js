export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  try {
    const r = await fetch("https://atcoder.jp/users/HACKER_ljp_/history/json");
    if (!r.ok) return res.status(502).json({ error: "AtCoder fetch failed" });
    const history = await r.json();
    const last = history[history.length - 1];
    res.status(200).json({
      rating: last.NewRating,
      handle: "HACKER_ljp_",
      rank: ratingToColor(last.NewRating),
      color: ratingToHex(last.NewRating)
    });
  } catch (e) {
    res.status(500).json({ error: "Internal error" });
  }
}

function ratingToColor(r) {
  if (r < 400) return "灰";
  if (r < 800) return "棕";
  if (r < 1200) return "绿";
  if (r < 1600) return "水";
  if (r < 2000) return "蓝";
  if (r < 2400) return "黄";
  if (r < 2800) return "橙";
  return "红";
}

function ratingToHex(r) {
  if (r < 400) return "#808080";
  if (r < 800) return "#804000";
  if (r < 1200) return "#008000";
  if (r < 1600) return "#00C0C0";
  if (r < 2000) return "#0000FF";
  if (r < 2400) return "#C0C000";
  if (r < 2800) return "#FF8000";
  return "#FF0000";
}
