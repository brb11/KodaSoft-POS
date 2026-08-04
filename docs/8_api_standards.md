# 8. API Standards

## 8.1 Base URL & Versioning
*   Pattern: `/api/v1/{resource}`
*   Example: `/api/v1/products`

## 8.2 Standard Responses
All responses (success or error) wrap data in a standard envelope.
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 120
  }
}
```

## 8.3 Error Format (RFC 7807)
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Product SKU-123 only has 2 items left.",
    "details": { "productId": 456, "available": 2 }
  }
}
```

## 8.4 Idempotency
POST/PUT endpoints that mutate financial or inventory state must accept an `Idempotency-Key` header. The server checks Redis; if the key was processed within the last 24h, the cached response is returned instead of re-processing.

## 8.5 Pagination & Filtering
*   Offset-based for dashboard tables: `?page=2&limit=50`
*   Cursor-based for offline sync feeds: `?cursor=last_sync_timestamp`
*   Filtering: `?categoryId=5&price[gte]=100`

## 8.6 Validation
All incoming payloads are validated using Zod. Validation errors return `400 Bad Request` with an array of field-specific errors.
