// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IMonetaAMM
/// @notice Singleton constant-product AMM with owner-only liquidity and a lagging TWAP oracle per pool.
interface IMonetaAMM {
    struct PoolInit {
        address base;
        address quote;
        uint16 feeBps;
        uint40 twapStart;
        uint40 twapEnd; // type(uint40).max for open-ended spot pools; swaps are rejected at/after twapEnd
        uint128 maxStepPerSecond; // PRICE_SCALE units per second
    }

    struct PoolView {
        address base;
        address quote;
        address owner;
        uint16 feeBps;
        bool closed;
        uint128 reserveBase;
        uint128 reserveQuote;
        uint256 observation;
        uint256 cumulative;
        uint128 maxStepPerSecond;
        uint40 lastUpdate;
        uint40 twapStart;
        uint40 twapEnd;
    }

    event PoolCreated(
        uint64 indexed poolId,
        address indexed base,
        address indexed quote,
        address owner,
        uint16 feeBps,
        uint40 twapStart,
        uint40 twapEnd,
        uint128 maxStepPerSecond
    );
    event LiquidityAdded(
        uint64 indexed poolId, uint256 base, uint256 quote, uint128 reserveBase, uint128 reserveQuote
    );
    event LiquidityRemoved(
        uint64 indexed poolId,
        address to,
        uint256 base,
        uint256 quote,
        uint128 reserveBase,
        uint128 reserveQuote
    );
    event Swap(
        uint64 indexed poolId,
        address indexed sender,
        address indexed to,
        bool baseIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 protocolFee,
        uint128 reserveBase,
        uint128 reserveQuote
    );
    event ObservationUpdated(
        uint64 indexed poolId, uint256 observation, uint256 cumulative, uint40 timestamp
    );
    event PoolClosed(uint64 indexed poolId);
    event FeeRecipientSet(address feeRecipient);
    event ProtocolFeeShareSet(uint16 shareBps);

    function createPool(PoolInit calldata init) external returns (uint64 poolId);
    function addLiquidity(uint64 poolId, uint256 baseDesired, uint256 quoteDesired)
        external
        returns (uint256 baseUsed, uint256 quoteUsed);
    function removeLiquidity(uint64 poolId, uint16 shareBps, address to)
        external
        returns (uint256 base, uint256 quote);
    function swap(uint64 poolId, bool baseIn, uint256 amountIn, uint256 minOut, address to)
        external
        returns (uint256 amountOut);
    function crank(uint64 poolId) external;

    function getPool(uint64 poolId) external view returns (PoolView memory);
    function poolCount() external view returns (uint64);
    function quote(uint64 poolId, bool baseIn, uint256 amountIn)
        external
        view
        returns (uint256 amountOut, uint256 fee);
    function spotPrice(uint64 poolId) external view returns (uint256);
    function observation(uint64 poolId) external view returns (uint256);
    function twap(uint64 poolId) external view returns (uint256);
    function twapSoFar(uint64 poolId) external view returns (uint256);
    function cumulativeNow(uint64 poolId) external view returns (uint256);
    function feeRecipient() external view returns (address);
    function protocolFeeShareBps() external view returns (uint16);
}
