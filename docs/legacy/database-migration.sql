-- AgriTrust Database Migration
-- Created: 2025-12-12
-- Description: Complete database schema for agricultural marketplace with auction system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (stores wallet addresses and user info)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) CHECK (role IN ('farmer', 'buyer', 'both')) DEFAULT 'buyer',
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crops table (main crop listings)
CREATE TABLE crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    crop_type VARCHAR(100) NOT NULL, -- wheat, rice, corn, etc.
    variety VARCHAR(100),
    quantity DECIMAL(10,2) NOT NULL, -- in kg/tons
    unit VARCHAR(20) DEFAULT 'kg',
    harvest_date DATE,
    location VARCHAR(255),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    organic_certified BOOLEAN DEFAULT FALSE,
    quality_grade VARCHAR(20), -- A, B, C grade
    moisture_content DECIMAL(5,2), -- percentage
    storage_conditions TEXT,
    minimum_price DECIMAL(12,2), -- minimum acceptable price
    starting_price DECIMAL(12,2), -- auction starting price
    buyout_price DECIMAL(12,2), -- immediate purchase price (optional)
    status VARCHAR(20) CHECK (status IN ('draft', 'active', 'auction', 'sold', 'expired')) DEFAULT 'draft',
    auction_start_date TIMESTAMP WITH TIME ZONE,
    auction_end_date TIMESTAMP WITH TIME ZONE,
    images JSONB, -- array of image URLs from Pinata
    documents JSONB, -- certificates, test reports, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crop images table (for better image management)
CREATE TABLE crop_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    pinata_hash VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auctions table (auction-specific data)
CREATE TABLE auctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    starting_price DECIMAL(12,2) NOT NULL,
    current_highest_bid DECIMAL(12,2),
    highest_bidder_id UUID REFERENCES users(id),
    reserve_price DECIMAL(12,2), -- minimum price to sell
    bid_increment DECIMAL(12,2) DEFAULT 10.00,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('upcoming', 'active', 'ended', 'cancelled')) DEFAULT 'upcoming',
    total_bids INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bids table (all bids placed on auctions)
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    is_winning BOOLEAN DEFAULT FALSE,
    bid_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_hash VARCHAR(66), -- blockchain transaction hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table (completed purchases)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES crops(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    farmer_id UUID NOT NULL REFERENCES users(id),
    auction_id UUID REFERENCES auctions(id), -- if from auction
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
    delivery_status VARCHAR(20) CHECK (delivery_status IN ('pending', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    delivery_address TEXT,
    delivery_date DATE,
    transaction_hash VARCHAR(66), -- blockchain payment hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offers table (direct offers on crops)
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL,
    price_per_unit DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    message TEXT,
    status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table (buyer/farmer reviews)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    reviewee_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- bid_placed, auction_won, offer_received, etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- additional data (crop_id, auction_id, etc.)
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_crops_farmer_id ON crops(farmer_id);
CREATE INDEX idx_crops_status ON crops(status);
CREATE INDEX idx_crops_crop_type ON crops(crop_type);
CREATE INDEX idx_crops_location ON crops(location);
CREATE INDEX idx_crops_harvest_date ON crops(harvest_date);
CREATE INDEX idx_crops_created_at ON crops(created_at DESC);

CREATE INDEX idx_auctions_crop_id ON auctions(crop_id);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_end_time ON auctions(end_time);

CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_bidder_id ON bids(bidder_id);
CREATE INDEX idx_bids_amount ON bids(amount DESC);
CREATE INDEX idx_bids_bid_time ON bids(bid_time DESC);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_farmer_id ON orders(farmer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE INDEX idx_offers_crop_id ON offers(crop_id);
CREATE INDEX idx_offers_buyer_id ON offers(buyer_id);
CREATE INDEX idx_offers_status ON offers(status);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crops_updated_at BEFORE UPDATE ON crops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auctions_updated_at BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO users (wallet_address, email, role) VALUES 
('0x1234567890123456789012345678901234567890', 'farmer@example.com', 'farmer'),
('0x0987654321098765432109876543210987654321', 'buyer@example.com', 'buyer');

-- Sample crop data
INSERT INTO crops (
    farmer_id, 
    title, 
    description, 
    crop_type, 
    variety, 
    quantity, 
    unit,
    harvest_date,
    location,
    organic_certified,
    quality_grade,
    minimum_price,
    starting_price,
    buyout_price,
    status
) VALUES (
    (SELECT id FROM users WHERE role = 'farmer' LIMIT 1),
    'Premium Organic Wheat',
    'High-quality organic wheat harvested from pesticide-free fields. Perfect for premium flour production.',
    'wheat',
    'Hard Red Winter',
    1000.00,
    'kg',
    '2024-10-15',
    'Punjab, India',
    true,
    'A',
    45.00,
    50.00,
    65.00,
    'active'
);