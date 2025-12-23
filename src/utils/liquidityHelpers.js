import { parseUnits, formatUnits } from 'viem';
import { QIEDEX_CONFIG } from '../config/qiedex';

/**
 * Calculate the optimal amount of tokenB needed for a given amount of tokenA
 * based on the current reserves in the liquidity pool
 * @param {bigint} reserveA - Reserve of token A
 * @param {bigint} reserveB - Reserve of token B
 * @param {bigint} amountA - Desired amount of token A
 * @returns {bigint} Optimal amount of token B
 */
export function calculateOptimalAmountB(reserveA, reserveB, amountA) {
    if (reserveA === 0n || reserveB === 0n) {
        // New pair - return the amountA as amountB (1:1 ratio for new pairs)
        return amountA;
    }
    // Calculate based on current ratio: amountB = (amountA * reserveB) / reserveA
    return (amountA * reserveB) / reserveA;
}

/**
 * Calculate price impact for a swap
 * @param {bigint} amountIn - Input amount
 * @param {bigint} amountOut - Output amount
 * @param {bigint} reserveIn - Reserve of input token
 * @param {bigint} reserveOut - Reserve of output token
 * @returns {number} Price impact as a percentage (0-100)
 */
export function calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut) {
    if (reserveIn === 0n || reserveOut === 0n) {
        return 100; // 100% impact if no liquidity
    }
    
    // Calculate the constant product: k = reserveIn * reserveOut
    const k = reserveIn * reserveOut;
    
    // Calculate new reserves after swap
    const newReserveIn = reserveIn + amountIn;
    const newReserveOut = k / newReserveIn;
    
    // Calculate expected output without impact
    const expectedOut = reserveOut - newReserveOut;
    
    // Calculate price impact: ((expected - actual) / expected) * 100
    if (expectedOut === 0n) {
        return 100;
    }
    
    const impact = Number((expectedOut - amountOut) * 10000n / expectedOut) / 100;
    return Math.max(0, Math.min(100, impact));
}

/**
 * Calculate minimum amounts for liquidity addition with slippage
 * @param {bigint} amountADesired - Desired amount of token A
 * @param {bigint} amountBDesired - Desired amount of token B
 * @param {number} slippageBps - Slippage in basis points (500 = 5%)
 * @returns {{amountAMin: bigint, amountBMin: bigint}}
 */
export function calculateMinAmounts(amountADesired, amountBDesired, slippageBps = 500) {
    const slippageMultiplier = BigInt(10000 - slippageBps);
    return {
        amountAMin: (amountADesired * slippageMultiplier) / 10000n,
        amountBMin: (amountBDesired * slippageMultiplier) / 10000n,
    };
}

/**
 * Format amount with proper decimals
 * @param {bigint|string|number} amount - Amount to format
 * @param {number} decimals - Token decimals
 * @returns {string} Formatted amount
 */
export function formatTokenAmount(amount, decimals = 18) {
    try {
        if (typeof amount === 'bigint' || typeof amount === 'string') {
            return formatUnits(BigInt(amount), decimals);
        }
        return formatUnits(parseUnits(amount.toString(), decimals), decimals);
    } catch (e) {
        return '0';
    }
}

/**
 * Parse amount with proper decimals
 * @param {string|number} amount - Amount to parse
 * @param {number} decimals - Token decimals
 * @returns {bigint} Parsed amount
 */
export function parseTokenAmount(amount, decimals = 18) {
    try {
        return parseUnits(amount.toString(), decimals);
    } catch (e) {
        return 0n;
    }
}


