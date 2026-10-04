// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title LaggingOracle
/// @notice Manipulation-resistant price observation used for futarchy verdicts.
/// @dev The observation chases spot at most `maxStepPerSecond` per second. Between two updates spot is constant
///      (every reserve change triggers an update first), so the observation's path is known exactly: linear at the
///      capped rate until it reaches spot, then flat. The cumulative integrates that exact path, clipped to
///      [twapStart, twapEnd] — which makes the TWAP independent of how often anyone cranks. Monad timestamps have
///      one-second granularity, so state updates happen at most once per second per pool.
library LaggingOracle {
    struct State {
        uint256 observation; // PRICE_SCALE
        uint256 cumulative; // ∫ observation dt over the TWAP window (observation · seconds)
        uint128 maxStepPerSecond; // PRICE_SCALE units per second
        uint40 lastUpdate;
        uint40 twapStart;
        uint40 twapEnd;
    }

    /// @notice Configure the window and step cap. Called once at pool creation.
    function init(State storage s, uint40 twapStart, uint40 twapEnd, uint128 maxStepPerSecond) internal {
        s.twapStart = twapStart;
        s.twapEnd = twapEnd;
        s.maxStepPerSecond = maxStepPerSecond;
        s.lastUpdate = uint40(block.timestamp);
    }

    /// @notice Set the first observation when liquidity is first added.
    function seed(State storage s, uint256 price) internal {
        s.observation = price;
        s.lastUpdate = uint40(block.timestamp);
    }

    /// @notice Integrate elapsed time along the exact trajectory and move the observation toward `spot`.
    /// @param spot the pool's spot price, constant since the previous update
    /// @return updated false when already updated in this second
    function update(State storage s, uint256 spot) internal returns (bool updated) {
        uint256 nowTs = block.timestamp;
        uint256 last = s.lastUpdate;
        if (nowTs <= last) return false;
        uint256 obs = s.observation;
        uint256 rate = s.maxStepPerSecond;
        s.cumulative = _accrue(obs, s.cumulative, spot, rate, last, s.twapStart, s.twapEnd, nowTs);
        s.observation = observationAt(obs, spot, rate, nowTs - last);
        s.lastUpdate = uint40(nowTs);
        return true;
    }

    /// @notice Observation `elapsed` seconds after `obs`, chasing `spot` at `rate` per second.
    function observationAt(uint256 obs, uint256 spot, uint256 rate, uint256 elapsed)
        internal
        pure
        returns (uint256)
    {
        uint256 maxDelta = rate * elapsed;
        if (spot > obs) {
            uint256 d = spot - obs;
            return obs + (d < maxDelta ? d : maxDelta);
        }
        uint256 d2 = obs - spot;
        return obs - (d2 < maxDelta ? d2 : maxDelta);
    }

    /// @notice Cumulative at `ts` (>= lastUpdate), i.e. what an update at `ts` would record.
    function cumulativeAt(State storage s, uint256 spot, uint256 ts) internal view returns (uint256) {
        return _accrue(
            s.observation, s.cumulative, spot, s.maxStepPerSecond, s.lastUpdate, s.twapStart, s.twapEnd, ts
        );
    }

    /// @notice Final TWAP over the full window. Valid once `block.timestamp >= twapEnd`.
    function twap(State storage s, uint256 spot) internal view returns (uint256) {
        return cumulativeAt(s, spot, s.twapEnd) / (uint256(s.twapEnd) - s.twapStart);
    }

    /// @notice TWAP of the elapsed part of the window (projection). Returns the observation before the window opens.
    function twapSoFar(State storage s, uint256 spot) internal view returns (uint256) {
        uint256 nowTs = block.timestamp;
        if (nowTs <= s.twapStart) {
            return observationAt(s.observation, spot, s.maxStepPerSecond, nowTs - s.lastUpdate);
        }
        uint256 to = nowTs < s.twapEnd ? nowTs : s.twapEnd;
        return cumulativeAt(s, spot, to) / (to - s.twapStart);
    }

    /// @notice Cumulative value now (virtual accrual, no state change). Used for arbitrary-interval TWAPs.
    function cumulativeNow(State storage s, uint256 spot) internal view returns (uint256) {
        return cumulativeAt(s, spot, block.timestamp);
    }

    /// @notice Current observation including movement since the last update (virtual).
    function observationNow(State storage s, uint256 spot) internal view returns (uint256) {
        return observationAt(s.observation, spot, s.maxStepPerSecond, block.timestamp - s.lastUpdate);
    }

    // ─────────────────────────────────────────────────────────────────────────

    function _accrue(
        uint256 obs,
        uint256 cumulative,
        uint256 spot,
        uint256 rate,
        uint256 last,
        uint256 twapStart,
        uint256 twapEnd,
        uint256 ts
    ) private pure returns (uint256) {
        uint256 from = last > twapStart ? last : twapStart;
        uint256 to = ts < twapEnd ? ts : twapEnd;
        if (to <= from) return cumulative;
        return cumulative + integral(obs, spot, rate, from - last, to - last);
    }

    /// @notice ∫ obs(u) du over [u1, u2], where obs(u) starts at `obs0` (u = 0) and moves toward `spot` at `rate`/s.
    /// @dev Time-to-reach is floored to whole seconds; the error is below one step·second per update.
    function integral(uint256 obs0, uint256 spot, uint256 rate, uint256 u1, uint256 u2)
        internal
        pure
        returns (uint256 area)
    {
        if (u2 <= u1) return 0;
        uint256 d = spot > obs0 ? spot - obs0 : obs0 - spot;
        if (d == 0 || rate == 0) return obs0 * (u2 - u1);
        uint256 reach = d / rate;
        if (u1 >= reach) return spot * (u2 - u1);

        uint256 e = u2 < reach ? u2 : reach;
        uint256 linBase = obs0 * (e - u1);
        uint256 linMove = rate * (e * e - u1 * u1) / 2;
        area = spot > obs0 ? linBase + linMove : linBase - linMove;
        if (u2 > reach) area += spot * (u2 - reach);
    }
}
