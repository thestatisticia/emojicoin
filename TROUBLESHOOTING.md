# Troubleshooting Guide

## Fixed Issues

### 1. Import Error: `Address` not exported from wagmi
**Fixed**: Removed `Address` import (it's a TypeScript type, not a runtime export)
**Fixed**: Changed `zeroAddress` import to come from `viem` instead of `wagmi`

### 2. Wallet Configuration
**Fixed**: Updated to use `getDefaultWallets` with a dummy project ID
- MetaMask will work
- Injected wallets (like QIE Wallet) will work
- WalletConnect is included but won't be used if not configured

## If You Still See Errors

### Clear Browser Cache
1. Open browser DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Restart Dev Server
```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

### Clear Vite Cache
```bash
# Delete the .vite cache folder
rm -rf node_modules/.vite
# Or on Windows:
Remove-Item -Recurse -Force node_modules\.vite

# Then restart
npm run dev
```

### Verify Imports
Make sure `src/App.jsx` has:
```javascript
import { zeroAddress } from 'viem';  // ✅ Correct
// NOT: import { Address, zeroAddress } from 'wagmi';  // ❌ Wrong
```

## Current Configuration

- **Wallets**: MetaMask + Injected (QIE Wallet)
- **Network**: QIE Network (Chain ID: 1990)
- **QIEDex**: Fully configured with real addresses
- **TokenFactory**: Deployed at `0x1aF87842779E8c92e853781C73530A70855e9505`

## Still Having Issues?

1. Check browser console for specific error messages
2. Verify Node.js version (should be 18+)
3. Try deleting `node_modules` and reinstalling:
   ```bash
   rm -rf node_modules package-lock.json
   npm install --legacy-peer-deps
   ```










