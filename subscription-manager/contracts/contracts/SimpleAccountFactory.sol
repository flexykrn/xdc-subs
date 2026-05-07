// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimpleAccountFactory
 * @notice Factory for deploying ERC-4337 SimpleAccount contracts using CREATE2
 * @dev Self-contained, no external imports. Deploy with EntryPoint address.
 */
contract SimpleAccountFactory {
    address public immutable entryPoint;
    
    event AccountCreated(address indexed account, address indexed owner, uint256 salt);
    
    constructor(address _entryPoint) {
        require(_entryPoint != address(0), "Invalid EntryPoint");
        entryPoint = _entryPoint;
    }
    
    /**
     * @notice Create a SimpleAccount for an owner with a given salt
     * @param owner The EOA owner of the smart account
     * @param salt Deterministic salt for CREATE2
     * @return account The deployed account address
     */
    function createAccount(address owner, uint256 salt) external returns (address account) {
        account = getAddress(owner, salt);
        
        // Check if already deployed
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(account)
        }
        if (codeSize > 0) {
            return account;
        }
        
        // Build init code: creationCode + constructor args
        bytes memory initCode = abi.encodePacked(
            type(SimpleAccount).creationCode,
            abi.encode(entryPoint, owner)
        );
        
        // Deploy via CREATE2
        assembly {
            account := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        
        require(account != address(0), "Create2 failed");
        emit AccountCreated(account, owner, salt);
    }
    
    /**
     * @notice Calculate the counterfactual address for an account
     * @param owner The EOA owner
     * @param salt The salt value
     * @return The address where the account would be deployed
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory initCode = abi.encodePacked(
            type(SimpleAccount).creationCode,
            abi.encode(entryPoint, owner)
        );
        
        bytes32 initCodeHash = keccak256(initCode);
        
        // CREATE2 address formula: keccak256(0xff + deployer + salt + initCodeHash)[12:]
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            bytes32(salt),
            initCodeHash
        )))));
    }
}

/**
 * @title SimpleAccount
 * @notice Minimal ERC-4337 smart account
 * @dev Validated by EntryPoint, executes calls from owner
 */
contract SimpleAccount {
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

    address public owner;
    address public immutable entryPoint;
    uint256 public nonce;
    
    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Only EntryPoint");
        _;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner || msg.sender == address(this), "Only owner");
        _;
    }

    modifier onlyEntryPointOrOwner() {
        require(
            msg.sender == entryPoint || msg.sender == owner || msg.sender == address(this),
            "Only EntryPoint/Owner"
        );
        _;
    }
    
    constructor(address _entryPoint, address _owner) {
        require(_entryPoint != address(0), "Invalid EntryPoint");
        require(_owner != address(0), "Invalid owner");
        entryPoint = _entryPoint;
        owner = _owner;
    }
    
    /**
     * @notice Validate a UserOperation
     * @dev Called by EntryPoint during validation phase
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        // Verify operation is for this account and matches local nonce.
        require(userOp.sender == address(this), "Invalid sender");
        require(userOp.nonce == nonce, "Invalid nonce");

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(userOp.signature);

        // viem signMessage() uses EIP-191 prefix; recover over prefixed hash.
        bytes32 digest = _toEthSignedMessageHash(userOpHash);
        address signer = ecrecover(digest, v, r, s);
        require(signer == owner, "Invalid signature");

        // Bump nonce after successful validation.
        nonce += 1;

        // If EntryPoint asks for missing prefund, send it.
        if (missingAccountFunds > 0) {
            (bool ok, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(ok, "Prefund failed");
        }

        return 0;
    }
    
    /**
     * @notice Execute a call from the smart account
     * @param target Contract to call
     * @param value ETH to send
     * @param data Call data
     */
    function execute(address target, uint256 value, bytes calldata data) external onlyEntryPointOrOwner {
        (bool success, ) = target.call{value: value}(data);
        require(success, "Execution failed");
    }

    /**
     * @notice Execute multiple calls in one transaction
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external onlyEntryPointOrOwner {
        require(dest.length == value.length && value.length == func.length, "Length mismatch");
        for (uint256 i = 0; i < dest.length; i++) {
            (bool success, ) = dest[i].call{value: value[i]}(func[i]);
            require(success, "Batch execution failed");
        }
    }
    
    /**
     * @notice Update the owner address
     * @param newOwner New owner address
     */
    function updateOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    receive() external payable {}

    /**
     * @notice EIP-1271: validate a signature for `hash`
     * @param hash The hash that was signed
     * @param signature Signature bytes (r,s,v)
     * @return magic value 0x1626ba7e if the signature is valid
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        if (signature.length != 65) return 0xffffffff;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        address signer = ecrecover(hash, v, r, s);
        if (signer == owner) return 0x1626ba7e;
        return 0xffffffff;
    }

    /// @dev split a 65-byte signature into r, s, v
    function _splitSignature(bytes calldata sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid sig length");
        assembly {
            r := calldataload(add(sig.offset, 0x00))
            s := calldataload(add(sig.offset, 0x20))
            let vb := calldataload(add(sig.offset, 0x40))
            v := byte(0, vb)
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid v");
    }

    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
