// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract ReentrantPaymentToken is ERC20 {
    address public target;
    bool public reentryBlocked;

    constructor() ERC20("Reentrant Token", "REENT") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function setTarget(address target_) external {
        target = target_;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (msg.sender == target) {
            (bool success,) = target.call(abi.encodeWithSignature("fundProject(uint256)", 0));
            reentryBlocked = !success;
        }
        return super.transferFrom(from, to, value);
    }
}
