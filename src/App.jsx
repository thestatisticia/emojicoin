import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
    useAccount,
    useBalance,
    useContractWrite, 
    usePrepareContractWrite, 
    useWaitForTransaction,
    useContractRead,
    useConnect,
    useDisconnect
} from 'wagmi';
import { zeroAddress, parseUnits, formatUnits } from 'viem';
import factoryAddress from './factoryAddress.json';
import TokenFactoryArtifact from './artifacts/contracts/TokenFactory.sol/TokenFactory.json';
import { QIEDEX_CONFIG, ROUTER_ABI, FACTORY_ABI, ERC20_ABI, WQIE_ABI, PAIR_ABI } from './config/qiedex';
import { useUserTokens, useTokenInfo, useTokenBalance, useTokenAllowance } from './hooks/useUserTokens';
import { calculateMinAmounts, calculatePriceImpact, parseTokenAmount } from './utils/liquidityHelpers';

function App() {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    
    // Direct MetaMask connection fallback - defined first
    const handleDirectMetaMaskConnection = useCallback(async (connectFn, mmConnector) => {
        // Don't try to connect if already connected
        if (isConnected) {
            console.log('Wallet already connected, skipping connection attempt');
            return;
        }
        
        // Check if MetaMask is available
        if (typeof window === 'undefined') {
            console.warn('Window object not available');
            return;
        }
        
        // Check for MetaMask specifically
        const ethereum = window.ethereum;
        if (!ethereum) {
            console.warn('No Ethereum provider found. Please install MetaMask.');
            return;
        }
        
        // Check if it's MetaMask (not other wallets)
        if (ethereum.isMetaMask === false) {
            console.warn('MetaMask not detected. Other wallet detected:', ethereum);
        }

        try {
            console.log('Attempting direct MetaMask connection...');
            // Request account access
            const accounts = await ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            console.log('Direct connection successful, accounts:', accounts);
            
            // After direct connection, try the connector again
            // The connector should now work
            if (mmConnector && accounts.length > 0 && !isConnected) {
                // Small delay to ensure MetaMask is ready
                setTimeout(() => {
                    if (!isConnected) {
                        try {
                        connectFn({ connector: mmConnector });
                        } catch (err) {
                            console.warn('Connector connection failed after direct connection:', err);
                    }
                    }
                }, 500);
            }
        } catch (directError) {
            // Ignore "already connected" errors - this is normal
            if (directError.message?.includes('already connected') || 
                directError.name === 'ConnectorAlreadyConnectedError' ||
                directError.message?.includes('User rejected') ||
                directError.code === 4001) {
                console.log('Connection attempt skipped (already connected or rejected)');
                return;
            }
            // Only log errors, don't show alerts for connection issues
            console.warn('Direct connection attempt failed:', directError.message || directError);
        }
    }, [isConnected]);
    
    const { connect, connectors, isLoading: isConnecting, error: connectError } = useConnect({
        onError: (error) => {
            // Ignore "already connected" errors - this is normal
            if (error.message?.includes('already connected') || 
                error.name === 'ConnectorAlreadyConnectedError') {
                console.log('Wallet already connected (this is normal)');
                return;
            }
            
            // Suppress non-critical errors
            const errorMessage = error.message || error.toString() || '';
            const isNonCritical = 
                errorMessage.includes('extension not found') ||
                errorMessage.includes('MetaMask extension not found') ||
                errorMessage.includes('Receiving end does not exist') ||
                errorMessage.includes('PHANTOM') ||
                errorMessage.includes('ERR_NETWORK_CHANGED');
            
            if (isNonCritical) {
                console.warn('Non-critical connection error (suppressed):', errorMessage);
                // Still try direct connection if MetaMask extension error
                if (errorMessage.includes('MetaMask') || errorMessage.includes('extension')) {
                const mmConnector = connectors.find(
                    (connector) => 
                        connector.id === 'metaMask' || 
                        connector.id === 'injected' ||
                        connector.name === 'MetaMask' ||
                        connector.name?.toLowerCase().includes('metamask')
                ) || connectors.find(c => c.id === 'injected') || connectors[0];
                handleDirectMetaMaskConnection(connect, mmConnector);
            }
                return;
            }
            
            // Log other errors but don't spam console
            console.warn('Connection error:', errorMessage);
        },
        onSuccess: (data) => {
            console.log('Connection successful:', data);
        }
    });
    
    // Find MetaMask connector - check multiple possible identifiers
    const metaMaskConnector = connectors.find(
        (connector) => 
            connector.id === 'metaMask' || 
            connector.id === 'injected' ||
            connector.name === 'MetaMask' ||
            connector.name?.toLowerCase().includes('metamask')
    ) || connectors.find(c => c.id === 'injected') || connectors[0];
    
    // Check if MetaMask is installed - more accurate detection
    const isMetaMaskInstalled = typeof window !== 'undefined' && 
        window.ethereum && 
        (window.ethereum.isMetaMask === true || 
         (window.ethereum.isMetaMask === undefined && window.ethereum.request));
    
    // Debug: Log connector information (only in development)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
        if (connectors.length > 0) {
            console.log('Available connectors:', connectors.map(c => ({ 
                id: c.id, 
                name: c.name,
                ready: c.ready 
            })));
            console.log('Selected MetaMask connector:', metaMaskConnector ? {
                id: metaMaskConnector.id,
                name: metaMaskConnector.name,
                ready: metaMaskConnector.ready
            } : 'Not found');
        }
        if (typeof window !== 'undefined' && window.ethereum) {
            console.log('window.ethereum detected:', {
                isMetaMask: window.ethereum.isMetaMask,
                chainId: window.ethereum.chainId,
                selectedAddress: window.ethereum.selectedAddress
            });
            }
        }
    }, [connectors, metaMaskConnector]);
    
    // Suppress non-critical browser extension errors
    useEffect(() => {
        const originalError = console.error;
        const originalWarn = console.warn;
        
        // Suppress known non-critical errors
        const errorFilter = (args) => {
            const message = args.join(' ');
            if (
                message.includes('PHANTOM') ||
                message.includes('solanaActionsContentScript') ||
                message.includes('ERR_NETWORK_CHANGED') ||
                message.includes('Receiving end does not exist') ||
                message.includes('Failed to load resource: net::ERR_NETWORK_CHANGED')
            ) {
                // Suppress these errors silently
                return;
            }
            originalError.apply(console, args);
        };
        
        // Only suppress in production or if explicitly needed
        if (process.env.NODE_ENV === 'production') {
            console.error = errorFilter;
        }
        
        return () => {
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, []);
    
    const navigate = useNavigate();
    const location = useLocation();
    const activeTab = location.pathname === '/' ? 'home' : location.pathname.slice(1);
    
    // Sync route with activeTab changes
    const setActiveTab = (tab) => {
        if (tab === 'home') {
            navigate('/');
        } else {
            navigate(`/${tab}`);
        }
    };
    
    const [showLiquidityModal, setShowLiquidityModal] = useState(false);
    const [selectedToken, setSelectedToken] = useState(null);

    // Form State
    const [ticker, setTicker] = useState('');
    const [name, setName] = useState('');
    const [supply, setSupply] = useState('');
    const [decimals, setDecimals] = useState('18');

    // Swap State
    const [swapAmountIn, setSwapAmountIn] = useState('');
    const [swapAmountOut, setSwapAmountOut] = useState('');
    const [swapTokenIn, setSwapTokenIn] = useState(zeroAddress); // QIE (native)
    const [swapTokenOut, setSwapTokenOut] = useState(zeroAddress);
    const [swapDirection, setSwapDirection] = useState('nativeToToken'); // 'nativeToToken' or 'tokenToNative'

    // Liquidity State
    const [liquidityTokenAmount, setLiquidityTokenAmount] = useState('');
    const [liquidityQieAmount, setLiquidityQieAmount] = useState('');

    // Get user tokens with real-time updates
    const { tokenAddresses, isLoading: tokensLoading, refetch: refetchTokens } = useUserTokens();
    
    // Local state for hidden tokens (can't erase on-chain, but can hide locally)
    const [hiddenTokens, setHiddenTokens] = useState(() => {
        const stored = localStorage.getItem('hiddenTokens');
        return stored ? JSON.parse(stored) : [];
    });
    
    // Filter out hidden tokens
    const visibleTokens = tokenAddresses.filter(addr => !hiddenTokens.includes(addr));
    
    // Function to hide/clear a token locally
    const hideToken = (tokenAddress) => {
        const updated = [...hiddenTokens, tokenAddress];
        setHiddenTokens(updated);
        localStorage.setItem('hiddenTokens', JSON.stringify(updated));
    };
    
    // Function to clear all hidden tokens (show them again)
    const clearHiddenTokens = () => {
        setHiddenTokens([]);
        localStorage.removeItem('hiddenTokens');
    };

    // Get QIE balance
    const { data: qieBalance } = useBalance({
        address: address,
        watch: true,
    });

    // Contract Write Preparation for Token Creation
    const { config: createTokenConfig } = usePrepareContractWrite({
        address: factoryAddress.address,
        abi: TokenFactoryArtifact.abi,
        functionName: 'createToken',
        // Contract multiplies by 10^decimals internally, so pass raw supply number
        args: [name, ticker, BigInt(supply || 0), parseInt(decimals || 18)],
        enabled: Boolean(name && ticker && supply && isConnected),
    });

    const { data: createTokenData, write: createToken, isLoading: isCreateLoading } = useContractWrite(createTokenConfig);

    const { isLoading: isCreateTxLoading, isSuccess: isCreateSuccess } = useWaitForTransaction({
        hash: createTokenData?.hash,
    });

    // Get selected token info for approval
    const selectedTokenInfoForApproval = useTokenInfo(selectedToken);
    const tokenDecimals = selectedTokenInfoForApproval.decimals ? Number(selectedTokenInfoForApproval.decimals) : 18;
    
    // Check if pair exists for this token
    // Note: getPair returns zero address (0x0000...) if pair doesn't exist - this is normal, not an error
    // Empty data (0x) also means pair doesn't exist - we handle this gracefully
    const { data: pairAddress, error: pairError, isError: isPairError } = useContractRead({
        address: QIEDEX_CONFIG.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: selectedToken && selectedToken !== zeroAddress 
            ? [QIEDEX_CONFIG.WQIE, selectedToken]
            : undefined,
        enabled: Boolean(selectedToken && selectedToken !== zeroAddress),
        watch: true,
        // Suppress errors - zero address/empty data return is expected when pair doesn't exist
        throwOnError: false,
        retry: false, // Don't retry - empty data means pair doesn't exist
    });
    
    // Pair exists if address is not zero (zero address means pair doesn't exist)
    // If there's an error (empty data), treat it as pair doesn't exist (zero address)
    const resolvedPairAddress = (isPairError || pairError) ? zeroAddress : (pairAddress || zeroAddress);
    const pairExists = resolvedPairAddress && resolvedPairAddress !== zeroAddress && resolvedPairAddress !== '0x0000000000000000000000000000000000000000';
    
    // WQIE balance check - DISABLED
    // According to QIEDEX docs: "WQIE is NOT a standard ERC-20"
    // The balanceOf function doesn't work on WQIE, so we disable this check
    // We'll rely on transaction confirmation instead
    const wqieBalance = null; // Always null - WQIE doesn't support balanceOf
    const wqieBalanceError = null;
    const refetchWqieBalance = () => {}; // No-op function
    
    // Note: Per QIEDEX documentation, WQIE is NOT a standard ERC-20
    // We cannot check WQIE balance using balanceOf
    // Instead, we verify wrapping succeeded via transaction confirmation
    
    // IMPROVED LIQUIDITY FLOW using Router's addLiquidity function:
    // 1. Check if pair exists, create if needed
    // 2. Approve token to router
    // 3. Approve WQIE to router (after wrapping)
    // 4. Call router.addLiquidity() which handles everything automatically
    
    // Check if pair exists, if not we'll create it
    const needsPairCreation = !pairExists && (resolvedPairAddress === zeroAddress || isPairError || pairError);
    
    // Create pair if it doesn't exist
    const { data: createPairData, write: createPair, isLoading: isCreatePairLoading } = useContractWrite({
        address: QIEDEX_CONFIG.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'createPair',
        args: selectedToken && selectedToken !== zeroAddress 
            ? [QIEDEX_CONFIG.WQIE, selectedToken]
            : undefined,
        mode: 'recklesslyUnprepared',
    });
    const { isLoading: isCreatePairTxLoading, isSuccess: isCreatePairSuccess } = useWaitForTransaction({
        hash: createPairData?.hash,
    });
    
    // Use the created pair address or existing pair address
    const finalPairAddress = (isCreatePairSuccess && createPairData?.receipt?.logs?.[0]?.address) || resolvedPairAddress;
    
    // Calculate required amounts
    const requiredTokenAmount = liquidityTokenAmount ? parseTokenAmount(liquidityTokenAmount, tokenDecimals) : 0n;
    const requiredQieAmount = liquidityQieAmount ? parseTokenAmount(liquidityQieAmount, 18) : 0n;
    
    // Calculate minimum amounts with slippage protection
    const { amountAMin, amountBMin } = calculateMinAmounts(requiredTokenAmount, requiredQieAmount, QIEDEX_CONFIG.SLIPPAGE_TOLERANCE);
    
    // Check token allowance for ROUTER (router handles the liquidity addition)
    const { allowance: tokenAllowanceForRouter } = useTokenAllowance(selectedToken, address, QIEDEX_CONFIG.ROUTER);
    const needsTokenApproval = selectedToken && selectedToken !== zeroAddress && tokenAllowanceForRouter < requiredTokenAmount;

    // Approve token to ROUTER
    const { config: approveTokenConfig } = usePrepareContractWrite({
        address: selectedToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [
            QIEDEX_CONFIG.ROUTER,
            requiredTokenAmount
        ],
        enabled: Boolean(
            selectedToken && 
            liquidityTokenAmount && 
            isConnected &&
            (pairExists || isCreatePairSuccess) &&
            needsTokenApproval
        ),
    });

    const { data: approveTokenData, write: approveToken, isLoading: isApproveLoading } = useContractWrite(approveTokenConfig);
    const { isLoading: isApproveTxLoading, isSuccess: isApproveSuccess } = useWaitForTransaction({
        hash: approveTokenData?.hash,
    });

    // Wrap QIE to WQIE first (required for QIEDex)
    const { data: wrapData, write: wrapQie, isLoading: isWrapLoading, error: wrapError } = useContractWrite({
        address: QIEDEX_CONFIG.WQIE,
        abi: WQIE_ABI,
        functionName: 'deposit',
        value: requiredQieAmount,
        mode: 'recklesslyUnprepared',
    });
    
    const { isLoading: isWrapTxLoading, isSuccess: isWrapSuccess } = useWaitForTransaction({
        hash: wrapData?.hash,
    });
    
    useEffect(() => {
        if (isWrapSuccess && wrapData?.hash) {
            console.log('✅ Wrap transaction confirmed! WQIE received.');
        }
    }, [isWrapSuccess, wrapData?.hash]);
    
    useEffect(() => {
        if (wrapError) {
            console.error('WQIE wrap error:', wrapError);
        }
    }, [wrapError]);

    // Check WQIE allowance for ROUTER
    const { allowance: wqieAllowanceForRouter } = useTokenAllowance(QIEDEX_CONFIG.WQIE, address, QIEDEX_CONFIG.ROUTER);
    const needsWqieApproval = QIEDEX_CONFIG.WQIE !== zeroAddress && wqieAllowanceForRouter < requiredQieAmount;

    // Approve WQIE for ROUTER
    const { config: approveWqieConfig } = usePrepareContractWrite({
        address: QIEDEX_CONFIG.WQIE,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [
            QIEDEX_CONFIG.ROUTER,
            requiredQieAmount
        ],
        enabled: Boolean(
            liquidityQieAmount && 
            QIEDEX_CONFIG.WQIE !== zeroAddress && 
            isConnected &&
            isWrapSuccess &&
            (pairExists || isCreatePairSuccess) &&
            needsWqieApproval
        ),
    });

    const { data: approveWqieData, write: approveWqie, isLoading: isApproveWqieLoading } = useContractWrite(approveWqieConfig);
    const { isLoading: isApproveWqieTxLoading, isSuccess: isApproveWqieSuccess } = useWaitForTransaction({
        hash: approveWqieData?.hash,
    });

    // Use Router's addLiquidity function - much cleaner and handles everything automatically
    const { config: addLiquidityConfig } = usePrepareContractWrite({
        address: QIEDEX_CONFIG.ROUTER,
        abi: ROUTER_ABI,
        functionName: 'addLiquidity',
        args: [
            QIEDEX_CONFIG.WQIE,           // tokenA (WQIE)
            selectedToken,                // tokenB (user's token)
            requiredQieAmount,            // amountADesired
            requiredTokenAmount,         // amountBDesired
            amountAMin,                  // amountAMin (with slippage)
            amountBMin,                  // amountBMin (with slippage)
            address,                     // to (user address)
            BigInt(QIEDEX_CONFIG.getDeadline())
        ],
        enabled: Boolean(
            selectedToken && 
            selectedToken !== zeroAddress &&
            liquidityTokenAmount && 
            liquidityQieAmount &&
            isConnected &&
            (pairExists || isCreatePairSuccess) &&
            (!needsTokenApproval || isApproveSuccess) &&
            isWrapSuccess &&
            (!needsWqieApproval || isApproveWqieSuccess) &&
            QIEDEX_CONFIG.ROUTER !== zeroAddress
        ),
    });

    const { data: addLiquidityData, write: addLiquidity, isLoading: isAddLiquidityLoading, error: addLiquidityError } = useContractWrite(addLiquidityConfig);
    const { isLoading: isAddLiquidityTxLoading, isSuccess: isAddLiquiditySuccess } = useWaitForTransaction({
        hash: addLiquidityData?.hash,
    });

    // Helper function to handle the full liquidity flow
    const handleAddLiquidity = () => {
        // Step 1: Create pair if it doesn't exist
        if (needsPairCreation && !isCreatePairSuccess && !isCreatePairLoading && !isCreatePairTxLoading) {
            createPair?.();
            return;
        }
        
        // Step 2: Wait for pair to be created if needed
        if (needsPairCreation && !isCreatePairSuccess) {
            console.log('Waiting for pair to be created...');
            return;
        }
        
        // Step 3: Approve token if needed
        if (needsTokenApproval && !isApproveSuccess) {
            approveToken?.();
            return;
        }
        
        // Step 4: Wrap QIE if needed
        if (!isWrapSuccess) {
            wrapQie?.();
            return;
        }
        
        // Step 5: Approve WQIE if needed
        if (needsWqieApproval && !isApproveWqieSuccess) {
            approveWqie?.();
            return;
        }
        
        // Step 6: Add liquidity using router
        if (addLiquidity) {
            addLiquidity();
        }
    };
    
    const writeError = addLiquidityError;

    // Get token info for swap quote (need decimals) - MUST be defined before using in swap configs
    const swapTokenOutInfo = useTokenInfo(swapTokenOut);
    const swapTokenInInfo = useTokenInfo(swapTokenIn);
    const swapTokenOutDecimals = swapTokenOutInfo.decimals || 18;
    const swapTokenInDecimals = swapTokenInInfo.decimals || 18;

    // Check if pair exists for swap token - MUST be defined before swap configs
    // Note: getPair returns zero address/empty data if pair doesn't exist - this is normal, not an error
    const { data: swapPairAddress, error: swapPairError, isError: isSwapPairError } = useContractRead({
        address: QIEDEX_CONFIG.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: swapTokenOut && swapTokenOut !== zeroAddress && swapDirection === 'nativeToToken'
            ? [QIEDEX_CONFIG.WQIE, swapTokenOut]
            : swapTokenIn && swapTokenIn !== zeroAddress && swapDirection === 'tokenToNative'
            ? [swapTokenIn, QIEDEX_CONFIG.WQIE]
            : undefined,
        enabled: Boolean(
            ((swapDirection === 'nativeToToken' && swapTokenOut && swapTokenOut !== zeroAddress) ||
             (swapDirection === 'tokenToNative' && swapTokenIn && swapTokenIn !== zeroAddress))
        ),
        watch: true,
        // Suppress errors - zero address/empty data return is expected when pair doesn't exist
        throwOnError: false,
        retry: false, // Don't retry - empty data means pair doesn't exist
    });
    
    // Pair exists if address is not zero (zero address means pair doesn't exist)
    // If there's an error (empty data), treat it as pair doesn't exist (zero address)
    const resolvedSwapPairAddress = (isSwapPairError || swapPairError) ? zeroAddress : (swapPairAddress || zeroAddress);
    const swapPairExists = resolvedSwapPairAddress && resolvedSwapPairAddress !== zeroAddress && resolvedSwapPairAddress !== '0x0000000000000000000000000000000000000000';

    // Check pair reserves to verify liquidity exists
    const { data: pairReserves, isLoading: isReservesLoading } = useContractRead({
        address: resolvedSwapPairAddress && resolvedSwapPairAddress !== zeroAddress ? resolvedSwapPairAddress : undefined,
        abi: PAIR_ABI,
        functionName: 'getReserves',
        enabled: Boolean(swapPairExists && resolvedSwapPairAddress && resolvedSwapPairAddress !== zeroAddress),
        watch: true,
        throwOnError: false,
    });
    
    // Check if pair has liquidity (both reserves > 0)
    const hasLiquidity = pairReserves && 
        Array.isArray(pairReserves) && 
        pairReserves.length >= 2 &&
        pairReserves[0] > 0n && 
        pairReserves[1] > 0n;

    // Get swap quote using getAmountsOut - MUST be defined before swapAmountOutMin
    const { data: swapQuote, isLoading: isQuoteLoading, error: quoteError } = useContractRead({
        address: QIEDEX_CONFIG.ROUTER,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: swapDirection === 'nativeToToken' && swapAmountIn && swapTokenOut && swapTokenOut !== zeroAddress
            ? [
                parseUnits(swapAmountIn || '0', 18),
                [QIEDEX_CONFIG.WQIE, swapTokenOut]
              ]
            : swapDirection === 'tokenToNative' && swapAmountIn && swapTokenIn && swapTokenIn !== zeroAddress
            ? [
                parseUnits(swapAmountIn || '0', swapTokenInDecimals),
                [swapTokenIn, QIEDEX_CONFIG.WQIE]
              ]
            : undefined,
        enabled: Boolean(
            swapAmountIn && 
            parseFloat(swapAmountIn) > 0 &&
            QIEDEX_CONFIG.ROUTER !== zeroAddress && 
            ((swapDirection === 'nativeToToken' && swapTokenOut && swapTokenOut !== zeroAddress) ||
             (swapDirection === 'tokenToNative' && swapTokenIn && swapTokenIn !== zeroAddress))
        ),
        watch: true,
    });

    // Calculate minimum output with proper slippage protection
    const swapAmountOutMin = swapQuote && Array.isArray(swapQuote) && swapQuote.length > 0
        ? QIEDEX_CONFIG.getAmountOutMin(swapQuote[swapQuote.length - 1], QIEDEX_CONFIG.SLIPPAGE_TOLERANCE)
        : 0n;

    // Swap: Native to Token (QIE -> Token via WQIE)
    const { config: swapNativeConfig } = usePrepareContractWrite({
        address: QIEDEX_CONFIG.ROUTER,
        abi: ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [
            swapAmountOutMin, // Minimum output with slippage protection
            [QIEDEX_CONFIG.WQIE, swapTokenOut],
            address,
            BigInt(QIEDEX_CONFIG.getDeadline()),
        ],
        value: swapAmountIn ? parseTokenAmount(swapAmountIn, 18) : 0n,
        enabled: Boolean(
            swapAmountIn && 
            parseFloat(swapAmountIn) > 0 &&
            swapTokenOut && 
            swapTokenOut !== zeroAddress &&
            swapAmountOutMin > 0n &&
            swapPairExists &&
            !quoteError &&
            isConnected &&
            QIEDEX_CONFIG.ROUTER !== zeroAddress
        ),
    });

    const { write: swapNativeToToken, isLoading: isSwapNativeLoading } = useContractWrite(swapNativeConfig);

    // Swap: Token to Native (Token -> QIE via WQIE)
    const { config: swapTokenConfig } = usePrepareContractWrite({
        address: QIEDEX_CONFIG.ROUTER,
        abi: ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [
            swapAmountIn ? parseTokenAmount(swapAmountIn, swapTokenInDecimals) : 0n,
            swapAmountOutMin, // Minimum output with slippage protection
            [swapTokenIn, QIEDEX_CONFIG.WQIE],
            address,
            BigInt(QIEDEX_CONFIG.getDeadline()),
        ],
        enabled: Boolean(
            swapAmountIn && 
            parseFloat(swapAmountIn) > 0 &&
            swapTokenIn && 
            swapTokenIn !== zeroAddress &&
            swapAmountOutMin > 0n &&
            swapPairExists &&
            !quoteError &&
            isConnected &&
            QIEDEX_CONFIG.ROUTER !== zeroAddress
        ),
    });

    const { write: swapTokenToNative, isLoading: isSwapTokenLoading } = useContractWrite(swapTokenConfig);

    // Combined loading state for swaps
    const isSwapLoading = isSwapNativeLoading || isSwapTokenLoading;

    // Update swapAmountOut when quote is received
    useEffect(() => {
        if (swapQuote && Array.isArray(swapQuote) && swapQuote.length > 0) {
            const outputAmount = swapQuote[swapQuote.length - 1]; // Last element is the output
            if (outputAmount && outputAmount > 0n) {
                // Use appropriate decimals based on direction
                const decimals = swapDirection === 'nativeToToken' ? swapTokenOutDecimals : 18;
                const formatted = formatUnits(outputAmount, decimals);
                setSwapAmountOut(formatted);
            } else {
            setSwapAmountOut('');
            }
        } else if (!isQuoteLoading && swapAmountIn && (swapTokenOut || swapTokenIn)) {
            // If quote fails, clear the output (pair might not exist or no liquidity)
            if (quoteError) {
                console.warn('Swap quote error (pair might not exist or no liquidity):', quoteError);
            }
            setSwapAmountOut('');
        }
    }, [swapQuote, isQuoteLoading, quoteError, swapAmountIn, swapTokenOut, swapTokenIn, swapDirection, swapTokenOutDecimals]);

    // Effect to switch tab on success
    useEffect(() => {
        if (isCreateSuccess) {
            setActiveTab('dashboard');
            refetchTokens();
            // Reset form
            setName('');
            setTicker('');
            setSupply('');
            setDecimals('18');
        }
    }, [isCreateSuccess, refetchTokens]);

    // Get selected token info - only call hooks when token is selected
    const selectedTokenInfo = useTokenInfo(selectedToken);
    const selectedTokenBalance = useTokenBalance(selectedToken, address);

    return (
        <div className="min-h-screen w-full bg-black text-white font-sans selection:bg-pink-500/30 selection:text-white overflow-x-hidden">
            {/* Subtle Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black via-slate-950 to-black" />
            </div>

            {/* Navbar - QieLend Style */}
            <header className="relative z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
                <div className="w-full px-4 lg:px-6">
                    <div className="flex items-center justify-between h-28 relative">
                        {/* Logo - Extreme Left */}
                        <div className="flex items-center cursor-pointer group" onClick={() => setActiveTab('home')}>
                            <div className="relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 rounded-lg blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                                <h1 className="relative text-4xl lg:text-6xl font-black text-white tracking-wide antialiased uppercase bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" style={{ letterSpacing: '0.05em' }}>
                                    emojicoin
                                </h1>
                            </div>
                        </div>

                        {/* Navigation Links - Centered (only when not on home) */}
                        {activeTab !== 'home' && (
                            <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-12">
                                {['create', 'dashboard', 'portfolio', 'swap'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`relative transition-all duration-200 capitalize font-black text-3xl ${
                                            activeTab === tab
                                                ? 'text-white'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {tab === 'dashboard' ? 'My Tokens' : tab === 'create' ? 'Create' : tab === 'portfolio' ? 'Portfolio' : 'Swap'}
                                        {activeTab === tab && (
                                            <span className="absolute bottom-0 left-0 right-0 h-1 bg-white"></span>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        )}

                        {/* Right Side - Launch App or Connect Wallet - Extreme Right */}
                        <div className="flex items-center gap-4 ml-auto">
                            {activeTab === 'home' ? (
                                /* Launch App Button - Extreme Right (on home) */
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className="px-10 py-5 rounded-lg bg-white/10 hover:bg-white/15 border-2 border-white/20 transition-all font-black text-xl text-white"
                                >
                                    Launch App
                                </button>
                            ) : (
                                /* Connect Wallet Button - Extreme Right (when app launched) */
                                <div className="flex items-center gap-4">
                                    {isConnected ? (
                                        <div className="flex items-center gap-3 px-5 py-4 rounded-lg bg-white/5 border-2 border-white/10">
                                            {/* MetaMask Icon Placeholder */}
                                            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                                <span className="text-xl">🦊</span>
                                            </div>
                                            <span className="text-lg font-black text-white">
                                                {address?.slice(0, 6)}...{address?.slice(-4)}
                                            </span>
                                            <button
                                                onClick={() => disconnect()}
                                                className="ml-2 px-5 py-3 rounded bg-white/10 hover:bg-white/15 text-base font-black text-white transition-all"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if (metaMaskConnector) {
                                                    connect({ connector: metaMaskConnector });
                                                } else {
                                                    handleDirectMetaMaskConnection(connect, connectors[0]);
                                                }
                                            }}
                                            disabled={isConnecting}
                                            className="px-10 py-5 rounded-lg bg-white hover:bg-white/90 text-black font-black text-xl transition-all disabled:opacity-50"
                                        >
                                            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area - Full Screen */}
            <div className="relative z-10 min-h-screen">
                {/* Content Area - Full Page Sections */}
                <main className="w-full">
                    <Routes>
                        {/* LANDING PAGE */}
                        <Route path="/" element={
                        <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                            <div className="max-w-7xl mx-auto">
                                {/* HERO SECTION - First */}
                                <div className="text-center mb-0 mt-20 min-h-[80vh] flex flex-col justify-center">
                                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 leading-tight tracking-tight">
                                        <span className="text-white">
                                            TOKEN LAUNCHER
                                        </span>
                                        <br />
                                        <span className="text-white">
                                            FOR QIE NETWORK
                                        </span>
                                    </h1>
                                    <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mt-6 leading-relaxed font-bold">
                                        Create, launch, and trade emoji-based tokens on QIE Network.
                                    </p>
                                </div>

                                {/* Stats Cards - Below Hero (only visible when scrolling) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-40">
                                    {/* Total Tokens Created */}
                                    <div className="bg-white/5 border-2 border-white/10 rounded-lg p-6 hover:bg-white/8 transition-all">
                                        <div className="text-sm text-slate-300 uppercase tracking-wider font-black mb-3">
                                            TOTAL TOKENS CREATED®
                                        </div>
                                        <div className="text-5xl font-black text-white">
                                            {tokenAddresses.length}
                                        </div>
                                    </div>

                                    {/* Total Transactions */}
                                    <div className="bg-white/5 border-2 border-white/10 rounded-lg p-6 hover:bg-white/8 transition-all">
                                        <div className="text-sm text-slate-300 uppercase tracking-wider font-black mb-3">
                                            TOTAL TRANSACTIONS®
                                        </div>
                                        <div className="text-5xl font-black text-white">
                                            {tokenAddresses.length > 0 ? tokenAddresses.length * 2 : '0'}
                                        </div>
                                    </div>

                                    {/* Total Users */}
                                    <div className="bg-white/5 border-2 border-white/10 rounded-lg p-6 hover:bg-white/8 transition-all">
                                        <div className="text-sm text-slate-300 uppercase tracking-wider font-black mb-3">
                                            TOTAL USERS®
                                        </div>
                                        <div className="text-5xl font-black text-white">
                                            {isConnected ? '1' : '0'}
                                        </div>
                                    </div>

                                    {/* Active Chains */}
                                    <div className="bg-white/5 border-2 border-white/10 rounded-lg p-6 hover:bg-white/8 transition-all">
                                        <div className="text-sm text-slate-300 uppercase tracking-wider font-black mb-3">
                                            ACTIVE CHAINS®
                                        </div>
                                        <div className="text-5xl font-black text-white">
                                            1
                                        </div>
                                    </div>
                                </div>

                                {/* About the App Section - Last */}
                                <div className="max-w-5xl mx-auto mt-40 mb-20">
                                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-16 text-center">
                                        About the App
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-5xl">🚀</span>
                                                <h3 className="text-2xl md:text-3xl font-black text-white">Instant Token Creation</h3>
                                            </div>
                                            <p className="text-base md:text-lg text-slate-300 font-bold">
                                                Create your own token in seconds with a custom emoji symbol. No coding required.
                                            </p>
                                        </div>
                                        <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-5xl">💧</span>
                                                <h3 className="text-2xl md:text-3xl font-black text-white">Liquidity Integration</h3>
                                            </div>
                                            <p className="text-base md:text-lg text-slate-300 font-bold">
                                                Add liquidity directly to QIEDex. Your tokens become tradeable immediately.
                                            </p>
                                        </div>
                                        <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-5xl">🔄</span>
                                                <h3 className="text-2xl md:text-3xl font-black text-white">Swap Functionality</h3>
                                            </div>
                                            <p className="text-base md:text-lg text-slate-300 font-bold">
                                                Trade your tokens directly on the platform. Swap between QIE and any token.
                                            </p>
                                        </div>
                                        <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-5xl">📊</span>
                                                <h3 className="text-2xl md:text-3xl font-black text-white">Token Dashboard</h3>
                                            </div>
                                            <p className="text-base md:text-lg text-slate-300 font-bold">
                                                Manage all your tokens from one convenient dashboard. View balances and track your portfolio.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        } />
                        
                        {/* CREATE PAGE */}
                        <Route path="/create" element={
                        <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                            <div className="max-w-5xl mx-auto">
                                <div className="mb-12 text-center">
                                    <h2 className="text-4xl lg:text-6xl font-black text-white mb-4">
                                        Launch Your EmojiCoin
                            </h2>
                                    <p className="text-slate-300 text-xl font-bold">Create your own token in seconds</p>
                                </div>

                            {!isConnected && (
                                    <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-300 text-sm text-center">
                                    ⚠️ Please connect your wallet to create a token
                                </div>
                            )}

                                <div className="space-y-10">
                                    <div className="space-y-3">
                                        <label className="text-base text-slate-300 uppercase tracking-wider font-black">
                                            Token Name
                                        </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Cool Cat Coin"
                                            className="w-full bg-white/5 border-2 border-white/10 rounded-lg px-5 py-4 text-xl font-bold focus:outline-none focus:ring-0 focus:border-white/30 transition-all placeholder:text-slate-500/50 text-white"
                                    />
                                </div>

                                {/* Ticker Input */}
                                    <div className="space-y-3">
                                        <label className="text-base text-slate-300 uppercase tracking-wider font-black">
                                            Emoji Symbol (Ticker)
                                        </label>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            value={ticker}
                                            onChange={(e) => setTicker(e.target.value)}
                                            placeholder="🐯"
                                            maxLength="2"
                                                className="w-32 text-center text-7xl bg-white/5 border-2 border-white/10 rounded-lg px-4 py-4 focus:outline-none focus:ring-0 focus:border-white/30 transition-all placeholder:text-slate-500/50"
                                        />
                                            <div className="text-base text-slate-300 flex-1 flex items-center bg-white/5 rounded-lg px-5 py-4 border-2 border-white/10 font-bold">
                                            👈 Select one below or paste your own!
                                        </div>
                                    </div>

                                    {/* Emoji Picker */}
                                        <div className="pt-3">
                                            <div className="text-sm text-slate-300 mb-4 font-black uppercase tracking-wider">Popular Picks</div>
                                            <div className="flex flex-wrap gap-3 p-5 bg-white/5 rounded-lg border-2 border-white/10 max-h-48 overflow-y-auto">
                                            {['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🦄', '🚀', '🌙', '💎', '🔥', '⚡', '😎', '👻', '👽', '🤖', '💩'].map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => setTicker(emoji)}
                                                        className="w-14 h-14 text-3xl flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 hover:scale-110 transition-all border border-white/10"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-base text-slate-300 uppercase tracking-wider font-black">
                                                Total Supply
                                            </label>
                                        <input
                                            type="number"
                                            value={supply}
                                            onChange={(e) => setSupply(e.target.value)}
                                            placeholder="1,000,000,000"
                                                className="w-full bg-white/5 border-2 border-white/10 rounded-lg px-5 py-4 text-xl font-bold focus:outline-none focus:ring-0 focus:border-white/30 transition-all placeholder:text-slate-500/50 text-white"
                                        />
                                    </div>

                                        <div className="space-y-3">
                                            <label className="text-base text-slate-300 uppercase tracking-wider font-black">
                                                Decimals
                                            </label>
                                        <input
                                            type="number"
                                            value={decimals}
                                            onChange={(e) => setDecimals(e.target.value)}
                                            placeholder="18"
                                                className="w-full bg-white/5 border-2 border-white/10 rounded-lg px-5 py-4 text-xl font-bold focus:outline-none focus:ring-0 focus:border-white/30 transition-all placeholder:text-slate-500/50 text-white"
                                        />
                                            <div className="text-sm text-slate-400 text-right pr-1 font-bold">Standard: 18</div>
                                    </div>
                                </div>

                                    <div className="pt-8">
                                    <button
                                        disabled={!createToken || isCreateLoading || isCreateTxLoading || !isConnected}
                                        onClick={() => createToken?.()}
                                            className="w-full py-5 rounded-lg bg-white hover:bg-white/90 text-black font-black text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCreateLoading || isCreateTxLoading ? '🚀 Launching...' : '🚀 Launch Into Orbit'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        } />
                        
                        {/* DASHBOARD PAGE */}
                        <Route path="/dashboard" element={
                        <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                            <div className="max-w-7xl mx-auto">
                                <div className="mb-12 text-center">
                                    <h2 className="text-4xl lg:text-6xl font-black text-white mb-4">
                                        My Tokens
                                    </h2>
                                    <p className="text-slate-300 text-xl font-bold">Manage your deployed tokens</p>
                                </div>

                            {!isConnected ? (
                                    <div className="backdrop-blur-xl bg-white/5 border-0 border-b-2 border-white/10 rounded-t-3xl p-16 text-center">
                                        <p className="text-slate-300 text-xl">Please connect your wallet to view your tokens</p>
                                </div>
                            ) : tokensLoading ? (
                                    <div className="backdrop-blur-xl bg-white/5 border-0 border-b-2 border-white/10 rounded-t-3xl p-16 text-center">
                                        <p className="text-slate-300 text-xl">Loading your tokens...</p>
                                </div>
                            ) : visibleTokens.length === 0 ? (
                                    <div className="backdrop-blur-xl bg-white/5 border-0 border-b-2 border-white/10 rounded-t-3xl p-16 text-center">
                                        <p className="text-slate-300 text-xl mb-8">You haven't created any tokens yet</p>
                                    <button
                                        onClick={() => setActiveTab('create')}
                                            className="px-10 py-5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 text-white font-bold text-lg shadow-2xl shadow-pink-500/30 hover:shadow-pink-500/50 hover:scale-105 transition-all backdrop-blur-sm"
                                    >
                                        Create Your First Token
                                    </button>
                                </div>
                            ) : (
                                    <div className="space-y-8">
                                        {hiddenTokens.length > 0 && (
                                            <div className="flex justify-between items-center mb-4">
                                                <p className="text-slate-400 text-sm">
                                                    {hiddenTokens.length} token(s) hidden
                                                </p>
                                                <button
                                                    onClick={clearHiddenTokens}
                                                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-sm font-bold text-white transition-all"
                                                >
                                                    Show All Tokens
                                                </button>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-8">
                                            {visibleTokens.map((tokenAddr) => (
                                    <TokenCard
                                        key={tokenAddr}
                                        tokenAddress={tokenAddr}
                                        userAddress={address}
                                        onAddLiquidity={() => {
                                            setSelectedToken(tokenAddr);
                                            setShowLiquidityModal(true);
                                        }}
                                        onHide={() => hideToken(tokenAddr)}
                                    />
                                            ))}
                                        </div>

                            {tokenAddresses.length > 0 && (
                                            <div className="backdrop-blur-xl bg-blue-500/20 border-0 border-b-2 border-blue-500/30 rounded-t-2xl p-6 flex gap-4 items-start">
                                                <div className="text-3xl">ℹ️</div>
                                                <div className="text-sm text-blue-200 font-medium">
                                                    <strong className="text-blue-100">Action Required:</strong> After deploying your token, add liquidity to enable trading on QIEDex.
                                    </div>
                                </div>
                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                        } />
                        
                        {/* SWAP PAGE */}
                        <Route path="/swap" element={
                        <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                            <div className="max-w-5xl mx-auto">
                                <div className="mb-12 text-center">
                                    <h2 className="text-4xl lg:text-6xl font-black text-white mb-4">
                                        Swap Tokens
                                    </h2>
                                    <p className="text-slate-300 text-xl font-bold">Exchange tokens on QIEDex</p>
                                </div>
                        <SwapInterface
                            swapAmountIn={swapAmountIn}
                            setSwapAmountIn={setSwapAmountIn}
                            swapAmountOut={swapAmountOut}
                            setSwapAmountOut={setSwapAmountOut}
                            swapTokenIn={swapTokenIn}
                            setSwapTokenIn={setSwapTokenIn}
                            swapTokenOut={swapTokenOut}
                            setSwapTokenOut={setSwapTokenOut}
                            swapDirection={swapDirection}
                            setSwapDirection={setSwapDirection}
                            qieBalance={qieBalance}
                            tokenAddresses={visibleTokens}
                            onSwap={swapDirection === 'nativeToToken' ? swapNativeToToken : swapTokenToNative}
                            isSwapLoading={isSwapLoading}
                            isConnected={isConnected}
                            isQuoteLoading={isQuoteLoading}
                            quoteError={quoteError}
                            swapPairAddress={resolvedSwapPairAddress}
                            swapPairExists={swapPairExists}
                            hasLiquidity={hasLiquidity}
                            isReservesLoading={isReservesLoading}
                        />
                            </div>
                        </div>
                        } />
                        
                        {/* PORTFOLIO PAGE */}
                        <Route path="/portfolio" element={
                        <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                            <div className="max-w-7xl mx-auto">
                                <div className="mb-12 text-center">
                                    <h2 className="text-4xl lg:text-6xl font-black text-white mb-4">
                                        Portfolio
                                    </h2>
                                    <p className="text-slate-300 text-xl font-bold">Your token holdings</p>
                                </div>

                                {!isConnected ? (
                                    <div className="backdrop-blur-xl bg-white/5 border-0 border-b-2 border-white/10 rounded-t-3xl p-16 text-center">
                                        <p className="text-slate-300 text-xl">Please connect your wallet to view your portfolio</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {visibleTokens.length === 0 ? (
                                            <div className="backdrop-blur-xl bg-white/5 border-0 border-b-2 border-white/10 rounded-t-3xl p-16 text-center">
                                                <p className="text-slate-300 text-xl mb-8">No tokens in your portfolio</p>
                                                <button
                                                    onClick={() => setActiveTab('create')}
                                                    className="px-10 py-5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 text-white font-bold text-lg shadow-2xl shadow-pink-500/30 hover:shadow-pink-500/50 hover:scale-105 transition-all backdrop-blur-sm"
                                                >
                                                    Create Your First Token
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-6">
                                                {visibleTokens.map((tokenAddr) => (
                                                    <PortfolioTokenCard
                                                        key={tokenAddr}
                                                        tokenAddress={tokenAddr}
                                                        userAddress={address}
                                                        onAddLiquidity={() => {
                                                            setSelectedToken(tokenAddr);
                                                            setShowLiquidityModal(true);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        } />
                    </Routes>
                </main>
            </div>

            {/* LIQUIDITY MODAL */}
            {showLiquidityModal && selectedToken && (
                <LiquidityModal
                    tokenAddress={selectedToken}
                    userAddress={address}
                    qieBalance={qieBalance}
                    liquidityTokenAmount={liquidityTokenAmount}
                    setLiquidityTokenAmount={setLiquidityTokenAmount}
                    liquidityQieAmount={liquidityQieAmount}
                    setLiquidityQieAmount={setLiquidityQieAmount}
                    onClose={() => {
                        setShowLiquidityModal(false);
                        setSelectedToken(null);
                        setLiquidityTokenAmount('');
                        setLiquidityQieAmount('');
                    }}
                    onApprove={approveToken}
                    onAddLiquidity={handleAddLiquidity}
                    isApproveLoading={isApproveLoading || isApproveTxLoading}
                    isApproveSuccess={isApproveSuccess || !needsTokenApproval}
                    needsApproval={needsTokenApproval}
                    qieBalance={qieBalance}
                    requiredQieAmount={requiredQieAmount}
                    isAddLiquidityLoading={isAddLiquidityLoading || isAddLiquidityTxLoading || isCreatePairLoading || isCreatePairTxLoading || isApproveLoading || isApproveTxLoading || isWrapLoading || isWrapTxLoading || isApproveWqieLoading || isApproveWqieTxLoading}
                    isAddLiquiditySuccess={isAddLiquiditySuccess}
                    writeError={writeError}
                    pairAddress={pairAddress}
                    pairExists={pairExists}
                    needsPairCreation={needsPairCreation}
                    isCreatePairLoading={isCreatePairLoading || isCreatePairTxLoading}
                    isCreatePairSuccess={isCreatePairSuccess}
                    onCreatePair={createPair}
                    onWrapQie={wrapQie}
                    onApproveWqie={approveWqie}
                    isWrapLoading={isWrapLoading || isWrapTxLoading}
                    isWrapSuccess={isWrapSuccess}
                    wrapError={wrapError}
                    isApproveWqieLoading={isApproveWqieLoading || isApproveWqieTxLoading}
                    isApproveWqieSuccess={isApproveWqieSuccess || !needsWqieApproval}
                    needsWqieApproval={needsWqieApproval}
                    wqieBalance={wqieBalance}
                    wqieBalanceError={wqieBalanceError}
                    isConnected={isConnected}
                />
            )}
        </div>
    );
}

// Token Card Component
function TokenCard({ tokenAddress, userAddress, onAddLiquidity, onHide }) {
    const tokenInfo = useTokenInfo(tokenAddress);
    const tokenBalance = useTokenBalance(tokenAddress, userAddress);
    
    // Get pair address for price
    const { data: pairAddr } = useContractRead({
        address: QIEDEX_CONFIG.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [QIEDEX_CONFIG.WQIE, tokenAddress],
        enabled: Boolean(tokenAddress && tokenAddress !== zeroAddress),
        watch: true,
        throwOnError: false,
    });
    
    const pairAddress = pairAddr && pairAddr !== zeroAddress ? pairAddr : zeroAddress;
    
    // Get reserves for price calculation
    const { data: reserves } = useContractRead({
        address: pairAddress !== zeroAddress ? pairAddress : undefined,
        abi: PAIR_ABI,
        functionName: 'getReserves',
        enabled: Boolean(pairAddress && pairAddress !== zeroAddress),
        watch: true,
        throwOnError: false,
    });
    
    // Calculate price: reserve0 is WQIE, reserve1 is token
    let tokenPrice = null;
    if (reserves && Array.isArray(reserves) && reserves.length >= 2 && reserves[0] > 0n && reserves[1] > 0n) {
        const wqieReserve = reserves[0];
        const tokenReserve = reserves[1];
        // Price = WQIE reserve / Token reserve (price per token in WQIE)
        const priceInWqie = Number(wqieReserve) / Number(tokenReserve);
        tokenPrice = priceInWqie;
    }
    
    // Format supply and balance - ensure decimals is a number
    // Convert to number in case it's BigInt or string
    const decimals = tokenInfo.decimals ? Number(tokenInfo.decimals) : 18;
    
    // Format with proper decimals handling
    let formattedSupply = '0';
    let formattedBalance = '0';
    
    if (tokenInfo.totalSupply && tokenInfo.totalSupply > 0n) {
        try {
            formattedSupply = formatUnits(tokenInfo.totalSupply, decimals);
        } catch (e) {
            console.error('Error formatting supply:', e, 'decimals:', decimals);
            formattedSupply = tokenInfo.totalSupply.toString();
        }
    }
    
    if (tokenBalance.balance && tokenBalance.balance > 0n) {
        try {
            formattedBalance = formatUnits(tokenBalance.balance, decimals);
        } catch (e) {
            console.error('Error formatting balance:', e, 'decimals:', decimals);
            formattedBalance = tokenBalance.balance.toString();
        }
    }

    return (
        <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8 hover:bg-white/8 transition-all relative">
            <button
                onClick={onHide}
                className="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl font-bold transition-all"
                title="Hide token"
            >
                ×
            </button>
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-white/10 rounded-lg flex items-center justify-center text-6xl flex-shrink-0">
                        {tokenInfo.symbol || '🪙'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-2xl font-black mb-2 text-white truncate">
                            {tokenInfo.name || 'Loading...'}
                        </h3>
                        <div className="text-lg text-slate-300 font-bold">
                            {tokenInfo.symbol || '...'}
                        </div>
                    </div>
                </div>
                
                <div className="space-y-3 pt-3 border-t border-white/10">
                    <div className="flex justify-between text-lg">
                        <span className="text-slate-400 font-bold">Supply:</span>
                        <span className="text-white font-black text-xl">{parseFloat(formattedSupply).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                        <span className="text-slate-400 font-bold">Your Balance:</span>
                        <span className="text-white font-black text-xl">{parseFloat(formattedBalance).toLocaleString()}</span>
                    </div>
                    {tokenPrice !== null && (
                        <div className="flex justify-between text-lg pt-2 border-t border-white/10">
                            <span className="text-slate-400 font-bold">Price:</span>
                            <span className="text-green-400 font-black text-xl">
                                {tokenPrice < 0.0001 ? tokenPrice.toExponential(2) : tokenPrice.toFixed(6)} QIE
                            </span>
                        </div>
                    )}
                    {tokenPrice === null && (
                        <div className="flex justify-between text-lg pt-2 border-t border-white/10">
                            <span className="text-slate-400 font-bold">Price:</span>
                            <span className="text-slate-500 font-bold text-base">No liquidity</span>
                        </div>
                    )}
                    <div className="pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-500 font-mono break-all flex-1">
                                {tokenAddress}
                            </span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(tokenAddress);
                                    // Show feedback
                                    const btn = event.target;
                                    const originalText = btn.textContent;
                                    btn.textContent = '✓';
                                    setTimeout(() => {
                                        btn.textContent = originalText;
                                    }, 2000);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold transition-all flex-shrink-0"
                                title="Copy address"
                            >
                                📋
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-3 pt-3">
                    <button
                        onClick={onAddLiquidity}
                        className="flex-1 px-6 py-4 rounded-lg bg-white hover:bg-white/90 text-black font-black text-base transition-all"
                    >
                        💧 Add Liquidity
                    </button>
                    <a
                        href={`https://mainnet.qie.digital/address/${tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-base font-bold text-center border-2 border-white/10"
                    >
                        Explorer
                    </a>
                </div>
            </div>
        </div>
    );
}

// Swap Interface Component
function SwapInterface({
    swapAmountIn,
    setSwapAmountIn,
    swapAmountOut,
    setSwapAmountOut,
    swapTokenIn,
    setSwapTokenIn,
    swapTokenOut,
    setSwapTokenOut,
    swapDirection,
    setSwapDirection,
    qieBalance,
    tokenAddresses,
    onSwap,
    isSwapLoading,
    isConnected,
    isQuoteLoading,
    quoteError,
    swapPairAddress: resolvedSwapPairAddress,
    swapPairExists,
    hasLiquidity,
    isReservesLoading,
}) {
    const [showTokenSelector, setShowTokenSelector] = useState(false);

    if (!isConnected) {
        return (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
                <p className="text-slate-400">Please connect your wallet to swap tokens</p>
                                </div>
        );
    }

    return (
        <>
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 lg:p-8 relative">
                <div className="relative z-10">

                            {/* From Input */}
                    <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8 mb-4">
                                    <div className="flex justify-between mb-4">
                                        <span className="text-slate-300 text-base font-black">You pay</span>
                                        <span className="text-slate-300 text-base font-black">
                        Balance: {qieBalance ? parseFloat(formatUnits(qieBalance.value, 18)).toFixed(4) : '0'} QIE
                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                    <input
                        type="number"
                        placeholder="0.0"
                        value={swapAmountIn}
                        onChange={(e) => setSwapAmountIn(e.target.value)}
                                            className="bg-transparent text-5xl font-black w-1/2 focus:outline-none text-white"
                    />
                                        <button className="bg-white/10 hover:bg-white/15 border-2 border-white/20 px-6 py-3 rounded-lg flex items-center gap-2 font-black text-base transition-all">
                                            <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-black">Q</span>
                                        QIE
                                    </button>
                                </div>
                            </div>

                            {/* Arrow */}
                    <div className="flex justify-center -my-2 relative z-10">
                <button
                    onClick={() => setSwapDirection(swapDirection === 'nativeToToken' ? 'tokenToNative' : 'nativeToToken')}
                            className="bg-white/5 border-2 border-white/10 rounded-full p-3 text-2xl hover:text-white hover:bg-white/10 transition-all"
                >
                                    ⬇️
                                </button>
                            </div>

                            {/* To Input */}
                    <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8 mt-4">
                                    <div className="flex justify-between mb-4">
                                        <span className="text-slate-300 text-base font-black">You receive</span>
                                        <span className="text-slate-300 text-base font-black">
                                        {isQuoteLoading ? 'Calculating...' : quoteError ? 'No liquidity' : 'Balance: 0'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                    <input
                        type="number"
                        placeholder={isQuoteLoading ? "Calculating..." : "0.0"}
                        value={swapAmountOut}
                        readOnly
                                            className="bg-transparent text-5xl font-black w-1/2 focus:outline-none cursor-not-allowed opacity-80 text-white"
                    />
                    <TokenSelectorButton
                        tokenAddress={swapTokenOut}
                        onClick={() => setShowTokenSelector(true)}
                    />
                                </div>
                                {quoteError && swapAmountIn && swapTokenOut && (
                            <div className="mt-3 p-3 backdrop-blur-xl bg-yellow-500/20 border-0 border-b-2 border-yellow-500/30 rounded-t-xl text-xs text-yellow-200 space-y-1">
                                            <div className="font-semibold">⚠️ Cannot get swap quote. Possible reasons:</div>
                                        <div className="pl-2">
                                            • Pair doesn't exist: {swapPairExists ? '✅ Exists' : '❌ Not found'}
                                        </div>
                                        <div className="pl-2">
                                                • Liquidity: {isReservesLoading ? 'Checking...' : hasLiquidity ? '✅ Has liquidity' : '❌ No liquidity'}
                                        </div>
                                        <div className="pl-2">
                                            • Make sure you've added liquidity for this token
                                        </div>
                                    </div>
                                )}
                        {swapPairExists && !quoteError && resolvedSwapPairAddress && resolvedSwapPairAddress !== zeroAddress && (
                            <div className="mt-3 p-3 backdrop-blur-xl bg-green-500/20 border-0 border-b-2 border-green-500/30 rounded-t-xl text-xs space-y-1">
                                            <div className="text-green-200 font-semibold">
                                                ✅ Pair exists at: {resolvedSwapPairAddress.slice(0, 6)}...{resolvedSwapPairAddress.slice(-4)}
                                            </div>
                                            {isReservesLoading ? (
                                                <div className="text-slate-300">Checking liquidity...</div>
                                            ) : hasLiquidity ? (
                                                <div className="text-green-200">✅ Liquidity available</div>
                                            ) : (
                                                <div className="text-yellow-200">⚠️ No liquidity - add liquidity to enable swapping</div>
                                            )}
                                        </div>
                                    )}
                        {!swapPairExists && swapTokenOut && swapTokenOut !== zeroAddress && (
                            <div className="mt-3 p-3 backdrop-blur-xl bg-yellow-500/20 border-0 border-b-2 border-yellow-500/30 rounded-t-xl text-xs text-yellow-200">
                                ⚠️ Pair doesn't exist. Add liquidity first to enable swapping.
                                    </div>
                                )}
                            </div>

                            {/* Swap Error Notifications */}
                            {!swapPairExists && swapTokenOut && swapTokenOut !== zeroAddress && (
                                <div className="mt-4 p-4 bg-red-500/20 border-2 border-red-500/30 rounded-lg text-red-300 text-sm font-bold">
                                    ⚠️ Cannot swap: Pair doesn't exist. Please add liquidity for this token first.
                                </div>
                            )}
                            {swapPairExists && !hasLiquidity && !isReservesLoading && (
                                <div className="mt-4 p-4 bg-red-500/20 border-2 border-red-500/30 rounded-lg text-red-300 text-sm font-bold">
                                    ⚠️ Cannot swap: Pair has no liquidity. Please add liquidity for this token first.
                                </div>
                            )}
                            {quoteError && swapAmountIn && swapTokenOut && swapTokenOut !== zeroAddress && (
                                <div className="mt-4 p-4 bg-red-500/20 border-2 border-red-500/30 rounded-lg text-red-300 text-sm font-bold">
                                    ⚠️ Cannot swap: Unable to get swap quote. Pair may not exist or has no liquidity.
                                </div>
                            )}
                            {swapAmountIn && parseFloat(swapAmountIn) <= 0 && (
                                <div className="mt-4 p-4 bg-yellow-500/20 border-2 border-yellow-500/30 rounded-lg text-yellow-300 text-sm font-bold">
                                    ⚠️ Please enter a valid amount to swap
                                </div>
                            )}
                            {(!swapTokenOut || swapTokenOut === zeroAddress) && (
                                <div className="mt-4 p-4 bg-yellow-500/20 border-2 border-yellow-500/30 rounded-lg text-yellow-300 text-sm font-bold">
                                    ⚠️ Please select a token to swap to
                                </div>
                            )}

                            {/* Swap Button */}
            <button
                onClick={() => {
                    if (!swapAmountIn || parseFloat(swapAmountIn) <= 0) {
                        return;
                    }
                    if (!swapTokenOut || swapTokenOut === zeroAddress) {
                        return;
                    }
                    if (!swapPairExists) {
                        return;
                    }
                    if (!hasLiquidity && !isReservesLoading) {
                        return;
                    }
                    if (quoteError || !swapAmountOut || parseFloat(swapAmountOut) <= 0) {
                        return;
                    }
                    onSwap?.();
                }}
                        disabled={!onSwap || isSwapLoading || isQuoteLoading || !swapAmountIn || !swapAmountOut || !swapTokenOut || swapTokenOut === zeroAddress || parseFloat(swapAmountIn || 0) <= 0 || parseFloat(swapAmountOut || 0) <= 0 || !!quoteError || !swapPairExists || (!hasLiquidity && !isReservesLoading)}
                        className="w-full mt-6 py-5 rounded-lg bg-white hover:bg-white/90 text-black font-black text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSwapLoading ? 'Swapping...' : isQuoteLoading ? 'Calculating quote...' : quoteError ? 'No Liquidity' : 'Swap'}
                            </button>

            {QIEDEX_CONFIG.ROUTER === zeroAddress && (
                        <div className="mt-4 p-4 backdrop-blur-xl bg-yellow-500/20 border-0 border-b-2 border-yellow-500/30 rounded-t-2xl text-yellow-200 text-sm">
                    ⚠️ QIEDex Router address not configured. Please update src/config/qiedex.js
                        </div>
                    )}

                                </div>
                            </div>

            {/* Token Selector Modal */}
            {showTokenSelector && (
                <TokenSelectorModal
                    tokenAddresses={tokenAddresses}
                    onSelect={(tokenAddr) => {
                        setSwapTokenOut(tokenAddr);
                        setShowTokenSelector(false);
                    }}
                    onClose={() => setShowTokenSelector(false)}
                />
            )}
                        </>
    );
}

// Token Selector Button Component
function TokenSelectorButton({ tokenAddress, onClick }) {
    const tokenInfo = useTokenInfo(tokenAddress);
    const hasToken = tokenAddress && tokenAddress !== zeroAddress;
    
    return (
        <button
            onClick={onClick}
            className="backdrop-blur-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 border border-white/20"
        >
            {hasToken ? (
                <>
                    <span className="text-lg">{tokenInfo.symbol || '🪙'}</span>
                    <span>{tokenInfo.symbol || 'Token'}</span>
                    <span className="text-xs opacity-70">▼</span>
                </>
            ) : (
                <>
                    <span className="text-lg">🪙</span>
                    <span>Select Token</span>
                    <span className="text-xs opacity-70">▼</span>
                </>
            )}
        </button>
    );
}

// Token Selector Item Component
function TokenSelectorItem({ tokenAddress, onSelect }) {
    const tokenInfo = useTokenInfo(tokenAddress);
    return (
        <button
            onClick={() => onSelect(tokenAddress)}
            className="w-full p-4 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all text-left flex items-center gap-3 shadow-lg"
        >
            <span className="text-2xl">{tokenInfo.symbol || '🪙'}</span>
            <div className="flex-1">
                <div className="font-bold">{tokenInfo.name || 'Loading...'}</div>
                <div className="text-xs text-slate-400 font-mono">{tokenAddress.slice(0, 10)}...{tokenAddress.slice(-6)}</div>
            </div>
        </button>
    );
}

// Token Selector Modal
function TokenSelectorModal({ tokenAddresses, onSelect, onClose }) {
    const [manualAddress, setManualAddress] = useState('');
    
    useEffect(() => {
        console.log('Token selector - available tokens:', tokenAddresses);
    }, [tokenAddresses]);
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl p-6 max-w-md w-full shadow-2xl relative max-h-96 overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    ✕
                </button>
                <h2 className="text-2xl font-bold mb-4">Select Token</h2>
                <div className="space-y-2">
                    {tokenAddresses.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-slate-400 mb-4">No tokens available</p>
                            <p className="text-xs text-slate-500 mb-4">You need to create a token first, or enter a token address manually:</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="0x..."
                                    value={manualAddress}
                                    onChange={(e) => setManualAddress(e.target.value)}
                                    className="flex-1 backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono shadow-lg"
                                />
                                <button
                                    onClick={() => {
                                        if (manualAddress && manualAddress.startsWith('0x') && manualAddress.length === 42) {
                                            onSelect(manualAddress);
                                        } else {
                                            alert('Please enter a valid token address (0x...)');
                                        }
                                    }}
                                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg text-sm font-bold shadow-lg backdrop-blur-sm border border-white/20"
                                >
                                    Use
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {tokenAddresses.map((addr) => (
                            <TokenSelectorItem
                                key={addr}
                                tokenAddress={addr}
                                onSelect={onSelect}
                            />
                            ))}
                            <div className="pt-4 border-t border-white/10">
                                <p className="text-xs text-slate-500 mb-2">Or enter token address manually:</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        value={manualAddress}
                                        onChange={(e) => setManualAddress(e.target.value)}
                                        className="flex-1 backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono shadow-lg"
                                    />
                                    <button
                                        onClick={() => {
                                            if (manualAddress && manualAddress.startsWith('0x') && manualAddress.length === 42) {
                                                onSelect(manualAddress);
                                            } else {
                                                alert('Please enter a valid token address (0x...)');
                                            }
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg text-sm font-bold shadow-lg backdrop-blur-sm border border-white/20"
                                    >
                                        Use
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            </div>
    );
}

// Liquidity Modal Component
function LiquidityModal({
    tokenAddress,
    userAddress,
    qieBalance,
    liquidityTokenAmount,
    setLiquidityTokenAmount,
    liquidityQieAmount,
    setLiquidityQieAmount,
    onClose,
    onApprove,
    onAddLiquidity,
    isApproveLoading,
    isApproveSuccess,
    needsApproval,
    requiredQieAmount,
    isAddLiquidityLoading,
    isAddLiquiditySuccess,
    writeError,
    pairAddress,
    pairExists,
    needsPairCreation,
    isCreatePairLoading,
    isCreatePairSuccess,
    onCreatePair,
    onWrapQie,
    onApproveWqie,
    isWrapLoading,
    isWrapSuccess,
    wrapError,
    isApproveWqieLoading,
    isApproveWqieSuccess,
    needsWqieApproval,
    wqieBalance,
    wqieBalanceError,
    refetchWqieBalance,
    isConnected,
}) {
    const tokenInfo = useTokenInfo(tokenAddress);
    const tokenBalance = useTokenBalance(tokenAddress, userAddress);
    const formattedBalance = tokenBalance?.balance ? formatUnits(tokenBalance.balance, tokenInfo?.decimals || 18) : '0';
    const qieBalanceFormatted = qieBalance ? formatUnits(qieBalance.value, 18) : '0';

    return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl p-6 lg:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                    onClick={onClose}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>

                                <div className="mb-6">
                                    <h2 className="text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                                        Add Liquidity
                                    </h2>
                                    <p className="text-slate-300 text-sm">
                    Create a QIE / {tokenInfo?.symbol || 'TOKEN'} Pair to enable trading.
                </p>
                                </div>

                                <div className="space-y-5">
                                    <div className="p-5 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-lg">
                                        <div className="text-sm text-slate-300 mb-3 font-medium">1. Deposit Token Amount</div>
                                <div className="flex items-center justify-between">
                            <input
                                type="number"
                                value={liquidityTokenAmount}
                                onChange={(e) => setLiquidityTokenAmount(e.target.value)}
                                placeholder="0.0"
                                                className="bg-transparent text-3xl font-bold w-full focus:outline-none text-white"
                            />
                                            <span className="text-3xl ml-4">{tokenInfo?.symbol || '🪙'}</span>
                        </div>
                                        <div className="text-xs text-slate-400 mt-2 font-medium">
                            Balance: {parseFloat(formattedBalance).toLocaleString()}
                                </div>
                            </div>

                                    <div className="p-5 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-lg">
                                        <div className="text-sm text-slate-300 mb-3 font-medium">2. Deposit QIE Amount</div>
                                <div className="flex items-center justify-between">
                            <input
                                type="number"
                                value={liquidityQieAmount}
                                onChange={(e) => setLiquidityQieAmount(e.target.value)}
                                placeholder="0.0"
                                                className="bg-transparent text-3xl font-bold w-full focus:outline-none text-white"
                            />
                                            <span className="font-bold text-blue-400 ml-4 text-xl">QIE</span>
                                </div>
                                        <div className="text-xs text-slate-400 mt-2 font-medium">
                            Balance: {parseFloat(qieBalanceFormatted).toFixed(4)}
                                </div>
                            </div>

                            {pairAddress && pairAddress !== zeroAddress ? (
                                        <div className="backdrop-blur-xl bg-blue-500/20 border border-blue-500/30 rounded-2xl p-4 text-sm text-blue-200 shadow-lg">
                                    ℹ️ Pair already exists. Adding more liquidity will maintain the current price ratio.
                                </div>
                            ) : (
                                        <div className="backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/30 rounded-2xl p-4 text-sm text-yellow-200 shadow-lg">
                                ⚠️ You are the first liquidity provider. The ratio of tokens you add will set the initial price.
                                            <div className="text-xs mt-2 opacity-90 font-medium">
                                        Example: 1000 tokens + 0.01 QIE = 1 token = 0.00001 QIE
                            </div>
                                </div>
                            )}

                    {QIEDEX_CONFIG.ROUTER === zeroAddress && (
                                        <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-2xl p-4 text-sm text-red-200 shadow-lg">
                            ⚠️ QIEDex Router address not configured. Please update src/config/qiedex.js with the correct router address.
                        </div>
                    )}

                    {isApproveSuccess && (
                                        <div className="backdrop-blur-xl bg-green-500/20 border border-green-500/30 rounded-2xl p-4 text-sm text-green-200 shadow-lg">
                            ✅ Token approved! You can now supply liquidity.
                        </div>
                    )}

                    {!needsApproval && (
                                        <div className="backdrop-blur-xl bg-blue-500/20 border border-blue-500/30 rounded-2xl p-4 text-sm text-blue-200 shadow-lg">
                            ℹ️ Token already approved.
                        </div>
                    )}

                    {qieBalance && qieBalance.value < requiredQieAmount && (
                                        <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-2xl p-4 text-sm text-red-200 shadow-lg">
                            ⚠️ Insufficient QIE balance. You need {formatUnits(requiredQieAmount, 18)} QIE.
                        </div>
                    )}

                    {isWrapSuccess && !isApproveWqieSuccess && (
                                        <div className="backdrop-blur-xl bg-green-500/20 border border-green-500/30 rounded-2xl p-4 text-sm text-green-200 shadow-lg">
                            ✅ QIE wrapped to WQIE successfully! Now approve WQIE.
                        </div>
                    )}

                    {isApproveWqieSuccess && (
                                        <div className="backdrop-blur-xl bg-green-500/20 border border-green-500/30 rounded-2xl p-4 text-sm text-green-200 shadow-lg">
                            ✅ WQIE approved! Ready to supply liquidity.
                        </div>
                    )}

                    {!needsWqieApproval && isWrapSuccess && (
                                        <div className="backdrop-blur-xl bg-blue-500/20 border border-blue-500/30 rounded-2xl p-4 text-sm text-blue-200 shadow-lg">
                            ℹ️ WQIE already approved.
                        </div>
                    )}


                    <div className="space-y-2 pt-2">
                        {/* Step 0: Create Pair if needed */}
                        {needsPairCreation && !isCreatePairSuccess && (
                            <button
                                onClick={() => {
                                    console.log('Create pair clicked', {
                                        needsPairCreation,
                                        tokenAddress,
                                        isConnected,
                                        createPair: !!onCreatePair
                                    });
                                    if (onCreatePair) {
                                        onCreatePair();
                                    } else {
                                        console.error('createPair function not available');
                                        alert('Cannot create pair: Function not available. Make sure you have selected a token and are connected.');
                                    }
                                }}
                                disabled={isCreatePairLoading || isCreatePairSuccess || !tokenAddress || !isConnected}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 font-bold hover:from-orange-500 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg backdrop-blur-sm border border-white/20"
                            >
                                {isCreatePairLoading ? 'Creating Pair...' : isCreatePairSuccess ? '✅ Pair Created' : '0. Create Pair First'}
                            </button>
                        )}
                        
                        {/* Step 1: Approve Token */}
                        {needsApproval && (isCreatePairSuccess || !needsPairCreation) && (
                            <button
                                onClick={() => onApprove?.()}
                                disabled={!onApprove || isApproveLoading || isApproveSuccess}
                                className="w-full py-4 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 font-bold hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                {isApproveLoading ? 'Approving Token...' : isApproveSuccess ? '✅ Token Approved' : `1. Approve ${tokenInfo?.symbol || 'Token'}`}
                            </button>
                        )}

                        {/* Step 2: Wrap QIE to WQIE */}
                        {(!needsApproval || isApproveSuccess) && (isCreatePairSuccess || !needsPairCreation) && !isWrapSuccess && (
                            <>
                            <button
                                    onClick={() => {
                                        console.log('Wrapping QIE:', {
                                            amount: liquidityQieAmount,
                                            requiredAmount: requiredQieAmount.toString(),
                                            qieBalance: qieBalance?.value?.toString(),
                                            wqieAddress: QIEDEX_CONFIG.WQIE
                                        });
                                        if (onWrapQie) {
                                            onWrapQie();
                                        } else {
                                            console.error('wrapQie function not available');
                                        }
                                    }}
                                disabled={!onWrapQie || isWrapLoading || isWrapSuccess || !liquidityQieAmount || (qieBalance && qieBalance.value < requiredQieAmount)}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 font-bold hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg backdrop-blur-sm border border-white/20"
                            >
                                {isWrapLoading ? 'Wrapping QIE...' : isWrapSuccess ? '✅ Wrapped' : '2. Wrap QIE to WQIE'}
                            </button>
                            {wrapError && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-200/80">
                                    ❌ Wrap Error: {wrapError.message || 'Failed to wrap QIE. Check console for details.'}
                                </div>
                            )}
                            </>
                        )}

                        {/* Step 3: Approve WQIE */}
                        {isWrapSuccess && needsWqieApproval && !isApproveWqieSuccess && (
                            <button
                                onClick={() => onApproveWqie?.()}
                                disabled={!onApproveWqie || isApproveWqieLoading || isApproveWqieSuccess}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 font-bold hover:from-indigo-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg backdrop-blur-sm border border-white/20"
                            >
                                {isApproveWqieLoading ? 'Approving WQIE...' : isApproveWqieSuccess ? '✅ WQIE Approved' : '3. Approve WQIE'}
                            </button>
                        )}

                        {/* Step 4: Add Liquidity */}
                        {isAddLiquiditySuccess ? (
                            <div className="space-y-2">
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                                    <div className="text-2xl mb-2">✅</div>
                                    <div className="font-bold text-green-400 mb-1">Liquidity Added Successfully!</div>
                                    <div className="text-sm text-green-300/80">
                                        Your token pair is now available for trading on QIEDex.
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 rounded-xl bg-slate-700 font-bold hover:bg-slate-600 transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                        <button
                            onClick={() => {
                                if (onAddLiquidity) {
                                        onAddLiquidity();
                                }
                            }}
                            disabled={
                                !onAddLiquidity || 
                                isAddLiquidityLoading || 
                                QIEDEX_CONFIG.ROUTER === zeroAddress || 
                                (needsApproval && !isApproveSuccess) ||
                                !isWrapSuccess ||
                                (needsWqieApproval && !isApproveWqieSuccess) ||
                                (qieBalance && qieBalance.value < requiredQieAmount) ||
                                (!pairExists && needsPairCreation && !isCreatePairSuccess)
                            }
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 font-bold shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20"
                        >
                            {isAddLiquidityLoading ? 'Processing...' : 'Add Liquidity'}
                        </button>
                        {writeError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-200/80">
                                ❌ Error: {writeError.message || 'Failed to add liquidity'}
                            </div>
                                )}
                            </>
                        )}
                            </div>
                        </div>
                    </div>
                </div>
    );
}

// Portfolio Token Card Component
function PortfolioTokenCard({ tokenAddress, userAddress, onAddLiquidity }) {
    const tokenInfo = useTokenInfo(tokenAddress);
    const tokenBalance = useTokenBalance(tokenAddress, userAddress);
    const decimals = tokenInfo.decimals ? Number(tokenInfo.decimals) : 18;
    
    let formattedBalance = '0';
    if (tokenBalance.balance && tokenBalance.balance > 0n) {
        try {
            formattedBalance = formatUnits(tokenBalance.balance, decimals);
        } catch (e) {
            formattedBalance = tokenBalance.balance.toString();
        }
    }
    
    // Get pair address for price
    const { data: pairAddr } = useContractRead({
        address: QIEDEX_CONFIG.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [QIEDEX_CONFIG.WQIE, tokenAddress],
        enabled: Boolean(tokenAddress && tokenAddress !== zeroAddress),
        watch: true,
        throwOnError: false,
    });
    
    const pairAddress = pairAddr && pairAddr !== zeroAddress ? pairAddr : zeroAddress;
    
    // Get reserves for price calculation
    const { data: reserves } = useContractRead({
        address: pairAddress !== zeroAddress ? pairAddress : undefined,
        abi: PAIR_ABI,
        functionName: 'getReserves',
        enabled: Boolean(pairAddress && pairAddress !== zeroAddress),
        watch: true,
        throwOnError: false,
    });
    
    // Calculate price: reserve0 is WQIE, reserve1 is token
    let tokenPrice = null;
    if (reserves && Array.isArray(reserves) && reserves.length >= 2 && reserves[0] > 0n && reserves[1] > 0n) {
        const wqieReserve = reserves[0];
        const tokenReserve = reserves[1];
        // Price = WQIE reserve / Token reserve (price per token in WQIE)
        const priceInWqie = Number(wqieReserve) / Number(tokenReserve);
        tokenPrice = priceInWqie;
    }
    
    return (
        <div className="bg-white/5 border-2 border-white/10 rounded-lg p-8 hover:bg-white/8 transition-all">
            <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center text-5xl flex-shrink-0">
                    {tokenInfo.symbol || '🪙'}
                </div>
                <div className="flex-1">
                    <h3 className="text-2xl font-black mb-2 text-white">
                        {tokenInfo.name || 'Loading...'}
                    </h3>
                    <div className="text-lg text-slate-300 font-bold mb-3">
                        {tokenInfo.symbol || '...'}
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-bold text-lg">Balance:</span>
                            <span className="text-white font-black text-2xl">{parseFloat(formattedBalance).toLocaleString()}</span>
                        </div>
                        {tokenPrice !== null && (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-bold text-lg">Price:</span>
                                <span className="text-green-400 font-black text-2xl">
                                    {tokenPrice < 0.0001 ? tokenPrice.toExponential(2) : tokenPrice.toFixed(6)} QIE
                                </span>
                            </div>
                        )}
                        {tokenPrice !== null && parseFloat(formattedBalance) > 0 && (
                            <div className="flex justify-between items-center pt-2 border-t border-white/10">
                                <span className="text-slate-400 font-bold text-lg">Value:</span>
                                <span className="text-white font-black text-2xl">
                                    {(parseFloat(formattedBalance) * tokenPrice).toFixed(4)} QIE
                                </span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-white/10">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-slate-500 font-mono break-all flex-1">
                                    {tokenAddress}
                                </span>
                                <button
                                    onClick={(e) => {
                                        navigator.clipboard.writeText(tokenAddress);
                                        const btn = e.currentTarget;
                                        const originalText = btn.textContent;
                                        btn.textContent = '✓';
                                        setTimeout(() => {
                                            btn.textContent = originalText;
                                        }, 2000);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold transition-all flex-shrink-0"
                                    title="Copy address"
                                >
                                    📋
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onAddLiquidity}
                        className="px-6 py-3 rounded-lg bg-white hover:bg-white/90 text-black font-black text-base transition-all"
                    >
                        💧 Add Liquidity
                    </button>
                    <a
                        href={`https://mainnet.qie.digital/address/${tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-base font-bold text-center border-2 border-white/10"
                    >
                        Explorer
                    </a>
                </div>
            </div>
        </div>
    );
}

export default App;
