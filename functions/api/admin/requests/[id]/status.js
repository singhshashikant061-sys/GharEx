const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
      "Access-Control-Allow-Methods": "PATCH, OPTIONS",
      ...extraHeaders
    }
  });

const allowedStatuses = new Set(["new", "contacted", "in_progress", "completed", "cancelled"]);

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

const isAdmin = (request, env) => {
  const adminKey = env.ADMIN_KEY || "change-this-admin-key";
  return request.headers.get("x-admin-key") === adminKey;
};

export async function onRequest({ request, env, params }) {
  if (request.method === "OPTIONS") {
    return json({}, 204);
  }

  if (!isAdmin(request, env)) {
    return json({ error: "invalid admin key" }, 401);
  }

  if (request.method !== "PATCH") {
    return json({ error: "API route not found" }, 404);
  }

  const requestId = params.id;
  const payload = await request.json().catch(() => ({}));
  const status = String(payload.status || "").trim();

  if (!allowedStatuses.has(status)) {
    return json({ error: "status must be new, contacted, in_progress, completed, or cancelled" }, 400);
  }

  const requests = await getRequestStore(env);
  const index = requests.findIndex((item) => item.id === requestId);

  if (index === -1) {
    return json({ error: "request not found" }, 404);
  }

  requests[index].status = status;
  requests[index].updatedAt = new Date().toISOString();
  await saveRequestStore(env, requests);

  return json({ request: requests[index] }, 200);
}
