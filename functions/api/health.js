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

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return json({}, 204);
  }

  return json({ ok: true, storage: env.REQUESTS_KV ? "kv" : "memory" }, 200);
}
