// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {CPMath} from "../../src/libraries/CPMath.sol";
import {LaggingOracle} from "../../src/libraries/LaggingOracle.sol";
import {Test} from "forge-std/Test.sol";

/// @notice Emits deterministic input/output vectors of the protocol math for the TypeScript SDK parity tests
///         (packages/sdk/test/parity.test.ts). Regenerate with `pnpm vectors` in packages/sdk.
contract VectorsTest is Test {
    uint256 constant N = 40;

    function _h(string memory tag, uint256 i) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(tag, i)));
    }

    function _kv(string memory k, uint256 v) internal pure returns (string memory) {
        return string.concat('"', k, '":"', vm.toString(v), '"');
    }

    function _cpEntry(uint256 i) internal pure returns (string memory) {
        uint256 rIn = _h("rIn", i) % 1e30 + 1e6;
        uint256 rOut = _h("rOut", i) % 1e30 + 1e6;
        uint256 amt = _h("amt", i) % rIn + 1;
        uint256 fee = i % 101;
        (uint256 out, uint256 f) = CPMath.getAmountOut(amt, rIn, rOut, fee);
        string memory a = string.concat(
            _kv("amountIn", amt),
            ",",
            _kv("reserveIn", rIn),
            ",",
            _kv("reserveOut", rOut),
            ",",
            _kv("feeBps", fee)
        );
        return string.concat(
            "{",
            a,
            ",",
            _kv("amountOut", out),
            ",",
            _kv("fee", f),
            ",",
            _kv("spotPrice", CPMath.spotPrice(rIn, rOut)),
            "}"
        );
    }

    function _oracleEntry(uint256 i) internal pure returns (string memory) {
        uint256 obs = _h("obs", i) % 1e30 + 1;
        uint256 spot = _h("spot", i) % 1e30 + 1;
        uint256 rate = _h("rate", i) % 1e27 + 1;
        uint256 u1 = _h("u1", i) % 5000;
        uint256 u2 = u1 + _h("u2", i) % 5000;
        uint256 elapsed = _h("el", i) % 10_000;
        string memory a = string.concat(
            _kv("obs", obs),
            ",",
            _kv("spot", spot),
            ",",
            _kv("rate", rate),
            ",",
            _kv("u1", u1),
            ",",
            _kv("u2", u2)
        );
        string memory b = string.concat(
            _kv("elapsed", elapsed),
            ",",
            _kv("integral", LaggingOracle.integral(obs, spot, rate, u1, u2)),
            ",",
            _kv("observationAt", LaggingOracle.observationAt(obs, spot, rate, elapsed))
        );
        return string.concat("{", a, ",", b, "}");
    }

    function test_writeVectors() public {
        string memory cp = "[";
        string memory or_ = "[";
        for (uint256 i; i < N; ++i) {
            cp = string.concat(cp, i == 0 ? "" : ",", _cpEntry(i));
            or_ = string.concat(or_, i == 0 ? "" : ",", _oracleEntry(i));
        }
        vm.writeFile(
            string.concat(vm.projectRoot(), "/../sdk/test/vectors/cpmath.json"), string.concat(cp, "]")
        );
        vm.writeFile(
            string.concat(vm.projectRoot(), "/../sdk/test/vectors/oracle.json"), string.concat(or_, "]")
        );
    }
}
