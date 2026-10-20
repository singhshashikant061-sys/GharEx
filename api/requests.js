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

const getStore = () => {
  if (!globalThis.__gharex_requests) {
    globalThis.__gharex_requests = [];
  }
  return globalThis.__gharex_requests;
};

const sanitizeText = (value) => (typeof value === "string" ? value.trim() : "");
const sanitizeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildRequest = (payload) => {
  const requestType = sanitizeText(payload.requestType || payload.type || "quote");
  const quantity = sanitizeNumber(payload.quantity);
  const request = {
    requestType,
    status: "new",
    name: sanitizeText(payload.name),
    phone: sanitizeText(payload.phone),
    address: sanitizeText(payload.address || payload.location || payload.deliveryLocation),
    requirement: sanitizeText(payload.requirement || payload.material || payload.brickType || payload.products || payload.message || requestType),
    email: sanitizeText(payload.email),
    location: sanitizeText(payload.location),
    material: sanitizeText(payload.material),
    quantity,
    customerType: sanitizeText(payload.customerType),
    brickType: sanitizeText(payload.brickType),
    deliveryLocation: sanitizeText(payload.deliveryLocation),
    gst: sanitizeText(payload.gst),
    products: sanitizeText(payload.products),
    message: sanitizeText(payload.message)
  };

  if (!["buy", "sell", "quote"].includes(request.requestType)) {
    return { error: "requestType must be buy, sell, or quote" };
  }

  if (!request.name) {
    return { error: "name is required" };
  }

  if ((request.requestType === "buy" || request.requestType === "quote") && quantity !== null && quantity < 3000) {
    return { error: "minimum quantity is 3000" };
  }

  return { request };
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "https://example.com");
    const status = sanitizeText(url.searchParams.get("status"));
    const requestType = sanitizeText(url.searchParams.get("type"));
    const requests = getStore().filter((item) => {
      if (status && item.status !== status) return false;
      if (requestType && item.requestType !== requestType) return false;
      return true;
    });

    return res.status(200).json({ requests });
  }

  if (req.method === "POST") {
    const payload = await readBody(req);
    const built = buildRequest(payload);

    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    const store = getStore();
    const now = new Date().toISOString();
    const created = {
      id: crypto.randomUUID(),
      ...built.request,
      createdAt: now,
      updatedAt: now
    };

    store.unshift(created);
    return res.status(201).json({ request: created });
  }

  return res.status(404).json({ error: "API route not found" });
}
