// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IProjectToken} from "./interfaces/ITokens.sol";
import {Unauthorized, ZeroAddress} from "./types/MonetaErrors.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {
    ERC20PermitUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title ProjectToken
/// @notice A Moneta project's ownership token: ERC-20 + EIP-2612 permit. Its Treasury is the sole minter and burner.
/// @dev Deployed as an EIP-1167 clone; initializer instead of constructor. Nothing is upgradeable.
contract ProjectToken is Initializable, ERC20Upgradeable, ERC20PermitUpgradeable, IProjectToken {
    /// @inheritdoc IProjectToken
    address public treasury;

    modifier onlyTreasury() {
        if (msg.sender != treasury) revert Unauthorized();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc IProjectToken
    function initialize(string calldata name_, string calldata symbol_, address treasury_)
        external
        initializer
    {
        if (treasury_ == address(0)) revert ZeroAddress();
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        treasury = treasury_;
    }

    /// @inheritdoc IProjectToken
    function mint(address to, uint256 amount) external onlyTreasury {
        _mint(to, amount);
    }

    /// @inheritdoc IProjectToken
    function treasuryBurn(address from, uint256 amount) external onlyTreasury {
        _burn(from, amount);
    }
}
