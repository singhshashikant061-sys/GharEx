const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      ...extraHeaders
    }
  });

const getRequestStore = async (env) => {
  if (env.REQUESTS_KV) {
    const raw = await env.REQUESTS_KV.get("requests");
    return raw ? JSON.parse(raw) : [];
  }

  if (!globalThis.__gharex_requests) {
    globalThis.__gharex_requests = [];
  }

  return globalThis.__gharex_requests;
};

const isAdmin = (request, env) => {
  const adminKey = env.ADMIN_KEY || "change-this-admin-key";
  return request.headers.get("x-admin-key") === adminKey;
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return json({}, 204);
  }

  if (request.method !== "GET") {
    return json({ error: "API route not found" }, 404);
  }

  if (!isAdmin(request, env)) {
    return json({ error: "invalid admin key" }, 401);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const requestType = url.searchParams.get("type");

  const requests = (await getRequestStore(env)).filter((item) => {
    if (status && item.status !== status) return false;
    if (requestType && item.requestType !== requestType) return false;
    return true;
  });

  return json({ requests });
}
