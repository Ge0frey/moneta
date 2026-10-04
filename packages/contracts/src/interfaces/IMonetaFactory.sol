// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Bounds, RaiseParams} from "../types/MonetaTypes.sol";

/// @title IMonetaFactory
/// @notice Registry, protocol configuration and permissionless raise creation.
interface IMonetaFactory {
    event RaiseCreated(
        uint256 indexed raiseId,
        address indexed raise,
        address indexed founder,
        address creator,
        address quote,
        RaiseParams params,
        bytes32 memoHash,
        string memo
    );
    event ProjectLaunched(uint256 indexed projectId, address indexed raise, address token, address treasury);
    event QuoteAllowed(address indexed quote, bool allowed);
    event FeesUpdated(uint16 raiseFeeBps, uint16 poolFeeBps);
    event FeeRecipientSet(address feeRecipient);
    event BoundsUpdated(Bounds bounds);
    event CreationPausedSet(bool paused);

    function createRaise(RaiseParams calldata p, string calldata memo)
        external
        returns (uint256 raiseId, address raise);
    function launch(uint256 raiseId, bytes calldata projectConfig)
        external
        returns (address token, address treasury);

    function vault() external view returns (address);
    function amm() external view returns (address);
    function raiseFeeBps() external view returns (uint16);
    function poolFeeBps() external view returns (uint16);
    function feeRecipient() external view returns (address);
    function creationPaused() external view returns (bool);
    function quoteAllowed(address quote) external view returns (bool);
    function bounds() external view returns (Bounds memory);
    function raiseCount() external view returns (uint256);
    function raiseOf(uint256 raiseId) external view returns (address);
    function raiseIdOf(address raise) external view returns (uint256);
    function isRaise(address raise) external view returns (bool);
    function projectOf(uint256 projectId) external view returns (address token, address treasury);
    function isTreasury(address treasury) external view returns (bool);
    function projectIdOf(address treasury) external view returns (uint256);
    function predictProject(uint256 raiseId) external view returns (address token, address treasury);
    function predictRaise(uint256 raiseId) external view returns (address raise);
}
