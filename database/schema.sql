CREATE TABLE service_requests (
  id VARCHAR(36) PRIMARY KEY,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('buy', 'sell', 'quote')),
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_progress', 'completed', 'cancelled')),
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160),
  location VARCHAR(180),
  material VARCHAR(120),
  quantity INTEGER,
  customer_type VARCHAR(80),
  brick_type VARCHAR(80),
  delivery_location VARCHAR(160),
  gst VARCHAR(40),
  products VARCHAR(120),
  message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_type ON service_requests(request_type);
CREATE INDEX idx_service_requests_created_at ON service_requests(created_at);
