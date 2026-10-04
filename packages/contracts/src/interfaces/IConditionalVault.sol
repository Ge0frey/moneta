// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Outcome} from "../types/MonetaTypes.sol";

/// @title IConditionalVault
/// @notice Splits collateral into PASS/FAIL ERC-20s per condition; resolves and redeems them.
interface IConditionalVault {
    event ConditionPrepared(bytes32 indexed conditionId, address indexed resolver, bytes32 questionId);
    event ConditionalTokensCreated(
        bytes32 indexed conditionId, address indexed collateral, address passToken, address failToken
    );
    event Split(
        bytes32 indexed conditionId,
        address indexed collateral,
        address indexed account,
        address to,
        uint256 amount
    );
    event Merged(
        bytes32 indexed conditionId,
        address indexed collateral,
        address indexed account,
        address to,
        uint256 amount
    );
    event Resolved(bytes32 indexed conditionId, Outcome outcome);
    event Redeemed(
        bytes32 indexed conditionId,
        address indexed collateral,
        address indexed account,
        address to,
        uint256 burnedPass,
        uint256 burnedFail,
        uint256 payout
    );

    function prepareCondition(bytes32 questionId) external returns (bytes32 conditionId);
    function prepareCollateral(bytes32 conditionId, address collateral, string calldata label)
        external
        returns (address passToken, address failToken);
    function split(bytes32 conditionId, address collateral, uint256 amount, address to) external;
    function merge(bytes32 conditionId, address collateral, uint256 amount, address to) external;
    function resolve(bytes32 conditionId, Outcome outcome) external;
    function redeem(bytes32 conditionId, address collateral, address to) external returns (uint256 payout);

    function outcomeOf(bytes32 conditionId) external view returns (Outcome);
    function resolverOf(bytes32 conditionId) external view returns (address);
    function tokensOf(bytes32 conditionId, address collateral)
        external
        view
        returns (address passToken, address failToken);
    function collateralHeld(bytes32 conditionId, address collateral) external view returns (uint256);
    function conditionIdOf(address resolver, bytes32 questionId) external pure returns (bytes32);
    function amm() external view returns (address);
    function router() external view returns (address);
}
