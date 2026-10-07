# Simple AgriTrust Deployment (No Token)

## Overview

Deploy only the essential contracts for a functional agricultural marketplace without the complexity of an ERC20 token system.

## Contracts to Deploy

### 1. AgriTrust.sol (Required)
- **Purpose**: Main marketplace functionality
- **Features**: 
  - Crop registration
  - Auction system
  - Direct purchases
  - Platform fees in ETH

### 2. AgriTrustEscrow.sol (Recommended)
- **Purpose**: Secure buyer-farmer transactions
- **Features**:
  - Escrow protection
  - Delivery confirmation
  - Dispute resolution

## Deployment Steps

### Using Remix IDE

1. **Deploy AgriTrust Contract**
   - Copy `contracts/AgriTrust.sol` to Remix
   - Compile with Solidity 0.8.19
   - Deploy (no constructor parameters)

2. **Deploy AgriTrustEscrow Contract** (Optional)
   - Copy `contracts/AgriTrustEscrow.sol` to Remix
   - Compile and deploy (no constructor parameters)

3. **Update Environment Variables**
   ```env
   # Only these two contracts needed
   NEXT_PUBLIC_AGRITRUST_CONTRACT=0xYourMainContractAddress
   NEXT_PUBLIC_AGRITRUST_ESCROW_CONTRACT=0xYourEscrowContractAddress
   ```

## What You Get

### Core Marketplace Features
- ✅ **Crop Registration** - Farmers list crops with IPFS metadata
- ✅ **Auction System** - Time-based bidding with automatic winner selection
- ✅ **Direct Sales** - Buy-now functionality at fixed prices
- ✅ **Platform Fees** - Revenue collection in ETH (2.5% default)
- ✅ **Event Logging** - All actions recorded on blockchain

### Security Features
- ✅ **Escrow Protection** - Funds held until delivery confirmed
- ✅ **Dispute Resolution** - Manual resolution by contract owner
- ✅ **Reentrancy Protection** - Secure against common attacks
- ✅ **Access Controls** - Only authorized actions allowed

## Benefits of This Approach

1. **Simplicity** - Easier to understand and maintain
2. **Lower Gas Costs** - Fewer contract interactions
3. **Faster Development** - No token economics to manage
4. **Direct Revenue** - Platform fees collected in ETH
5. **Less Complexity** - No token distribution or governance

## Gas Estimates (Simplified)

- **AgriTrust Deployment**: ~3M gas
- **AgriTrustEscrow Deployment**: ~2.8M gas
- **Total**: ~5.8M gas (~0.015 ETH on Sepolia)

## Future Upgrades

If you later want to add token functionality:
1. Deploy AgriTrustToken separately
2. Update main contract to integrate with token
3. Add reward distribution logic
4. Implement governance features

## Contract Interaction Examples

### Register a Crop
```solidity
registerCrop(
    "Premium Organic Wheat",     // title
    "High quality wheat...",     // description
    "wheat",                     // crop type
    1000,                        // quantity
    "kg",                        // unit
    parseEther("0.05"),         // minimum price (0.05 ETH)
    parseEther("0.08"),         // buyout price (0.08 ETH)
    "QmHash...",                // IPFS hash
    true                        // organic certified
)
```

### Create Auction
```solidity
createAuction(
    1,                          // crop ID
    parseEther("0.05"),        // starting price
    parseEther("0.04"),        // reserve price
    parseEther("0.01"),        // bid increment
    86400                      // duration (24 hours)
)
```

### Place Bid
```solidity
placeBid(1, { value: parseEther("0.06") }) // auction ID, bid amount
```

This gives you a **fully functional agricultural marketplace** without the complexity of token management!