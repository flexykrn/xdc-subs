// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SubscriptionToken
/// @notice Single ERC20 token for all subscription services
/// @dev Minter-gated minting with idempotency for Stripe/Razorpay payment integration
contract SubscriptionToken is ERC20, Ownable {
    address public minter;
    mapping(bytes32 => bool) public processedPayments;
    
    event TokensPurchased(
        address indexed user, 
        uint256 amount, 
        string indexed paymentId
    );
    event MinterUpdated(address indexed newMinter);

    constructor(address initialOwner) ERC20("Subscription Token", "SUB") Ownable(initialOwner) {
        minter = initialOwner;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "Not authorized minter");
        _;
    }

    /// @notice Mint tokens in response to verified fiat payment
    /// @param to Recipient wallet address
    /// @param amount Token amount in wei (e.g., 100 * 10^18 for 100 tokens)
    /// @param paymentId Unique payment identifier (Stripe: pi_..., Razorpay: pay_...)
    function mintForPayment(
        address to,
        uint256 amount,
        string calldata paymentId
    ) external onlyMinter {
        bytes32 paymentHash = keccak256(bytes(paymentId));
        require(!processedPayments[paymentHash], "Payment already processed");
        
        processedPayments[paymentHash] = true;
        _mint(to, amount);
        
        emit TokensPurchased(to, amount, paymentId);
    }

    /// @notice Update minter address (emergency rotation)
    /// @param _minter New backend wallet address
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid address");
        minter = _minter;
        emit MinterUpdated(_minter);
    }
}
