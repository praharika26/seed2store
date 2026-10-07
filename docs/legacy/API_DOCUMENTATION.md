# AgriTrust API Documentation

This document provides comprehensive documentation for all API endpoints in the AgriTrust application.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints require a valid wallet address for user identification.

---

## Users API

### GET /api/users
Get user information by wallet address.

**Query Parameters:**
- `wallet_address` (required): User's wallet address

**Response:**
```json
{
  "id": "uuid",
  "wallet_address": "0x...",
  "email": "user@example.com",
  "role": "farmer|user",
  "profile_image_url": "string|null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### POST /api/users
Create or update user information.

**Body:**
```json
{
  "wallet_address": "0x...",
  "email": "user@example.com",
  "role": "farmer|user"
}
```

### PUT /api/users
Update user role.

**Body:**
```json
{
  "wallet_address": "0x...",
  "role": "farmer|user"
}
```

---

## Crops API

### GET /api/crops
Get all crops with filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 12)
- `crop_type` (optional): Filter by crop type
- `location` (optional): Filter by location
- `organic_certified` (optional): Filter by organic certification
- `min_price` (optional): Minimum price filter
- `max_price` (optional): Maximum price filter
- `farmer_id` (optional): Filter by farmer ID

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Organic Tomatoes",
      "description": "Fresh organic tomatoes",
      "crop_type": "vegetable",
      "quantity": 100,
      "unit": "kg",
      "organic_certified": true,
      "images": ["url1", "url2"],
      "farmer": {
        "id": "uuid",
        "wallet_address": "0x...",
        "email": "farmer@example.com"
      },
      "current_auction": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 50,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### POST /api/crops
Create a new crop listing.

**Body:**
```json
{
  "wallet_address": "0x...",
  "crop_data": {
    "title": "Organic Tomatoes",
    "description": "Fresh organic tomatoes",
    "crop_type": "vegetable",
    "quantity": 100,
    "unit": "kg",
    "organic_certified": true,
    "images": ["url1", "url2"],
    "starting_price": 0.5
  }
}
```

### GET /api/crops/[id]
Get specific crop by ID.

### GET /api/crops/farmer/[wallet]
Get all crops for a specific farmer.

---

## Offers API

### GET /api/offers
Get offers for a user.

**Query Parameters:**
- `wallet_address` (required): User's wallet address
- `type` (required): "received" for farmers, "sent" for buyers

### POST /api/offers
Create a new offer.

**Body:**
```json
{
  "wallet_address": "0x...",
  "offer_data": {
    "crop_id": "uuid",
    "quantity": 50,
    "price_per_unit": 0.45,
    "message": "Interested in your tomatoes",
    "expires_in_hours": 72
  }
}
```

### PUT /api/offers/[id]
Accept or reject an offer.

**Body:**
```json
{
  "status": "accepted|rejected"
}
```

### GET /api/offers/crop/[id]
Get all offers for a specific crop.

---

## Auctions API

### GET /api/auctions
Get all auctions with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (default: "active")
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 12)

### POST /api/auctions
Create a new auction.

**Body:**
```json
{
  "wallet_address": "0x...",
  "auction_data": {
    "crop_id": "uuid",
    "starting_price": 0.5,
    "reserve_price": 1.0,
    "duration_hours": 24
  }
}
```

### GET /api/auctions/[id]
Get specific auction by ID.

### GET /api/auctions/[id]/bids
Get all bids for an auction.

### POST /api/auctions/[id]/bids
Place a bid on an auction.

**Body:**
```json
{
  "wallet_address": "0x...",
  "amount": 0.6,
  "transaction_hash": "0x..."
}
```

---

## Bids API

### GET /api/bids
Get user's bidding history.

**Query Parameters:**
- `wallet_address` (required): User's wallet address

---

## Orders API

### GET /api/orders
Get user's orders.

**Query Parameters:**
- `wallet_address` (required): User's wallet address
- `type` (optional): "buyer" or "seller"

### POST /api/orders
Create a new order.

**Body:**
```json
{
  "wallet_address": "0x...",
  "crop_id": "uuid",
  "quantity": 25,
  "price_per_unit": 0.5,
  "transaction_hash": "0x...",
  "order_type": "direct_purchase"
}
```

### GET /api/orders/[id]
Get specific order by ID.

### PUT /api/orders/[id]
Update order status.

**Body:**
```json
{
  "status": "pending|confirmed|shipped|delivered|cancelled",
  "transaction_hash": "0x..."
}
```

---

## Statistics API

### GET /api/stats
Get user statistics for dashboard.

**Query Parameters:**
- `wallet_address` (required): User's wallet address
- `type` (required): "farmer" or "buyer"

**Farmer Response:**
```json
{
  "crops": {
    "total": 10,
    "active": 5,
    "auction": 2,
    "sold": 3
  },
  "offers": {
    "total": 15,
    "pending": 5,
    "accepted": 8,
    "rejected": 2
  },
  "auctions": {
    "total": 3,
    "active": 1,
    "completed": 2
  },
  "revenue": {
    "total": 150.5,
    "pending": 25.0
  }
}
```

**Buyer Response:**
```json
{
  "bids": {
    "total": 8,
    "winning": 2,
    "won": 3,
    "lost": 3
  },
  "offers": {
    "total": 5,
    "pending": 2,
    "accepted": 2,
    "rejected": 1
  },
  "purchases": {
    "total": 12,
    "completed": 10,
    "pending": 2
  },
  "spending": {
    "total": 85.5,
    "pending": 15.0
  }
}
```

---

## Pinata API (IPFS)

### POST /api/pinata/upload
Upload file to IPFS via Pinata.

**Body:** FormData with file

### POST /api/pinata/upload-json
Upload JSON metadata to IPFS via Pinata.

**Body:**
```json
{
  "name": "Crop NFT",
  "description": "NFT for verified crop",
  "image": "ipfs://...",
  "attributes": []
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (missing/invalid parameters)
- `404`: Not Found
- `500`: Internal Server Error

---

## Rate Limiting

Currently no rate limiting is implemented, but it's recommended for production use.

## CORS

CORS is configured to allow requests from the frontend application.