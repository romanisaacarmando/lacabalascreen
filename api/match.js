// Estado del partido manual — persiste mientras la función Vercel esté caliente
let manualMatch = null;

const PWD = process.env.ADMIN_PASSWORD || "cAbAlA2026";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.json({ ok: true, match: manualMatch });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (body.password !== PWD) {
      return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });
    }
    if (body.action === "clear") {
      manualMatch = null;
    } else {
      const { password, action, ...rest } = body;
      manualMatch = { ...rest, updatedAt: new Date().toISOString() };
    }
    return res.json({ ok: true, match: manualMatch });
  }

  return res.status(405).end();
}
