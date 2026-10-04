// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IConditionalToken} from "./interfaces/ITokens.sol";
import {Unauthorized} from "./types/MonetaErrors.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20, IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title ConditionalToken
/// @notice PASS or FAIL claim on a collateral token for one proposal. Minted/burned only by the ConditionalVault.
/// @dev Deployed as EIP-1167 clones (initializer instead of constructor — nothing is upgradeable).
///      The protocol's immutable AMM and Router get an implicit infinite allowance so traders never need an
///      approval transaction for freshly created conditional tokens. Both contracts only ever pull tokens from
///      `msg.sender` (tested invariant), so the implicit allowance cannot be used against a third party.
contract ConditionalToken is Initializable, ERC20Upgradeable, IConditionalToken {
    address public vault;
    address public amm;
    address public router;
    uint8 private _decimals;

    modifier onlyVault() {
        if (msg.sender != vault) revert Unauthorized();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc IConditionalToken
    function initialize(
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        address vault_,
        address amm_,
        address router_
    ) external initializer {
        __ERC20_init(name_, symbol_);
        _decimals = decimals_;
        vault = vault_;
        amm = amm_;
        router = router_;
    }

    function decimals() public view override(ERC20Upgradeable, IERC20Metadata) returns (uint8) {
        return _decimals;
    }

    /// @inheritdoc IConditionalToken
    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    /// @inheritdoc IConditionalToken
    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }

    function allowance(address owner, address spender)
        public
        view
        override(ERC20Upgradeable, IERC20)
        returns (uint256)
    {
        if (_isTrustedSpender(spender)) return type(uint256).max;
        return super.allowance(owner, spender);
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal override {
        if (_isTrustedSpender(spender)) return;
        super._spendAllowance(owner, spender, value);
    }

    function _isTrustedSpender(address spender) private view returns (bool) {
        return spender == amm || spender == router;
    }
}
