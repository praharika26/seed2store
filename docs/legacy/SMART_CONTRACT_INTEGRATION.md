# AgriTrust Smart Contract Integration Guide

## Overview

This guide covers the deployment and integration of AgriTrust smart contracts with the Next.js application. The system consists of three main contracts:

1. **AgriTrust.sol** - Main marketplace contract for crop registration and auctions
2. **AgriTrustToken.sol** - ERC20 token for rewards and governance
3. **AgriTrustEscrow.sol** - Escrow system for secure transactions

## Prerequisites

- Node.js 18+
- Hardhat development environment
- MetaMask or compatible wallet
- Test ETH for deployment (Sepolia testnet recommended)

## 1. Setup Development Environment

### Install Dependencies

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
npm install ethers viem wagmi @wagmi/core
```

### Initialize Hardhat

```bash
npx hardhat init
```

### Hardhat Configuration

Create `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
```

## 2. Environment Variables

Add to your `.env.local`:

```env
# Blockchain Configuration
PRIVATE_KEY=your_wallet_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Contract Addresses (after deployment)
NEXT_PUBLIC_AGRITRUST_CONTRACT=
NEXT_PUBLIC_AGRITRUST_TOKEN_CONTRACT=
NEXT_PUBLIC_AGRITRUST_ESCROW_CONTRACT=
NEXT_PUBLIC_CHAIN_ID=11155111
```

## 3. Deployment Scripts

Create `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  console.log("Deploying AgriTrust contracts...");

  // Deploy AgriTrustToken first
  const AgriTrustToken = await hre.ethers.getContractFactory("AgriTrustToken");
  const token = await AgriTrustToken.deploy();
  await token.waitForDeployment();
  console.log("AgriTrustToken deployed to:", await token.getAddress());

  // Deploy AgriTrust main contract
  const AgriTrust = await hre.ethers.getContractFactory("AgriTrust");
  const agriTrust = await AgriTrust.deploy();
  await agriTrust.waitForDeployment();
  console.log("AgriTrust deployed to:", await agriTrust.getAddress());

  // Deploy AgriTrustEscrow
  const AgriTrustEscrow = await hre.ethers.getContractFactory("AgriTrustEscrow");
  const escrow = await AgriTrustEscrow.deploy();
  await escrow.waitForDeployment();
  console.log("AgriTrustEscrow deployed to:", await escrow.getAddress());

  // Set up token contract with main contract address
  await token.setAgriTrustContract(await agriTrust.getAddress());
  console.log("Token contract configured with AgriTrust address");

  console.log("\n=== Deployment Summary ===");
  console.log("AgriTrustToken:", await token.getAddress());
  console.log("AgriTrust:", await agriTrust.getAddress());
  console.log("AgriTrustEscrow:", await escrow.getAddress());
  console.log("\nUpdate your .env.local with these addresses!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## 4. Deploy Contracts

### Local Development

```bash
# Start local Hardhat node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost
```

### Sepolia Testnet

```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Verify contracts on Etherscan
npx hardhat verify --network sepolia CONTRACT_ADDRESS
```

## 5. Frontend Integration

### Install Web3 Dependencies

```bash
npm install wagmi viem @wagmi/core @wagmi/connectors
```

### Create Contract Configuration

Create `lib/contracts/config.ts`:

```typescript
import { sepolia } from 'viem/chains'

export const CONTRACTS = {
  AGRITRUST: {
    address: process.env.NEXT_PUBLIC_AGRITRUST_CONTRACT as `0x${string}`,
    abi: [] // Import from generated ABI files
  },
  TOKEN: {
    address: process.env.NEXT_PUBLIC_AGRITRUST_TOKEN_CONTRACT as `0x${string}`,
    abi: [] // Import from generated ABI files
  },
  ESCROW: {
    address: process.env.NEXT_PUBLIC_AGRITRUST_ESCROW_CONTRACT as `0x${string}`,
    abi: [] // Import from generated ABI files
  }
}

export const SUPPORTED_CHAINS = [sepolia]
export const DEFAULT_CHAIN = sepolia
```

### Generate Contract ABIs

```bash
# Compile contracts to generate ABIs
npx hardhat compile

# ABIs will be in artifacts/contracts/
# Copy them to lib/contracts/abis/
```

### Create Web3 Provider

Create `lib/web3/provider.tsx`:

```typescript
'use client'

import { WagmiConfig, createConfig } from 'wagmi'
import { sepolia } from 'viem/chains'
import { createPublicClient, http } from 'viem'

const config = createConfig({
  chains: [sepolia],
  publicClient: createPublicClient({
    chain: sepolia,
    transport: http()
  })
})

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={config}>
      {children}
    </WagmiConfig>
  )
}
```

### Create Contract Hooks

Create `lib/hooks/useAgriTrust.ts`:

```typescript
import { useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts/config'

export function useRegisterCrop() {
  const { config } = usePrepareContractWrite({
    ...CONTRACTS.AGRITRUST,
    functionName: 'registerCrop',
  })

  return useContractWrite(config)
}

export function useCreateAuction() {
  const { config } = usePrepareContractWrite({
    ...CONTRACTS.AGRITRUST,
    functionName: 'createAuction',
  })

  return useContractWrite(config)
}

export function usePlaceBid() {
  const { config } = usePrepareContractWrite({
    ...CONTRACTS.AGRITRUST,
    functionName: 'placeBid',
  })

  return useContractWrite(config)
}

export function useGetCrop(cropId: number) {
  return useContractRead({
    ...CONTRACTS.AGRITRUST,
    functionName: 'getCrop',
    args: [cropId],
  })
}

export function useGetFarmerCrops(farmerAddress: string) {
  return useContractRead({
    ...CONTRACTS.AGRITRUST,
    functionName: 'getFarmerCrops',
    args: [farmerAddress],
  })
}
```

## 6. Integration Steps

### Step 1: Update Client Providers

Update `components/client-providers.tsx`:

```typescript
import { Web3Provider } from '@/lib/web3/provider'

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <Web3Provider>
        <UserProvider>
          <Navigation />
          {children}
          <Toaster />
        </UserProvider>
      </Web3Provider>
    </PrivyProvider>
  )
}
```

### Step 2: Update Crop Registration

In `app/register-crop/page.tsx`, integrate smart contract:

```typescript
import { useRegisterCrop } from '@/lib/hooks/useAgriTrust'

// In component:
const { write: registerCrop, isLoading: isRegistering } = useRegisterCrop()

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  try {
    // Upload to IPFS first
    const ipfsHash = await uploadToIPFS(formData)
    
    // Register on blockchain
    await registerCrop({
      args: [
        formData.title,
        formData.description,
        formData.crop_type,
        parseEther(formData.quantity.toString()),
        formData.unit,
        parseEther(formData.minimum_price.toString()),
        parseEther(formData.buyout_price.toString()),
        ipfsHash,
        formData.organic_certified
      ]
    })
    
    // Save to database after blockchain confirmation
    await saveCropToDatabase(cropData)
    
  } catch (error) {
    console.error('Registration failed:', error)
  }
}
```

### Step 3: Update Auction System

In `app/crop/[id]/page.tsx`:

```typescript
import { useCreateAuction, usePlaceBid } from '@/lib/hooks/useAgriTrust'

// Create auction
const { write: createAuction } = useCreateAuction()

const handleCreateAuction = async () => {
  await createAuction({
    args: [
      cropId,
      parseEther(auctionData.starting_price),
      parseEther(auctionData.reserve_price),
      parseEther('0.01'), // bid increment
      auctionData.duration_hours * 3600 // duration in seconds
    ]
  })
}

// Place bid
const { write: placeBid } = usePlaceBid()

const handlePlaceBid = async () => {
  await placeBid({
    args: [auctionId],
    value: parseEther(bidAmount)
  })
}
```

## 7. Testing

### Unit Tests

Create `test/AgriTrust.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgriTrust", function () {
  let agriTrust, token, owner, farmer, buyer;

  beforeEach(async function () {
    [owner, farmer, buyer] = await ethers.getSigners();
    
    const AgriTrustToken = await ethers.getContractFactory("AgriTrustToken");
    token = await AgriTrustToken.deploy();
    
    const AgriTrust = await ethers.getContractFactory("AgriTrust");
    agriTrust = await AgriTrust.deploy();
  });

  it("Should register a crop", async function () {
    await agriTrust.connect(farmer).registerCrop(
      "Test Crop",
      "Description",
      "wheat",
      1000,
      "kg",
      ethers.parseEther("1"),
      ethers.parseEther("2"),
      "ipfs-hash",
      true
    );

    const crop = await agriTrust.getCrop(1);
    expect(crop.title).to.equal("Test Crop");
    expect(crop.farmer).to.equal(farmer.address);
  });

  it("Should create and participate in auction", async function () {
    // Register crop first
    await agriTrust.connect(farmer).registerCrop(
      "Test Crop", "Description", "wheat", 1000, "kg",
      ethers.parseEther("1"), ethers.parseEther("2"), "ipfs-hash", true
    );

    // Create auction
    await agriTrust.connect(farmer).createAuction(
      1, ethers.parseEther("1"), ethers.parseEther("0.5"), 
      ethers.parseEther("0.1"), 3600
    );

    // Place bid
    await agriTrust.connect(buyer).placeBid(1, { value: ethers.parseEther("1.1") });

    const auction = await agriTrust.getAuction(1);
    expect(auction.currentBidder).to.equal(buyer.address);
  });
});
```

### Run Tests

```bash
npx hardhat test
```

## 8. Security Considerations

1. **Access Control**: Only contract owner can update fees and emergency functions
2. **Reentrancy Protection**: All payable functions use ReentrancyGuard
3. **Input Validation**: All user inputs are validated
4. **Escrow System**: Secure fund holding with dispute resolution
5. **Time Locks**: Auction timing and delivery deadlines enforced

## 9. Gas Optimization

- Use `uint256` for counters and IDs
- Pack structs efficiently
- Use events for data that doesn't need on-chain storage
- Implement batch operations where possible

## 10. Monitoring and Analytics

### Event Listening

```typescript
// Listen for crop registration events
const contract = new ethers.Contract(address, abi, provider)

contract.on('CropRegistered', (cropId, farmer, title) => {
  console.log(`New crop registered: ${title} by ${farmer}`)
  // Update database
})

contract.on('BidPlaced', (auctionId, bidder, amount) => {
  console.log(`New bid: ${amount} ETH on auction ${auctionId}`)
  // Update UI in real-time
})
```

## 11. Deployment Checklist

- [ ] Deploy contracts to testnet
- [ ] Verify contracts on Etherscan
- [ ] Test all functions with frontend
- [ ] Set up event monitoring
- [ ] Configure proper gas limits
- [ ] Update environment variables
- [ ] Test with multiple wallets
- [ ] Deploy to mainnet (when ready)

## 12. Maintenance

### Upgrading Contracts

Since contracts are not upgradeable, plan for:
1. Data migration scripts
2. New contract deployment
3. Frontend updates to use new addresses
4. User communication about migration

### Monitoring

- Track gas usage and optimize
- Monitor contract balance and fees
- Watch for unusual activity
- Regular security audits

## Support

For issues or questions:
1. Check Hardhat documentation
2. Review OpenZeppelin contracts
3. Test on local network first
4. Use Sepolia testnet for integration testing

---

**Note**: Always test thoroughly on testnets before mainnet deployment. Smart contracts are immutable once deployed, so careful testing is crucial.