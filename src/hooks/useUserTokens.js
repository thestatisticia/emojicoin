import { useAccount, useContractRead } from 'wagmi';
import { zeroAddress } from 'viem';
import factoryAddress from '../factoryAddress.json';
import TokenFactoryArtifact from '../artifacts/contracts/TokenFactory.sol/TokenFactory.json';
import { ERC20_ABI } from '../config/qiedex';

// Hook to get all tokens created by the user
export function useUserTokens() {
    const { address } = useAccount();

    const { data: tokenAddresses, isLoading, refetch } = useContractRead({
        address: factoryAddress.address,
        abi: TokenFactoryArtifact.abi,
        functionName: 'getUserTokens',
        args: [address],
        enabled: !!address,
        watch: true, // Real-time updates
    });

    return {
        tokenAddresses: tokenAddresses || [],
        isLoading,
        refetch,
    };
}

// Hook to get token details
export function useTokenInfo(tokenAddress) {
    const isValidAddress = tokenAddress && tokenAddress !== zeroAddress;
    
    const { data: name } = useContractRead({
        address: isValidAddress ? tokenAddress : undefined,
        abi: ERC20_ABI,
        functionName: 'name',
        enabled: isValidAddress,
    });

    const { data: symbol } = useContractRead({
        address: isValidAddress ? tokenAddress : undefined,
        abi: ERC20_ABI,
        functionName: 'symbol',
        enabled: isValidAddress,
    });

    const { data: decimals } = useContractRead({
        address: isValidAddress ? tokenAddress : undefined,
        abi: ERC20_ABI,
        functionName: 'decimals',
        enabled: isValidAddress,
    });

    const { data: totalSupply } = useContractRead({
        address: isValidAddress ? tokenAddress : undefined,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
        enabled: isValidAddress,
    });

    // Convert decimals to number (it might be BigInt from contract)
    const decimalsNum = decimals ? Number(decimals) : 18;
    
    return {
        name: name || '',
        symbol: symbol || '',
        decimals: decimalsNum,
        totalSupply: totalSupply || 0n,
    };
}

// Hook to get token balance for a user
export function useTokenBalance(tokenAddress, userAddress) {
    const isValidToken = tokenAddress && tokenAddress !== zeroAddress;
    const isValidUser = userAddress && userAddress !== zeroAddress;
    
    // Skip WQIE balance checks - they cause errors
    const isWQIE = tokenAddress?.toLowerCase() === '0x0087904d95bee9e5f24dc8852804b547981a9139';
    
    const { data: balance, isLoading, refetch, error, isError } = useContractRead({
        address: isValidToken && !isWQIE ? tokenAddress : undefined,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: isValidUser ? [userAddress] : undefined,
        enabled: isValidToken && isValidUser && !isWQIE, // Disable for WQIE
        watch: true,
        retry: false,
    });

    // If there's an error or it's WQIE, return 0n instead of failing
    return {
        balance: (isError || error || isWQIE) ? 0n : (balance || 0n),
        isLoading: isWQIE ? false : isLoading,
        refetch,
        error: isWQIE ? null : (error || null),
    };
}

// Hook to check token allowance
export function useTokenAllowance(tokenAddress, ownerAddress, spenderAddress) {
    const isValidToken = tokenAddress && tokenAddress !== zeroAddress;
    const isValidOwner = ownerAddress && ownerAddress !== zeroAddress;
    const isValidSpender = spenderAddress && spenderAddress !== zeroAddress;
    
    // Skip WQIE allowance checks - they cause errors
    const isWQIE = tokenAddress?.toLowerCase() === '0x3af492c875829b69a0803f4688c54fb867c193df';
    
    const { data: allowance, isLoading, refetch, error, isError } = useContractRead({
        address: isValidToken && !isWQIE ? tokenAddress : undefined,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: isValidOwner && isValidSpender ? [ownerAddress, spenderAddress] : undefined,
        enabled: isValidToken && isValidOwner && isValidSpender && !isWQIE, // Disable for WQIE
        watch: true,
        retry: false,
    });

    // If there's an error or it's WQIE, return 0n (assume no allowance) instead of failing
    return {
        allowance: (isError || error || isWQIE) ? 0n : (allowance || 0n),
        isLoading: isWQIE ? false : isLoading,
        refetch,
        error: isWQIE ? null : (error || null),
    };
}


