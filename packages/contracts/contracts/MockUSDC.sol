// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet-only payment token. It must never be used as a real stablecoin.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;
    uint64 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address account => uint64 claimedAt) public lastFaucetAt;

    error FaucetCooldownActive(uint64 availableAt);

    event FaucetClaimed(address indexed account, uint256 amount);

    constructor() ERC20("Mock USD Coin", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        uint64 lastClaim = lastFaucetAt[msg.sender];
        uint64 availableAt = lastClaim + FAUCET_COOLDOWN;
        if (lastClaim != 0 && block.timestamp < availableAt) {
            revert FaucetCooldownActive(availableAt);
        }

        lastFaucetAt[msg.sender] = uint64(block.timestamp);
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
}
