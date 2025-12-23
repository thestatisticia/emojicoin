// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 1. Standard Emoji Token Contract
contract EmojiToken is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name, 
        string memory symbol, 
        uint256 initialSupply, 
        uint8 decimalUnits, 
        address owner
    ) ERC20(name, symbol) Ownable(owner) {
        _decimals = decimalUnits;
        _mint(owner, initialSupply * (10 ** decimalUnits));
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

// 2. Factory Contract to deploy new tokens
contract TokenFactory {
    event TokenCreated(address indexed tokenAddress, string name, string symbol, address indexed creator);

    address[] public allTokens;

    function createToken(
        string memory name, 
        string memory symbol, 
        uint256 supply, 
        uint8 decimalUnits
    ) external returns (address) {
        // Deploy new token
        EmojiToken newToken = new EmojiToken(name, symbol, supply, decimalUnits, msg.sender);
        
        allTokens.push(address(newToken));
        
        emit TokenCreated(address(newToken), name, symbol, msg.sender);
        
        return address(newToken);
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function getUserTokens(address user) external view returns (address[] memory) {
        // Inefficient for large arrays, but okay for this MVP
        uint256 count = 0;
        for (uint256 i = 0; i < allTokens.length; i++) {
            if (EmojiToken(allTokens[i]).owner() == user) {
                count++;
            }
        }

        address[] memory userTokens = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allTokens.length; i++) {
             if (EmojiToken(allTokens[i]).owner() == user) {
                userTokens[index] = allTokens[i];
                index++;
            }
        }
        
        return userTokens;
    }
}
