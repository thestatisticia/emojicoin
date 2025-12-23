# QIEDex Integration Guide

This document explains how to complete the QIEDex integration for the EmojiCoin Launcher.

## Current Status

The application is now fully integrated with QIEDex architecture, but requires the actual QIEDex contract addresses to be configured.

## Required Configuration

### 1. QIEDex Contract Addresses

The following contract addresses are now configured:

- **QIEDex Router Address**: `0x08cd2e72e156D8563B4351eb4065C262A9f553Ef`
- **QIEDex Factory Address**: `0x8E23128a5511223bE6c0d64106e2D4508C08398C`
- **WQIE Token Address**: `0x0087904D95BEe9E5F24dc8852804b547981A9139`

**Where to find these:**
- QIE Blockchain Whitepaper: https://www.qie.digital/QIE-Whitepaper.pdf
- QIEDex Documentation: https://qiedex.qie.digital
- QIE Network Block Explorer: https://mainnet.qie.digital/

### 2. Configuration File

The configuration is already set up in `src/config/qiedex.js` with:
- Correct contract addresses
- Router ABI with `addLiquidity` and `addLiquidityETH` functions
- Slippage protection helpers
- Deadline calculation utilities

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
PRIVATE_KEY=your_private_key_here  # ⚠️ NEVER commit your private key! Keep it in .env file only
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id  # Optional
```

**⚠️ Security Note**: Never commit your `.env` file to version control. It's already in `.gitignore`.

### 4. WalletConnect Project ID (Optional)

For better wallet connectivity, get a free WalletConnect Project ID:
1. Go to https://cloud.walletconnect.com
2. Create an account and project
3. Copy your Project ID
4. Add it to your `.env` file as `VITE_WALLETCONNECT_PROJECT_ID`

## Features Implemented

### ✅ Token Creation
- Create custom ERC20 tokens with emoji symbols
- Set name, symbol, supply, and decimals
- Tokens are deployed via the TokenFactory contract

### ✅ Dashboard
- View all tokens created by the connected wallet
- Display token information (name, symbol, supply, balance)
- Links to block explorer
- Add liquidity button for each token

### ✅ Swap Interface (Improved)
- Swap between QIE (native) and created tokens via WQIE
- Real-time balance display
- Token selector for choosing which token to swap
- Automatic price quotes using `getAmountsOut`
- Slippage protection (5% default)
- Price impact calculations
- Pair existence validation
- Better error handling and user feedback

### ✅ Add Liquidity (Improved)
- Add liquidity pairs (Token/WQIE) on QIEDex using router's `addLiquidity` function
- Streamlined process:
  1. Create pair (if it doesn't exist)
  2. Approve token to router
  3. Wrap QIE to WQIE
  4. Approve WQIE to router
  5. Add liquidity via router (handles everything automatically)
- Automatic slippage protection (5% default, configurable)
- Real-time balance checks
- Optimal ratio calculations
- Price impact warnings

## Deployment

### Deploy TokenFactory Contract

```bash
# Using Viem (recommended)
node scripts/deploy-viem.js

# Or using Hardhat
npx hardhat run scripts/deploy.cjs --network qie
```

The deployment script will:
1. Deploy the TokenFactory contract to QIE Network
2. Save the contract address to `src/factoryAddress.json`
3. Display the deployment transaction hash

### Start Development Server

```bash
npm run dev
```

## Testing the Integration

1. **Connect Wallet**: Use RainbowKit to connect your wallet to QIE Network
2. **Create Token**: Fill in the form and deploy a new token
3. **View Dashboard**: Check your created tokens
4. **Add Liquidity**: 
   - Click "Add Liquidity" on a token
   - Enter token and QIE amounts
   - Approve the token first
   - Then supply liquidity
5. **Swap Tokens**: 
   - Go to Swap tab
   - Select a token to swap
   - Enter amount and execute swap

## Troubleshooting

### "QIEDex Router address not configured"
- Update `src/config/qiedex.js` with the correct router address

### "Transaction failed"
- Ensure you have enough QIE for gas fees
- Check that token approval was successful before adding liquidity
- Verify the contract addresses are correct

### "Cannot read properties of undefined"
- Make sure your wallet is connected
- Check that the TokenFactory is deployed and address is in `src/factoryAddress.json`

## Next Steps

1. ✅ Get QIEDex contract addresses from QIE documentation
2. ✅ Update `src/config/qiedex.js` with real addresses
3. ✅ Deploy TokenFactory contract to QIE Network
4. ✅ Test token creation
5. ✅ Test liquidity addition
6. ✅ Test token swapping

## Architecture

The integration follows Uniswap V2 architecture (which QIEDex uses):

- **Router**: Handles swaps and liquidity operations via standardized functions
  - `addLiquidity`: Adds liquidity for token pairs (handles approvals and transfers automatically)
  - `swapExactETHForTokens`: Swaps native QIE for tokens
  - `swapExactTokensForETH`: Swaps tokens for native QIE
  - `getAmountsOut`: Calculates swap quotes
- **Factory**: Creates and manages trading pairs
- **Pairs**: ERC20 token pairs for trading (created automatically by factory)
- **WQIE**: Wrapped QIE token (required for all operations)

All swaps go through: `TokenA → WQIE → TokenB` (or reverse)

## Improved Implementation Details

### Liquidity Provision

The improved implementation uses the router's `addLiquidity` function which:
- Automatically handles token approvals
- Manages token transfers
- Calculates optimal ratios
- Provides slippage protection
- Mints LP tokens to the user

**Helper Functions** (`src/utils/liquidityHelpers.js`):
- `calculateOptimalAmountB`: Calculates optimal token ratios based on reserves
- `calculatePriceImpact`: Calculates price impact for swaps
- `calculateMinAmounts`: Calculates minimum amounts with slippage protection
- `formatTokenAmount` / `parseTokenAmount`: Proper decimal handling

### Swapping

The improved swap logic:
- Uses `getAmountsOut` for accurate price quotes
- Calculates minimum output with slippage protection
- Validates pair existence before swapping
- Provides better error messages
- Handles both native-to-token and token-to-native swaps

### Slippage Protection

Default slippage tolerance is 5% (500 basis points), configurable in `QIEDEX_CONFIG.SLIPPAGE_TOLERANCE`.

The system automatically calculates:
- Minimum output amounts for swaps
- Minimum input amounts for liquidity addition
- Price impact warnings

## Support

For QIE Network specific questions:
- QIE Documentation: https://www.qie.digital
- QIEDex: https://qiedex.qie.digital
- Block Explorer: https://mainnet.qie.digital/









