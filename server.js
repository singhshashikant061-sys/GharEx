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
    phone: { type: String, trim: true, default: "" },
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

const manufacturerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    brickPricePerPiece: { type: Number, required: true },
    availableBrickTypes: { type: [String], default: [] },
    minimumOrderQuantity: { type: Number, default: 3000 },
    truckCapacity: { type: Number, default: 6000 },
    isVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const Manufacturer = mongoose.model("Manufacturer", manufacturerSchema);

const fallbackManufacturers = [
  {
    name: "Guddu Singh Bricks",
    phone: "+91 84097 34846",
    address: "Industrial Area, Mohali",
    city: "Mohali",
    pincode: "160062",
    latitude: 30.7046,
    longitude: 76.7179,
    brickPricePerPiece: 8.4,
    availableBrickTypes: ["Red Clay Bricks"],
    minimumOrderQuantity: 3000,
    truckCapacity: 6000,
    isVerified: true
  },
  {
    name: "Chandigarh Brick Works",
    phone: "+91 84097 34846",
    address: "Near Transport Chowk, Chandigarh",
    city: "Chandigarh",
    pincode: "160017",
    latitude: 30.7333,
    longitude: 76.7794,
    brickPricePerPiece: 7.6,
    availableBrickTypes: ["Red Clay Bricks"],
    minimumOrderQuantity: 3000,
    truckCapacity: 6000,
    isVerified: true
  },
  {
    name: "Punjab Construction Bricks",
    phone: "+91 84097 34846",
    address: "Kharar Landran Road",
    city: "Kharar",
    pincode: "140301",
    latitude: 30.7463,
    longitude: 76.6469,
    brickPricePerPiece: 8.9,
    availableBrickTypes: ["Red Clay Bricks"],
    minimumOrderQuantity: 3000,
    truckCapacity: 7000,
    isVerified: true
  },
  {
    name: "Tricity Brick Suppliers",
    phone: "+91 84097 34846",
    address: "Patiala Road, Zirakpur",
    city: "Zirakpur",
    pincode: "140603",
    latitude: 30.6425,
    longitude: 76.8173,
    brickPricePerPiece: 9.2,
    availableBrickTypes: ["Red Clay Bricks"],
    minimumOrderQuantity: 3000,
    truckCapacity: 6000,
    isVerified: true
  }
];

const connectMongo = async () => {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(MONGODB_URI);
};

const localRequests = [];

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
  if (!MONGODB_URI) {
    return localRequests.filter((request) => {
      if (filters.status && request.status !== filters.status) return false;
      if (filters.requestType && request.requestType !== filters.requestType) return false;
      return true;
    });
  }

  await connectMongo();
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.requestType) query.requestType = filters.requestType;

  const requests = await Request.find(query).sort({ createdAt: -1 }).lean();
  return requests.map(formatRequest);
};

const saveRequest = async (request) => {
  if (!MONGODB_URI) {
    const now = new Date().toISOString();
    const savedRequest = {
      id: `${Date.now()}-${localRequests.length + 1}`,
      ...request,
      createdAt: now,
      updatedAt: now
    };

    localRequests.unshift(savedRequest);
    return savedRequest;
  }

  await connectMongo();
  const savedRequest = await Request.create(request);
  return formatRequest(savedRequest);
};

const updateRequestStatus = async (id, status) => {
  if (!MONGODB_URI) {
    const request = localRequests.find((item) => item.id === id);
    if (!request) return null;

    request.status = status;
    request.updatedAt = new Date().toISOString();
    return request;
  }

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

const toRadians = (degrees) => degrees * (Math.PI / 180);

// Reusable straight-line distance helper for delivery estimates.
const calculateDistanceKm = (fromLat, fromLng, toLat, toLng) => {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(toLat - fromLat);
  const lngDistance = toRadians(toLng - fromLng);
  const startLat = toRadians(fromLat);
  const endLat = toRadians(toLat);

  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDistance / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const calculateTransportCost = (distanceKm, quantity) => {
  let deliveryCostPerThousand;

  if (distanceKm <= 20) {
    deliveryCostPerThousand = 1500;
  } else if (distanceKm <= 50) {
    deliveryCostPerThousand = distanceKm * 60;
  } else if (distanceKm <= 100) {
    deliveryCostPerThousand = distanceKm * 55;
  } else {
    deliveryCostPerThousand = distanceKm * 50;
  }

  const loadingUnloading = 1000;
  const bufferCharge = 500;
  const deliveryCost = deliveryCostPerThousand * (quantity / 1000);
  const totalTransportCost = deliveryCost + loadingUnloading + bufferCharge;

  return {
    totalTransportCost,
    deliveryCostPerBrick: totalTransportCost / quantity
  };
};

const getVerifiedManufacturers = async () => {
  if (!MONGODB_URI) return fallbackManufacturers;

  await connectMongo();
  const manufacturers = await Manufacturer.find({ isVerified: true }).lean();
  return manufacturers.length ? manufacturers : fallbackManufacturers;
};

const buildNearbyManufacturerResult = (manufacturer, customerLat, customerLng, quantity) => {
  const distanceKm = calculateDistanceKm(
    customerLat,
    customerLng,
    manufacturer.latitude,
    manufacturer.longitude
  );
  const { totalTransportCost, deliveryCostPerBrick } = calculateTransportCost(distanceKm, quantity);
  const finalDeliveredPricePerBrick = manufacturer.brickPricePerPiece + deliveryCostPerBrick;

  return {
    name: manufacturer.name,
    city: manufacturer.city,
    address: manufacturer.address,
    distanceKm: Number(distanceKm.toFixed(2)),
    brickPricePerPiece: Number(manufacturer.brickPricePerPiece.toFixed(2)),
    totalTransportCost: Math.round(totalTransportCost),
    deliveryCostPerBrick: Number(deliveryCostPerBrick.toFixed(2)),
    finalDeliveredPricePerBrick: Number(finalDeliveredPricePerBrick.toFixed(2)),
    minimumOrderQuantity: manufacturer.minimumOrderQuantity,
    isVerified: Boolean(manufacturer.isVerified)
  };
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

const handleNearbyManufacturersRoute = async (req, res, url) => {
  if (req.method !== "GET") {
    return sendJson(res, 404, { error: "API route not found" });
  }

  const lat = sanitizeNumber(url.searchParams.get("lat"));
  const lng = sanitizeNumber(url.searchParams.get("lng"));
  const quantity = sanitizeNumber(url.searchParams.get("quantity"));
  const brickType = sanitizeText(url.searchParams.get("brickType")).toLowerCase();

  if (lat === null || lat < -90 || lat > 90) {
    return sendJson(res, 400, { error: "lat must be a valid latitude" });
  }

  if (lng === null || lng < -180 || lng > 180) {
    return sendJson(res, 400, { error: "lng must be a valid longitude" });
  }

  if (quantity === null || quantity <= 0) {
    return sendJson(res, 400, { error: "quantity must be a positive number" });
  }

  const manufacturers = await getVerifiedManufacturers();
  const nearbyManufacturers = manufacturers
    .filter((manufacturer) => {
      if (!brickType) return true;
      return manufacturer.availableBrickTypes?.some((type) => type.toLowerCase() === brickType);
    })
    .filter((manufacturer) => quantity >= manufacturer.minimumOrderQuantity)
    .map((manufacturer) => buildNearbyManufacturerResult(manufacturer, lat, lng, quantity))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  return sendJson(res, 200, { manufacturers: nearbyManufacturers });
};

const handleApi = async (req, res, url) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (url.pathname === "/api/requests") {
    return handleRequestsRoute(req, res);
  }

  if (url.pathname === "/api/manufacturers/nearby") {
    return handleNearbyManufacturersRoute(req, res, url);
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
