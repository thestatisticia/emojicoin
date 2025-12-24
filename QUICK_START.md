# Quick Start Guide - EmojiCoin Launcher with QIEDex

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

The `.env` file has been created with your private key. **Never commit this file!**

### 3. Get QIEDex Contract Addresses

**IMPORTANT**: You need to get the actual QIEDex contract addresses and update `src/config/qiedex.js`:

1. Check QIE Blockchain Whitepaper: https://www.qie.digital/QIE-Whitepaper.pdf
2. Or contact QIE Network support
3. Update these addresses in `src/config/qiedex.js`:
   - `ROUTER` - QIEDex Router contract address
   - `FACTORY` - QIEDex Factory contract address  
   - `WQIE` - Wrapped QIE token address

### 4. Deploy TokenFactory Contract

```bash
# Deploy to QIE Network
node scripts/deploy-viem.js
```

This will:
- Deploy the TokenFactory contract
- Save the address to `src/factoryAddress.json`
- Display the transaction hash

### 5. Start Development Server

```bash
npm run dev
```

## 📋 What's Integrated

✅ **Token Creation** - Create ERC20 tokens with emoji symbols  
✅ **Dashboard** - View all your created tokens  
✅ **Add Liquidity** - Add liquidity pairs on QIEDex  
✅ **Swap Interface** - Swap between QIE and tokens via QIEDex  

## ⚠️ Before Using

1. **Update QIEDex Addresses**: Edit `src/config/qiedex.js` with real contract addresses
2. **Get WalletConnect ID** (Optional): Add `VITE_WALLETCONNECT_PROJECT_ID` to `.env` for better wallet support
3. **Fund Your Wallet**: Make sure you have QIE tokens for gas fees

## 🔧 Troubleshooting

### "QIEDex Router address not configured"
→ Update `src/config/qiedex.js` with the correct router address

### "Transaction failed"  
→ Check you have enough QIE for gas
→ Verify contract addresses are correct

### Wallet won't connect
→ Make sure you're on QIE Network (Chain ID: 1990)
→ Check WalletConnect project ID if using

## 📚 More Information

See `QIEDEX_INTEGRATION.md` for detailed integration documentation.












