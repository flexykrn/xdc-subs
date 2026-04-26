// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract YouTubeToken is ERC20, Ownable {
    constructor(address owner_) ERC20("YouTube Token", "YTB") Ownable(owner_) {}

    function faucetMint(address user, uint256 amount) external onlyOwner {
        _mint(user, amount);
    }
}
