require("dns").setDefaultResultOrder("ipv4first");

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "requests.json");

const allowedStatuses = new Set(["new", "contacted", "in_progress", "completed", "cancelled"]);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const ensureDataFile = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n");
};

const readRequests = () => {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
};

const writeRequests = (requests) => {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(requests, null, 2)}\n`);
};

const sendJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
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
    id: crypto.randomUUID(),
    requestType,
    status: "new",
    name: sanitizeText(payload.name),
    phone: sanitizeText(payload.phone),
    email: sanitizeText(payload.email),
    location: sanitizeText(payload.location),
    material: sanitizeText(payload.material),
    quantity,
    customerType: sanitizeText(payload.customerType),
    brickType: sanitizeText(payload.brickType),
    deliveryLocation: sanitizeText(payload.deliveryLocation),
    gst: sanitizeText(payload.gst),
    products: sanitizeText(payload.products),
    message: sanitizeText(payload.message),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!["buy", "sell", "quote"].includes(request.requestType)) {
    return { error: "requestType must be buy, sell, or quote" };
  }

  if (!request.name || !request.phone) {
    return { error: "name and phone are required" };
  }

  if ((request.requestType === "buy" || request.requestType === "quote") && quantity !== null && quantity < 3000) {
    return { error: "minimum quantity is 3000" };
  }

  return { request };
};

const isAdmin = (req) => req.headers["x-admin-key"] === ADMIN_KEY;

const handleRequestsRoute = async (req, res) => {
  if (req.method === "GET") {
    return sendJson(res, 200, { requests: readRequests() });
  }

  if (req.method === "POST") {
    const payload = await readBody(req);
    const { request, error } = buildRequest(payload);
    if (error) return sendJson(res, 400, { error });

    const requests = readRequests();
    requests.unshift(request);
    writeRequests(requests);
    return sendJson(res, 201, { request });
  }

  return sendJson(res, 404, { error: "API route not found" });
};

const handleApi = async (req, res, url) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (url.pathname === "/api/requests") {
    return handleRequestsRoute(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/admin/requests") {
    if (!isAdmin(req)) return sendJson(res, 401, { error: "invalid admin key" });

    const status = url.searchParams.get("status");
    const requestType = url.searchParams.get("type");
    let requests = readRequests();
    if (status) requests = requests.filter((request) => request.status === status);
    if (requestType) requests = requests.filter((request) => request.requestType === requestType);
    return sendJson(res, 200, { requests });
  }

  const statusMatch = url.pathname.match(/^\/api\/admin\/requests\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    if (!isAdmin(req)) return sendJson(res, 401, { error: "invalid admin key" });

    const payload = await readBody(req);
    const status = sanitizeText(payload.status);
    if (!allowedStatuses.has(status)) {
      return sendJson(res, 400, { error: "status must be new, contacted, in_progress, completed, or cancelled" });
    }

    const requests = readRequests();
    const request = requests.find((item) => item.id === statusMatch[1]);
    if (!request) return sendJson(res, 404, { error: "request not found" });

    request.status = status;
    request.updatedAt = new Date().toISOString();
    writeRequests(requests);
    return sendJson(res, 200, { request });
  }

  return sendJson(res, 404, { error: "API route not found" });
};

const serveStatic = (req, res, url) => {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(__dirname, requestedPath));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log("URL:", url.pathname, "METHOD:", req.method);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`GharEx server running at http://localhost:${PORT}`);
  console.log("Admin API key:", ADMIN_KEY);
});
