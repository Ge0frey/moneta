// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RaiseStatus} from "../types/MonetaTypes.sol";

/// @title IRaise
/// @notice Per-raise USDC escrow: contribute → finalize (launch or fail) → claim.
interface IRaise {
    struct InitArgs {
        address factory;
        uint256 raiseId;
        address quote;
        address founder;
        uint128 price;
        uint128 minRaise;
        uint128 maxRaise;
        uint40 start;
        uint40 end;
        uint40 finalizeGrace;
        uint16 liquidityBps;
        uint16 feeBps;
        bytes projectConfig; // abi.encode(ProjectConfig)
    }

    event Contributed(
        address indexed contributor, uint256 amount, uint256 contribution, uint256 totalContributed
    );
    event RaiseFinalized(RaiseStatus status, uint256 accepted, uint256 fee, address token, address treasury);
    event RaiseAborted();
    event Claimed(address indexed contributor, uint256 tokens, uint256 refund);

    function initialize(InitArgs calldata args) external;
    function contribute(uint256 amount) external;
    function contributeWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function finalize() external;
    function abort() external;
    function claim() external returns (uint256 tokens, uint256 refund);

    function previewClaim(address account) external view returns (uint256 tokens, uint256 refund);
    function factory() external view returns (address);
    function raiseId() external view returns (uint256);
    function quote() external view returns (address);
    function founder() external view returns (address);
    function price() external view returns (uint128);
    function minRaise() external view returns (uint128);
    function maxRaise() external view returns (uint128);
    function start() external view returns (uint40);
    function end() external view returns (uint40);
    function finalizeGrace() external view returns (uint40);
    function liquidityBps() external view returns (uint16);
    function feeBps() external view returns (uint16);
    function status() external view returns (RaiseStatus);
    function totalContributed() external view returns (uint256);
    function contributorCount() external view returns (uint256);
    function accepted() external view returns (uint256);
    function contributorTokens() external view returns (uint256);
    function token() external view returns (address);
    function treasury() external view returns (address);
    function contributionOf(address account) external view returns (uint256);
    function claimed(address account) external view returns (bool);
    function projectConfig() external view returns (bytes memory);
}
