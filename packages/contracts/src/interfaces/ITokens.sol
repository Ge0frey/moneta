// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title IProjectToken
/// @notice A project's ERC-20 (+ EIP-2612). Only its Treasury can mint or burn.
interface IProjectToken is IERC20Metadata {
    function initialize(string calldata name, string calldata symbol, address treasury) external;
    function mint(address to, uint256 amount) external;
    /// @notice Burn `amount` from `from`. Treasury uses it only on the caller's own balance or on treasury-held tokens.
    function treasuryBurn(address from, uint256 amount) external;
    function treasury() external view returns (address);
}

/// @title IConditionalToken
/// @notice PASS/FAIL ERC-20 minted and burned only by the ConditionalVault.
interface IConditionalToken is IERC20Metadata {
    function initialize(
        string calldata name,
        string calldata symbol,
        uint8 decimals_,
        address vault,
        address amm,
        address router
    ) external;
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function vault() external view returns (address);
}
