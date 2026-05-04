require("dns").setDefaultResultOrder("ipv4first");

const http = require("http");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 10000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";
const MONGODB_URI = process.env.MONGODB_URI;

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

const requestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: "" },
    requirement: { type: String, trim: true, default: "" },
    requestType: { type: String, enum: ["buy", "sell", "quote"], default: "quote" },
    status: { type: String, enum: [...allowedStatuses], default: "new" },
    email: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    material: { type: String, trim: true, default: "" },
    quantity: { type: Number, default: null },
    customerType: { type: String, trim: true, default: "" },
    brickType: { type: String, trim: true, default: "" },
    deliveryLocation: { type: String, trim: true, default: "" },
    gst: { type: String, trim: true, default: "" },
    products: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

const Request = mongoose.model("Request", requestSchema);

const connectMongo = async () => {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(MONGODB_URI);
};

const formatRequest = (request) => {
  const item = request.toObject ? request.toObject() : request;
  const { _id, __v, ...rest } = item;
  return {
    id: String(_id),
    ...rest,
    createdAt: rest.createdAt instanceof Date ? rest.createdAt.toISOString() : rest.createdAt,
    updatedAt: rest.updatedAt instanceof Date ? rest.updatedAt.toISOString() : rest.updatedAt
  };
};

const getRequests = async (filters = {}) => {
  await connectMongo();
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.requestType) query.requestType = filters.requestType;

  const requests = await Request.find(query).sort({ createdAt: -1 }).lean();
  return requests.map(formatRequest);
};

const saveRequest = async (request) => {
  await connectMongo();
  const savedRequest = await Request.create(request);
  return formatRequest(savedRequest);
};

const updateRequestStatus = async (id, status) => {
  await connectMongo();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const request = await Request.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  return request ? formatRequest(request) : null;
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
    return sendJson(res, 200, { requests: await getRequests() });
  }

  if (req.method === "POST") {
    const payload = await readBody(req);
    const { request, error } = buildRequest(payload);
    if (error) return sendJson(res, 400, { error });

    const savedRequest = await saveRequest(request);
    return sendJson(res, 201, { request: savedRequest });
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
    const requests = await getRequests({ status, requestType });
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

    const request = await updateRequestStatus(statusMatch[1], status);
    if (!request) return sendJson(res, 404, { error: "request not found" });

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
  console.log(`Server running on port ${PORT}`);
});
