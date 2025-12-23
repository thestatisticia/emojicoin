// QIEDex Configuration
// QIEDex follows Uniswap V2 architecture
// All contract addresses are configured and ready to use

export const QIEDEX_CONFIG = {
    // Router contract for swaps and liquidity operations
    ROUTER: '0x08cd2e72e156D8563B4351eb4065C262A9f553Ef',
    
    // Factory contract for creating pairs
    FACTORY: '0x8E23128a5511223bE6c0d64106e2D4508C08398C',
    
    // WQIE (Wrapped QIE) token address
    WQIE: '0x0087904D95BEe9E5F24dc8852804b547981A9139',
    
    // Native QIE token (for native swaps)
    // On QIE Network, native token is QIEV3
    NATIVE_TOKEN: '0x0000000000000000000000000000000000000000', // Use zero address for native
    
    // Slippage tolerance (0.5% = 50, 5% = 500)
    SLIPPAGE_TOLERANCE: 500, // 5% default slippage tolerance
    
    // Deadline (20 minutes from now)
    getDeadline: () => Math.floor(Date.now() / 1000) + 60 * 20,
    
    // Calculate minimum amount out with slippage
    getAmountOutMin: (amountOut, slippageBps = 500) => {
        // slippageBps is in basis points (500 = 5%)
        const slippageMultiplier = BigInt(10000 - slippageBps);
        return (BigInt(amountOut) * slippageMultiplier) / 10000n;
    },
    
    // Calculate maximum amount in with slippage
    getAmountInMax: (amountIn, slippageBps = 500) => {
        const slippageMultiplier = BigInt(10000 + slippageBps);
        return (BigInt(amountIn) * slippageMultiplier) / 10000n;
    },
};

// Standard Uniswap V2 Router ABI (QIEDex likely uses similar) - JSON format
export const ROUTER_ABI = [
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' }
        ],
        name: 'getAmountsOut',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' }
        ],
        name: 'getAmountsIn',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'WETH',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'pure',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'swapExactTokensForTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'swapTokensForExactTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'swapExactETHForTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'swapTokensForExactETH',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'swapExactTokensForETH',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'swapETHForExactTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    // Add Liquidity Functions
    {
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' },
            { internalType: 'uint256', name: 'amountADesired', type: 'uint256' },
            { internalType: 'uint256', name: 'amountBDesired', type: 'uint256' },
            { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'addLiquidity',
        outputs: [
            { internalType: 'uint256', name: 'amountA', type: 'uint256' },
            { internalType: 'uint256', name: 'amountB', type: 'uint256' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' }
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: 'amountTokenDesired', type: 'uint256' },
            { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' }
        ],
        name: 'addLiquidityETH',
        outputs: [
            { internalType: 'uint256', name: 'amountToken', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETH', type: 'uint256' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' }
        ],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' }
        ],
        name: 'quote',
        outputs: [
            { internalType: 'uint256', name: 'amountA', type: 'uint256' },
            { internalType: 'uint256', name: 'amountB', type: 'uint256' }
        ],
        stateMutability: 'pure',
        type: 'function',
    },
];

// QIEDEX Factory ABI (minimal - only what we need)
export const FACTORY_ABI = [
    {
        name: 'getPair',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' }
        ],
        outputs: [{ internalType: 'address', name: 'pair', type: 'address' }]
    },
    {
        name: 'createPair',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' }
        ],
        outputs: [{ internalType: 'address', name: 'pair', type: 'address' }]
    },
];

// QIEDEX Pair ABI (for direct liquidity management)
export const PAIR_ABI = [
    {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'to', type: 'address' }],
        outputs: [{ name: 'liquidity', type: 'uint256' }]
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: 'balance', type: 'uint256' }]
    },
    {
        name: 'getReserves',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'reserve0', type: 'uint112' },
            { name: 'reserve1', type: 'uint112' },
            { name: 'blockTimestampLast', type: 'uint32' }
        ]
    },
];

// Standard ERC20 ABI (for token approvals and balance checks) - JSON format
export const ERC20_ABI = [
    {
        inputs: [
            { internalType: 'address', name: 'owner', type: 'address' }
        ],
        name: 'balanceOf',
        outputs: [
            { internalType: 'uint256', name: '', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'decimals',
        outputs: [
            { internalType: 'uint8', name: '', type: 'uint8' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'symbol',
        outputs: [
            { internalType: 'string', name: '', type: 'string' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'name',
        outputs: [
            { internalType: 'string', name: '', type: 'string' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalSupply',
        outputs: [
            { internalType: 'uint256', name: '', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'amount', type: 'uint256' }
        ],
        name: 'transfer',
        outputs: [], // Some QIE tokens don't return bool
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'owner', type: 'address' },
            { internalType: 'address', name: 'spender', type: 'address' }
        ],
        name: 'allowance',
        outputs: [
            { internalType: 'uint256', name: '', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'spender', type: 'address' },
            { internalType: 'uint256', name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [], // WQIE and some QIE tokens don't return bool - they just execute
        stateMutability: 'nonpayable',
        type: 'function',
    },
];

// WQIE (Wrapped QIE) ABI - standard WETH-like interface with ERC20 functions
export const WQIE_ABI = [
    {
        inputs: [],
        name: 'deposit',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'wad', type: 'uint256' }
        ],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Include standard ERC20 functions for WQIE
    {
        inputs: [
            { internalType: 'address', name: 'owner', type: 'address' }
        ],
        name: 'balanceOf',
        outputs: [
            { internalType: 'uint256', name: '', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'owner', type: 'address' },
            { internalType: 'address', name: 'spender', type: 'address' }
        ],
        name: 'allowance',
        outputs: [
            { internalType: 'uint256', name: '', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'spender', type: 'address' },
            { internalType: 'uint256', name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [], // WQIE and some QIE tokens don't return bool - they just execute
        stateMutability: 'nonpayable',
        type: 'function',
    },
];
