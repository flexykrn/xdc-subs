// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenGasPaymaster
 * @notice Accepts ERC20 tokens in exchange for native gas (tXDC).
 *         Users approve this contract, call swap(), receive tXDC for gas.
 *         This simulates "pay gas in ERC20" on testnet where AA infra is limited.
 *         On mainnet, a true ERC-4337 TokenPaymaster would replace this.
 */
contract TokenGasPaymaster is Ownable {
    mapping(address => uint256) public tokenRates; // how many token wei per 1 tXDC wei
    mapping(address => bool) public supportedTokens;
    
    event GasSwapped(address indexed user, address indexed token, uint256 tokenAmount, uint256 xdcAmount);
    event TokenAdded(address indexed token, uint256 rate);
    event TokenRemoved(address indexed token);
    
    constructor() Ownable(msg.sender) {}
    
    receive() external payable {}
    
    function addToken(address token, uint256 rate) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(rate > 0, "Invalid rate");
        supportedTokens[token] = true;
        tokenRates[token] = rate;
        emit TokenAdded(token, rate);
    }
    
    function removeToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }
    
    function updateRate(address token, uint256 newRate) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        require(newRate > 0, "Invalid rate");
        tokenRates[token] = newRate;
    }
    
    /**
     * @notice Swap ERC20 tokens for tXDC gas.
     * @param token The ERC20 token to pay with.
     * @param xdcAmount How much tXDC (wei) the user wants.
     */
    function swap(address token, uint256 xdcAmount) external {
        require(supportedTokens[token], "Token not supported");
        require(xdcAmount > 0, "Amount must be > 0");
        require(address(this).balance >= xdcAmount, "Paymaster low on tXDC");
        
        uint256 tokenAmount = (xdcAmount * tokenRates[token]) / 1e18;
        require(tokenAmount > 0, "Token amount too small");
        
        // Take tokens from user
        bool success = IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        require(success, "Token transfer failed");
        
        // Send tXDC to user
        (success, ) = payable(msg.sender).call{value: xdcAmount}("");
        require(success, "tXDC transfer failed");
        
        emit GasSwapped(msg.sender, token, tokenAmount, xdcAmount);
    }
    
    /**
     * @notice Preview how many tokens are needed for a given tXDC amount.
     */
    function previewSwap(address token, uint256 xdcAmount) external view returns (uint256 tokenAmount) {
        require(supportedTokens[token], "Token not supported");
        tokenAmount = (xdcAmount * tokenRates[token]) / 1e18;
    }
    
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    function withdrawXDC(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }
    
    function depositXDC() external payable onlyOwner {}
}
