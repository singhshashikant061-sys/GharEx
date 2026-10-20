const allowedStatuses = new Set(["new", "contacted", "in_progress", "completed", "cancelled"]);

const getStore = () => {
  if (!globalThis.__gharex_requests) {
    globalThis.__gharex_requests = [];
  }
  return globalThis.__gharex_requests;
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (!chunks.length) return {};

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  res.setHeader("Access-Control-Allow-Methods", "PATCH, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const adminKey = req.headers["x-admin-key"] || req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_KEY || "change-this-admin-key";

  if (adminKey !== expectedKey) {
    return res.status(401).json({ error: "invalid admin key" });
  }

  if (req.method !== "PATCH") {
    return res.status(404).json({ error: "API route not found" });
  }

  const payload = await readBody(req);
  const status = String(payload.status || "").trim();

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ error: "status must be new, contacted, in_progress, completed, or cancelled" });
  }

  const store = getStore();
  const request = store.find((item) => item.id === req.query.id);

  if (!request) {
    return res.status(404).json({ error: "request not found" });
  }

  request.status = status;
  request.updatedAt = new Date().toISOString();

  return res.status(200).json({ request });
}
