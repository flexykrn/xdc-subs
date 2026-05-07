// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// EntryPoint v0.7 interfaces
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

struct DepositInfo {
    uint112 deposit;
    bool staked;
    uint112 stake;
    uint32 unstakeDelaySec;
    uint48 withdrawTime;
}

interface IEntryPoint {
    function depositTo(address account) external payable;
    function getDepositInfo(address account) external view returns (DepositInfo memory);
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function addStake(uint32 unstakeDelaySec) external payable;
    function unlockStake() external;
    function withdrawStake(address payable withdrawAddress) external;
}

enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

interface IPaymaster {
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external;
}

/// @title VerifyingSponsorPaymaster
/// @notice A minimal verifying paymaster for ERC-4337 v0.7
/// @dev The owner signs a custom hash of the UserOp (excluding paymasterAndData) to authorize sponsorship
contract VerifyingSponsorPaymaster is IPaymaster, Ownable {

    IEntryPoint public immutable entryPoint;

    constructor(address _entryPoint, address _owner) Ownable(_owner) {
        require(_entryPoint != address(0), "Invalid EntryPoint");
        entryPoint = IEntryPoint(_entryPoint);
    }

    receive() external payable {}

    /// @notice Deposit native tokens into the EntryPoint for gas sponsorship
    function deposit() external payable onlyOwner {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /// @notice Withdraw deposited tokens from EntryPoint (in case of emergency)
    function withdrawTo(address payable to, uint256 amount) external onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdraw failed");
    }

    /// @notice Get current deposit balance in EntryPoint
    function getDeposit() external view returns (uint256) {
        DepositInfo memory info = entryPoint.getDepositInfo(address(this));
        return info.deposit;
    }

    /// @notice Add stake to EntryPoint (required for paymaster to sponsor UserOps)
    /// @param unstakeDelaySec Seconds to wait before unstaking (e.g., 86400 for 1 day)
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    /// @notice Check staking status
    function getStakeInfo() external view returns (uint112 stake, bool staked, uint32 unstakeDelaySec) {
        DepositInfo memory info = entryPoint.getDepositInfo(address(this));
        return (info.stake, info.staked, info.unstakeDelaySec);
    }

    /// @notice Unlock stake (start unstaking countdown)
    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    /// @notice Withdraw stake after unstake period
    function withdrawStake(address payable withdrawAddress) external onlyOwner {
        entryPoint.withdrawStake(withdrawAddress);
    }

    /// @notice Compute the hash that the owner must sign to sponsor a UserOp
    function getHash(PackedUserOperation calldata userOp) public view returns (bytes32) {
        // Decode gasFees into maxPriorityFeePerGas and maxFeePerGas
        uint256 maxPriorityFeePerGas = uint256(uint128(bytes16(userOp.gasFees)));
        uint256 maxFeePerGas = uint256(uint128(bytes16(userOp.gasFees << 128)));

        return keccak256(
            abi.encode(
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                userOp.preVerificationGas,
                maxPriorityFeePerGas,
                maxFeePerGas,
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice EntryPoint calls this during validation phase
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 /*userOpHash*/,
        uint256 /*maxCost*/
    ) external view override returns (bytes memory context, uint256 validationData) {
        _requireFromEntryPoint();

        // paymasterAndData structure:
        // [0:20]   - paymaster address
        // [20:36]  - paymasterVerificationGasLimit (uint128, 16 bytes)
        // [36:52]  - paymasterPostOpGasLimit (uint128, 16 bytes)
        // [52:]    - signature (65 bytes)
        require(userOp.paymasterAndData.length >= 117, "Invalid paymasterAndData");

        bytes memory signature = userOp.paymasterAndData[52:];
        bytes32 hash = getHash(userOp);
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);

        require(signer == owner(), "Invalid paymaster signature");

        // Return empty context and valid validation data (no time bounds)
        return ("", 0);
    }

    /// @notice EntryPoint calls this after execution
    function postOp(
        PostOpMode /*mode*/,
        bytes calldata /*context*/,
        uint256 /*actualGasCost*/,
        uint256 /*actualUserOpFeePerGas*/
    ) external view override {
        _requireFromEntryPoint();
        // No post-op logic needed for a simple verifying paymaster
    }

    function _requireFromEntryPoint() internal view {
        require(msg.sender == address(entryPoint), "Only EntryPoint");
    }
}
