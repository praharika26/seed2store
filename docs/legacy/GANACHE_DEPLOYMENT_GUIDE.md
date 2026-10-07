# AgriTrust Ganache Local Deployment Guide

## 🚀 **Quick Setup for Local Development**

### **Prerequisites**
1. **Ganache**: Running on `http://127.0.0.1:7545`
2. **MetaMask**: Connected to Ganache network
3. **Ganache Accounts**: Import accounts into MetaMask

## 🔧 **1. Configure MetaMask for Ganache**

### **Add Ganache Network to MetaMask:**
1. Open MetaMask → Networks → Add Network → Add a network manually
2. **Network Details:**
   ```
   Network Name: Ganache Local
   New RPC URL: http://127.0.0.1:7545
   Chain ID: 5777
   Currency Symbol: ETH
   Block Explorer URL: (leave empty)
   ```
3. Click **Save**

### **Import Ganache Accounts:**
1. In Ganache, copy private keys from accounts
2. MetaMask → Account → Import Account → Paste private key
3. Import at least 2 accounts (farmer + buyer)

## 🚀 **2. Deploy AgriTrustNFT Contract**

### **Option A: Using Remix IDE (Recommended)**
1. **Open Remix**: Go to [remix.ethereum.org](https://remix.ethereum.org)
2. **Connect to Ganache**:
   - Go to "Deploy & Run Transactions" tab
   - Environment: "Injected Provider - MetaMask"
   - Ensure MetaMask is on "Ganache Local" network
3. **Deploy Contract**:
   - Copy `contracts/AgriTrustNFT.sol` to Remix
   - Compile with Solidity 0.8.19
   - Deploy (no constructor parameters needed)
   - Gas Limit: Use 6721975 (Ganache's limit)

### **Option B: Using Truffle (Advanced)**
```bash
# Install Truffle globally
npm install -g truffle

# Initialize Truffle project
truffle init

# Configure truffle-config.js for Ganache
# Deploy contracts
truffle migrate --network development
```

## 🔧 **3. Update Environment Variables**

After successful deployment, copy the contract address and update `.env.local`:

```env
# Your deployed contract address from Ganache
NEXT_PUBLIC_AGRITRUST_NFT_CONTRACT=0x_YOUR_GANACHE_CONTRACT_ADDRESS
```

**Example:**
```env
NEXT_PUBLIC_AGRITRUST_NFT_CONTRACT=0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F
```

## 🧪 **4. Test the Complete Flow**

### **Setup Test Accounts:**
1. **Account 1**: Farmer role
2. **Account 2**: Buyer role

### **Test Steps:**
1. **Connect Wallet**: Switch MetaMask to Ganache network
2. **Switch to Farmer**: Use role switcher in app
3. **Register Crop**: 
   - Upload images to IPFS
   - Fill crop details
   - Click "Create Crop NFT Certificate"
   - Confirm transaction in MetaMask
4. **Verify NFT**: Check Ganache for transaction
5. **Switch to Buyer**: Change role to buyer
6. **View Marketplace**: See crop with NFT verification badge
7. **Test Purchase**: Try direct purchase or auction

## 🔍 **5. Debugging & Monitoring**

### **Ganache Console:**
- Monitor transactions in real-time
- Check gas usage and contract interactions
- View account balances

### **Browser Console:**
- Check for JavaScript errors
- Monitor Web3 connection status
- Verify contract calls

### **Common Issues:**
1. **MetaMask Connection**: Ensure correct network (5777)
2. **Gas Limit**: Use Ganache's limit (6721975)
3. **Account Balance**: Ensure accounts have ETH
4. **Contract Address**: Verify correct address in `.env.local`

## 🎯 **Benefits of Ganache Development**

✅ **Fast Transactions**: Instant mining, no waiting  
✅ **Free ETH**: Unlimited test ETH for development  
✅ **Full Control**: Reset blockchain state anytime  
✅ **Easy Debugging**: Clear transaction logs and state  
✅ **No Network Issues**: Local development, no internet dependency  

## 🔄 **Development Workflow**

1. **Start Ganache**: Launch Ganache GUI or CLI
2. **Deploy Contracts**: Use Remix or Truffle
3. **Update Config**: Add contract address to `.env.local`
4. **Restart Dev Server**: `npm run dev`
5. **Test Features**: Full NFT marketplace functionality
6. **Reset & Repeat**: Reset Ganache when needed

## 📝 **Sample Contract Addresses**

After deployment, your addresses might look like:
```env
# Example addresses (yours will be different)
NEXT_PUBLIC_AGRITRUST_NFT_CONTRACT=0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F
```

## 🚀 **Next Steps After Local Testing**

Once everything works locally:
1. **Deploy to Testnet**: Use Sepolia for public testing
2. **Deploy to Mainnet**: For production deployment
3. **Add Monitoring**: Set up analytics and error tracking
4. **Scale Infrastructure**: Prepare for production load

## 🆘 **Troubleshooting**

### **Contract Deployment Fails:**
- Check Ganache is running on port 7545
- Verify MetaMask is connected to Ganache network
- Ensure account has sufficient ETH

### **NFT Minting Fails:**
- Verify contract address in `.env.local`
- Check MetaMask network (should be Ganache)
- Restart development server after config changes

### **Transactions Not Appearing:**
- Refresh Ganache interface
- Check MetaMask activity tab
- Verify correct network in MetaMask

This setup gives you a **complete local blockchain environment** for developing and testing your NFT-based agricultural marketplace!