// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BPS, PRICE_SCALE} from "../types/MonetaTypes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title CPMath
/// @notice Constant-product (x·y=k) swap math shared by the AMM and mirrored bit-for-bit in the TypeScript SDK.
library CPMath {
    /// @notice Output for an exact input swap. The fee is charged on input (rounded up, in favour of the pool).
    /// @return amountOut tokens sent to the trader (rounded down)
    /// @return fee total fee taken from `amountIn`
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        internal
        pure
        returns (uint256 amountOut, uint256 fee)
    {
        fee = Math.mulDiv(amountIn, feeBps, BPS, Math.Rounding.Ceil);
        uint256 inAfterFee = amountIn - fee;
        amountOut = Math.mulDiv(inAfterFee, reserveOut, reserveIn + inAfterFee);
    }

    /// @notice Spot price (quote per base, PRICE_SCALE) of a pool with the given reserves.
    function spotPrice(uint256 reserveBase, uint256 reserveQuote) internal pure returns (uint256) {
        return Math.mulDiv(reserveQuote, PRICE_SCALE, reserveBase);
    }

    /// @notice Largest (base, quote) pair, not exceeding the desired amounts, that preserves the current reserve ratio.
    function ratioMatched(
        uint256 baseDesired,
        uint256 quoteDesired,
        uint256 reserveBase,
        uint256 reserveQuote
    ) internal pure returns (uint256 baseUsed, uint256 quoteUsed) {
        uint256 quoteOptimal = Math.mulDiv(baseDesired, reserveQuote, reserveBase);
        if (quoteOptimal <= quoteDesired) return (baseDesired, quoteOptimal);
        uint256 baseOptimal = Math.mulDiv(quoteDesired, reserveBase, reserveQuote);
        return (baseOptimal, quoteDesired);
    }
}
