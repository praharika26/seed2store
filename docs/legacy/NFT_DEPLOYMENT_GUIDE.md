# AgriTrust NFT Contract Deployment Guide

This guide will help you deploy the AgriTrustNFT contract to your local Ganache blockchain.

## Prerequisites

1. **Ganache CLI or Ganache GUI** running on `http://127.0.0.1:7545`
2. **Remix IDE** (https://remix.ethereum.org)
3. **MetaMask** connected to your Ganache network

## Step 1: Setup Ganache Network

### Option A: Ganache CLI
```bash
npm install -g ganache-cli
ganache-cli --port 7545 --networkId 1337 --accounts 10 --deterministic
```

### Option B: Ganache GUI
1. Download and install Ganache GUI
2. Create new workspace with these settings:
   - Port: 7545
   - Network ID: 1337
   - Accounts: 10

## Step 2: Connect MetaMask to Ganache

1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Add custom network:
   - **Network Name**: Ganache Local
   - **RPC URL**: http://127.0.0.1:7545
   - **Chain ID**: 1337
   - **Currency Symbol**: ETH

4. Import Ganache account:
   - Copy private key from Ganache (first account)
   - MetaMask → Import Account → Paste private key

## Step 3: Deploy NFT Contract

### 3.1 Open Remix IDE
Go to https://remix.ethereum.org

### 3.2 Create Contract File
1. Create new file: `AgriTrustNFT.sol`
2. Copy the contract code from `contracts/AgriTrustNFT.sol`

### 3.3 Install Dependencies
In Remix, go to File Explorer → Add the following imports:
```solidity
// These will be auto-imported by Remix
@openzeppelin/contracts/token/ERC721/ERC721.sol
@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol
@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol
@openzeppelin/contracts/access/Ownable.sol
@openzeppelin/contracts/security/ReentrancyGuard.sol
@openzeppelin/contracts/utils/Counters.sol
```

### 3.4 Compile Contract
1. Go to "Solidity Compiler" tab
2. Select compiler version: `0.8.19` or higher
3. Click "Compile AgriTrustNFT.sol"

### 3.5 Deploy Contract
1. Go to "Deploy & Run Transactions" tab
2. Environment: Select "Injected Provider - MetaMask"
3. Make sure MetaMask is connected to Ganache network
4. Account: Select your Ganache account
5. Contract: Select "AgriTrustNFT"
6. Click "Deploy"
7. Confirm transaction in MetaMask

### 3.6 Copy Contract Address
After deployment, copy the contract address from Remix console.

## Step 4: Update Environment Configuration

Update your `.env.local` file:

```env
# Replace with your deployed contract address
NEXT_PUBLIC_AGRITRUST_NFT_CONTRACT=0xYourContractAddressHere

# Ensure these are set for Ganache
NEXT_PUBLIC_CHAIN_ID=1337
GANACHE_RPC_URL=http://127.0.0.1:7545
GANACHE_NETWORK_ID=1337
```

## Step 5: Test the Integration

1. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

2. Connect your wallet to the app
3. Switch to Farmer role
4. Try registering a crop with NFT certificate

## Troubleshooting

### Chain ID Mismatch Error
- Ensure MetaMask is connected to Ganache network (Chain ID: 5777)
- Check that `NEXT_PUBLIC_CHAIN_ID=5777` in `.env.local`

### Contract Not Found Error
- Verify the contract address in `.env.local`
- Make sure the contract was deployed successfully
- Check Ganache for the transaction

### RPC Connection Error
- Ensure Ganache is running on port 7545
- Check firewall settings
- Verify RPC URL in MetaMask matches Ganache

### Transaction Failed
- Check if you have enough ETH in your account
- Verify gas limit settings in MetaMask
- Check Ganache logs for error details

## Contract Functions

Once deployed, your NFT contract will support:

### For Farmers:
- `createCropCertificate()` - Mint NFT for crop
- `createAuction()` - Create auction for crop NFT
- `directPurchase()` - Set buyout price

### For Buyers:
- `placeBid()` - Bid on crop auctions
- `directPurchase()` - Buy crop directly
- `getCropCertificate()` - View crop details

### For Everyone:
- `getActiveCrops()` - List all available crops
- `getFarmerCrops()` - Get farmer's crops
- `isFarmerVerified()` - Check farmer verification

## Next Steps

After successful deployment:

1. **Test NFT Minting**: Register a crop and verify NFT creation
2. **Test Marketplace**: Create auctions and test bidding
3. **Verify IPFS Integration**: Check that metadata is properly stored
4. **Test Direct Purchase**: Try buying crops with buyout price

## Security Notes

⚠️ **Important**: This is for development only!

- Never use Ganache private keys on mainnet
- Always verify contract code before mainnet deployment
- Consider using a testnet (Sepolia) before mainnet
- Implement proper access controls for production

## Support

If you encounter issues:

1. Check Ganache console for errors
2. Verify MetaMask network settings
3. Check browser console for JavaScript errors
4. Ensure all environment variables are set correctly