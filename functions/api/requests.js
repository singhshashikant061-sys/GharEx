const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      ...extraHeaders
    }
  });

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
    requirement: sanitizeText(
      payload.requirement || payload.material || payload.brickType || payload.products || payload.message || requestType
    ),
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

const getRequestStore = async (env) => {
  if (!env.REQUESTS_KV) {
    return [];
  }

  const raw = await env.REQUESTS_KV.get("requests");
  return raw ? JSON.parse(raw) : [];
};

const saveRequestStore = async (env, requests) => {
  if (env.REQUESTS_KV) {
    await env.REQUESTS_KV.put("requests", JSON.stringify(requests));
  }
};

const getBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return json({}, 204);
  }

  if (request.method === "GET") {
    const url = new URL(request.url);
    const status = sanitizeText(url.searchParams.get("status"));
    const requestType = sanitizeText(url.searchParams.get("type"));
    const store = await getRequestStore(env);

    const requests = store.filter((item) => {
      if (status && item.status !== status) return false;
      if (requestType && item.requestType !== requestType) return false;
      return true;
    });

    return json({ requests });
  }

  if (request.method === "POST") {
    const payload = await getBody(request);
    const built = buildRequest(payload);

    if (built.error) {
      return json({ error: built.error }, 400);
    }

    const requests = await getRequestStore(env);
    const now = new Date().toISOString();
    const created = {
      id: crypto.randomUUID(),
      ...built.request,
      createdAt: now,
      updatedAt: now
    };

    requests.unshift(created);
    await saveRequestStore(env, requests);

    return json({ request: created }, 201);
  }

  return json({ error: "API route not found" }, 404);
}
