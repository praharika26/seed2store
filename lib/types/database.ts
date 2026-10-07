// Domain types for Seed2Store. Dates are ISO strings everywhere (JSON-safe on both sides).

export type UserRole = "farmer" | "buyer"

export interface User {
  id: string
  wallet_address: string
  display_name?: string | null
  email?: string | null
  role: UserRole
  location?: string | null
  bio?: string | null
  verified?: boolean
  created_at: string
  updated_at: string
}

export type PublicUser = Pick<User, "id" | "wallet_address" | "display_name" | "location" | "verified" | "role">

export type CropStatus = "draft" | "active" | "auction" | "sold" | "expired"

export interface Crop {
  id: string
  farmer_id: string
  title: string
  description: string
  crop_type: string
  variety?: string | null
  quantity: number
  unit: string
  harvest_date?: string | null
  location?: string | null
  organic_certified: boolean
  quality_grade?: string | null
  moisture_content?: number | null
  storage_conditions?: string | null
  minimum_price?: number | null
  starting_price?: number | null
  buyout_price?: number | null
  status: CropStatus
  images: string[]
  content_hash?: string | null
  metadata_uri?: string | null
  nft_token_id?: number | null
  nft_contract?: string | null
  nft_minted?: boolean
  nft_transaction_hash?: string | null
  created_at: string
  updated_at: string
  // Joined
  farmer?: PublicUser
  current_auction?: Auction | null
  pending_offers?: number
}

export type AuctionStatus = "active" | "ended" | "cancelled"

export interface Auction {
  id: string
  crop_id: string
  starting_price: number
  reserve_price?: number | null
  bid_increment: number
  current_highest_bid?: number | null
  highest_bidder_id?: string | null
  start_time: string
  end_time: string
  status: AuctionStatus
  total_bids: number
  blockchain_id?: number | null
  transaction_hash?: string | null
  winner_id?: string | null
  settled_order_id?: string | null
  chain_finalized?: boolean
  created_at: string
  updated_at: string
  // Joined
  crop?: Crop
  highest_bidder?: PublicUser | null
}

export interface Bid {
  id: string
  auction_id: string
  bidder_id: string
  amount: number
  is_winning: boolean
  bid_time: string
  transaction_hash?: string | null
  created_at: string
  // Joined
  bidder?: PublicUser
  auction?: Auction
}

export type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "expired"

export interface Offer {
  id: string
  crop_id: string
  buyer_id: string
  quantity: number
  price_per_unit: number
  total_amount: number
  message?: string | null
  response_message?: string | null
  status: OfferStatus
  expires_at?: string | null
  created_at: string
  updated_at: string
  // Joined
  crop?: Crop
  buyer?: PublicUser
}

export type OrderSource = "buy_now" | "offer" | "auction"
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded"
export type DeliveryStatus = "pending" | "shipped" | "delivered" | "cancelled"

export interface Order {
  id: string
  crop_id: string
  buyer_id: string
  farmer_id: string
  auction_id?: string | null
  offer_id?: string | null
  source: OrderSource
  quantity: number
  unit_price: number
  total_amount: number
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  delivery_address?: string | null
  transaction_hash?: string | null
  created_at: string
  updated_at: string
  // Joined
  crop?: Crop
  buyer?: PublicUser
  farmer?: PublicUser
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  link?: string | null
  read: boolean
  created_at: string
}

// ---- Requests -------------------------------------------------------------

export interface CreateCropRequest {
  title: string
  description: string
  crop_type: string
  variety?: string
  quantity: number
  unit?: string
  harvest_date?: string | null
  location?: string
  organic_certified?: boolean
  quality_grade?: string
  moisture_content?: number
  storage_conditions?: string
  minimum_price?: number
  starting_price?: number
  buyout_price?: number
  images?: string[]
}

export interface CreateAuctionRequest {
  crop_id: string
  starting_price: number
  reserve_price?: number
  bid_increment?: number
  duration_hours: number
  blockchain_id?: number | null
  transaction_hash?: string | null
}

export interface CreateOfferRequest {
  crop_id: string
  quantity: number
  price_per_unit: number
  message?: string
  expires_in_hours?: number
}

export interface CropFilters {
  q?: string
  crop_type?: string
  location?: string
  organic_certified?: boolean
  min_price?: number
  max_price?: number
  status?: CropStatus[]
  farmer_id?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: "newest" | "price_asc" | "price_desc" | "ending_soon"
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export interface SeriesPoint {
  date: string
  value: number
}

export interface FarmerStats {
  role: "farmer"
  lots: { total: number; active: number; auction: number; sold: number }
  offers: { total: number; pending: number; accepted: number }
  auctions: { live: number; total: number }
  revenue: { settled: number; pending: number; series: SeriesPoint[] }
  by_crop: { crop_type: string; value: number }[]
  orders_to_ship: number
}

export interface BuyerStats {
  role: "buyer"
  bids: { total: number; winning: number; won: number }
  offers: { total: number; pending: number; accepted: number }
  orders: { total: number; in_transit: number; delivered: number }
  spending: { settled: number; pending: number; series: SeriesPoint[] }
}

export interface MarketStats {
  lots: number
  live_auctions: number
  farmers: number
  volume: number
  certified: number
}
