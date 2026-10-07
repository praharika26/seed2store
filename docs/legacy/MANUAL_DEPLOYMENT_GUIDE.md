# Manual Smart Contract Deployment Guide

## Overview

This guide covers manual deployment of AgriTrust smart contracts without using Hardhat deployment scripts. You can deploy using Remix IDE, Foundry, or any other deployment method you prefer.

## Prerequisites

- Wallet with ETH for gas fees (Sepolia testnet recommended)
- Access to deployment tool (Remix IDE, Foundry, etc.)
- Contract source code from `/contracts` folder

## Contract Files to Deploy

1. **AgriTrust.sol** - Main marketplace contract
2. **AgriTrustToken.sol** - ERC20 reward token  
3. **AgriTrustEscrow.sol** - Escrow system

## Deployment Order

### Step 1: Deploy AgriTrustToken

```solidity
// Constructor parameters: None
// Deploy AgriTrustToken.sol first
```

### Step 2: Deploy AgriTrust

```solidity
// Constructor parameters: None
// Deploy AgriTrust.sol (main contract)
```

### Step 3: Deploy AgriTrustEscrow

```solidity
// Constructor parameters: None
// Deploy AgriTrustEscrow.sol
```

### Step 4: Configure Token Contract

After deployment, call this function on the AgriTrustToken contract:

```solidity
// Call setAgriTrustContract on the token contract
setAgriTrustContract(AGRITRUST_CONTRACT_ADDRESS)
```

## Using Remix IDE (Recommended)

### 1. Open Remix IDE
- Go to [remix.ethereum.org](https://remix.ethereum.org)
- Create new workspace or use default

### 2. Upload Contract Files
- Copy contents of `contracts/AgriTrust.sol`
- Copy contents of `contracts/AgriTrustToken.sol`
- Copy contents of `contracts/AgriTrustEscrow.sol`
- Install OpenZeppelin contracts: `@openzeppelin/contracts`

### 3. Compile Contracts
- Select Solidity compiler version `0.8.19`
- Enable optimization (200 runs)
- Compile all contracts

### 4. Deploy Contracts
- Switch to "Deploy & Run Transactions" tab
- Select "Injected Provider - MetaMask"
- Connect your wallet
- Select Sepolia network
- Deploy in order: Token → AgriTrust → Escrow

### 5. Verify on Etherscan
- Go to [sepolia.etherscan.io](https://sepolia.etherscan.io)
- Find your deployed contracts
- Click "Verify and Publish"
- Upload source code and constructor parameters

## Contract Addresses Setup

After deployment, update your `.env.local`:

```env
# Contract Addresses (update with your deployed addresses)
NEXT_PUBLIC_AGRITRUST_CONTRACT=0xYourAgriTrustContractAddress
NEXT_PUBLIC_AGRITRUST_TOKEN_CONTRACT=0xYourTokenContractAddress
NEXT_PUBLIC_AGRITRUST_ESCROW_CONTRACT=0xYourEscrowContractAddress
NEXT_PUBLIC_CHAIN_ID=11155111
```

## Testing Deployment

### 1. Test Contract Functions

Use Remix or Etherscan to test:

```solidity
// Test AgriTrust contract
registerCrop("Test Crop", "Description", "wheat", 1000, "kg", 100, 150, "ipfs-hash", true)

// Test Token contract
balanceOf(YOUR_WALLET_ADDRESS)

// Test Escrow contract
createEscrow(FARMER_ADDRESS, 1, 100, 7) // with ETH value
```

### 2. Test Frontend Integration

1. Update contract addresses in `.env.local`
2. Start your Next.js app: `npm run dev`
3. Connect wallet and test crop registration
4. Verify data appears in Supabase

## Gas Estimates

Approximate gas costs on Sepolia:

- **AgriTrustToken**: ~2,500,000 gas
- **AgriTrust**: ~3,000,000 gas  
- **AgriTrustEscrow**: ~2,800,000 gas
- **Configuration**: ~50,000 gas

**Total**: ~8.35M gas (~0.02 ETH on Sepolia)

## Troubleshooting

### Common Issues

1. **Out of Gas Error**
   - Increase gas limit to 3,500,000
   - Check gas price is reasonable

2. **Constructor Parameters Error**
   - All three contracts have no constructor parameters
   - Deploy without any arguments

3. **Import Errors**
   - Ensure OpenZeppelin contracts are available
   - Use correct import paths

4. **Verification Failed**
   - Match exact compiler version (0.8.19)
   - Include optimization settings (200 runs)
   - Flatten contracts if needed

### Contract Interaction

After deployment, you can interact with contracts using:

1. **Remix IDE** - Direct function calls
2. **Etherscan** - Read/Write contract interface
3. **Frontend App** - Through wagmi hooks
4. **Web3 Scripts** - Custom interaction scripts

## Security Checklist

Before mainnet deployment:

- [ ] Contracts compiled without warnings
- [ ] All functions tested on testnet
- [ ] Ownership transferred to secure address
- [ ] Platform fees set appropriately
- [ ] Emergency functions tested
- [ ] Frontend integration verified
- [ ] Gas optimizations reviewed

## Mainnet Deployment

When ready for mainnet:

1. **Switch to Ethereum Mainnet**
2. **Ensure sufficient ETH** for gas fees
3. **Deploy in same order** as testnet
4. **Verify contracts** on Etherscan
5. **Update frontend** with mainnet addresses
6. **Test with small amounts** first

## Support

If you encounter issues:

1. Check Remix IDE documentation
2. Verify Solidity compiler version
3. Ensure wallet has sufficient ETH
4. Test on Sepolia first
5. Use Etherscan for contract verification

---

**Note**: Always test thoroughly on testnet before mainnet deployment. Smart contracts are immutable once deployed.