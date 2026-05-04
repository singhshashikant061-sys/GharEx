# GharEx Service Request API

Run the API:

```bash
ADMIN_KEY="your-secret-key" node server.js
```

Default local URL:

```text
http://localhost:3000
```

## Submit Request

```http
POST /api/requests
Content-Type: application/json
```

Body:

```json
{
  "requestType": "buy",
  "name": "Customer Name",
  "phone": "+91 84097 34846",
  "email": "customer@example.com",
  "location": "Mohali",
  "material": "Red Clay Bricks",
  "quantity": 3000,
  "deliveryLocation": "Mohali",
  "message": "Need delivery this week"
}
```

`requestType` can be `buy`, `sell`, or `quote`.

## Get All Requests

```http
GET /api/admin/requests
x-admin-key: your-secret-key
```

Optional filters:

```http
GET /api/admin/requests?status=new&type=buy
```

## Update Status

```http
PATCH /api/admin/requests/{id}/status
Content-Type: application/json
x-admin-key: your-secret-key
```

Body:

```json
{
  "status": "contacted"
}
```

Allowed statuses:

```text
new, contacted, in_progress, completed, cancelled
```

## Database

The server stores requests in MongoDB using the `ServiceRequest` Mongoose model.
Set `MONGO_URL` before starting the server to use a different MongoDB database.
