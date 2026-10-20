const getStore = () => {
  if (!globalThis.__gharex_requests) {
    globalThis.__gharex_requests = [];
  }
  return globalThis.__gharex_requests;
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const adminKey = req.headers["x-admin-key"] || req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_KEY || "change-this-admin-key";

  if (adminKey !== expectedKey) {
    return res.status(401).json({ error: "invalid admin key" });
  }

  if (req.method !== "GET") {
    return res.status(404).json({ error: "API route not found" });
  }

  const url = new URL(req.url, "https://example.com");
  const status = url.searchParams.get("status");
  const requestType = url.searchParams.get("type");

  const requests = getStore().filter((item) => {
    if (status && item.status !== status) return false;
    if (requestType && item.requestType !== requestType) return false;
    return true;
  });

  return res.status(200).json({ requests });
}
