// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// ERC-4337 v0.7 types
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

/**
 * @title TokenPaymaster
 * @notice Real ERC-4337 Token Paymaster. Accepts ERC20 tokens as gas payment.
 *         The Smart Account must approve this paymaster to spend tokens.
 *         Gas cost is calculated in tokens based on a configurable rate.
 */
contract TokenPaymaster is Ownable {
    address public immutable entryPoint;
    
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenRates; // token wei per 1 tXDC wei
    
    event TokenAdded(address indexed token, uint256 rate);
    event TokenRemoved(address indexed token);
    event GasPaidInTokens(address indexed sender, address indexed token, uint256 tokenAmount, uint256 xdcCost);
    
    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Not EntryPoint");
        _;
    }
    
    constructor(address _entryPoint) Ownable(msg.sender) {
        require(_entryPoint != address(0), "Invalid EntryPoint");
        entryPoint = _entryPoint;
    }
    
    receive() external payable {}
    
    // ── Owner Functions ──
    
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
    
    function withdrawXDC(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }
    
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    // ── ERC-4337 Paymaster Interface ──
    
    /**
     * @notice Validate that the paymaster will pay for the UserOp.
     * @param userOp The UserOperation.
     * @param userOpHash Hash of the UserOperation.
     * @param maxCost Maximum gas cost in tXDC wei.
     * @return context Data passed to postOp: abi.encode(token, tokenCost, sender).
     * @return validationData 0 = valid.
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        bytes calldata pmd = userOp.paymasterAndData;
        require(pmd.length >= 72, "Invalid paymasterAndData length"); // 20 + 16 + 16 + 20 = 72
        
        // paymasterAndData format:
        // [0:20]   paymaster address
        // [20:36]  verificationGasLimit (uint128)
        // [36:52]  postOpGasLimit (uint128)
        // [52:72]  token address (20 bytes)
        address token = address(bytes20(pmd[52:72]));
        
        require(supportedTokens[token], "Token not supported");
        
        // Calculate max token cost
        uint256 tokenCost = (maxCost * tokenRates[token]) / 1e18;
        require(tokenCost > 0, "Token cost too low");
        
        // Check SA balance
        uint256 balance = IERC20(token).balanceOf(userOp.sender);
        require(balance >= tokenCost, "SA token balance too low");
        
        // Check SA allowance to this paymaster
        uint256 allowance = IERC20(token).allowance(userOp.sender, address(this));
        require(allowance >= tokenCost, "SA token allowance too low");
        
        context = abi.encode(token, tokenCost, userOp.sender);
        validationData = 0;
    }
    
    /**
     * @notice Deduct tokens after UserOp execution.
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external onlyEntryPoint {
        (address token, uint256 estimatedCost, address sender) = abi.decode(context, (address, uint256, address));
        
        // Use estimated cost (validatePaymasterUserOp calculated maxCost)
        // EntryPoint ensures we are reimbursed for actualGasCost in native,
        // so we charge the SA in tokens based on that cost
        uint256 tokenAmount = (actualGasCost * tokenRates[token]) / 1e18;
        
        // Ensure we don't overcharge
        uint256 balance = IERC20(token).balanceOf(sender);
        if (tokenAmount > balance) {
            tokenAmount = balance;
        }
        
        if (tokenAmount > 0) {
            bool success = IERC20(token).transferFrom(sender, address(this), tokenAmount);
            if (success) {
                emit GasPaidInTokens(sender, token, tokenAmount, actualGasCost);
            }
        }
    }
    
    // ── Stake / Deposit ──
    
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        (bool success, ) = entryPoint.call{value: msg.value}(
            abi.encodeWithSignature("addStake(uint32)", unstakeDelaySec)
        );
        require(success, "Stake failed");
    }
    
    function depositToEntryPoint() external payable onlyOwner {
        (bool success, ) = entryPoint.call{value: msg.value}(
            abi.encodeWithSignature("depositTo(address)", address(this))
        );
        require(success, "Deposit failed");
    }
    
    function getTokenCost(address token, uint256 xdcAmount) external view returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        return (xdcAmount * tokenRates[token]) / 1e18;
    }
}
