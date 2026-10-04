// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IConditionalVault} from "./interfaces/IConditionalVault.sol";
import {IConditionalToken} from "./interfaces/ITokens.sol";
import {
    AlreadyInitialized,
    AlreadyResolved,
    CollateralExists,
    CollateralNotPrepared,
    ConditionExists,
    ConditionNotFound,
    InvalidOutcome,
    NotResolved,
    TransferAmountMismatch,
    Unauthorized,
    ZeroAddress,
    ZeroAmount
} from "./types/MonetaErrors.sol";
import {Outcome} from "./types/MonetaTypes.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

/// @title ConditionalVault
/// @notice Splits any ERC-20 collateral into PASS/FAIL tokens for a condition, merges them back, and pays the
///         winning side after the condition's resolver (a Moneta Treasury) resolves it.
/// @dev Invariant per (condition, collateral): collateralHeld >= max(passSupply, failSupply) before resolution and
///      >= winning supply after. Conditions are namespaced by resolver, so nobody can squat another's condition.
contract ConditionalVault is IConditionalVault, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    struct Condition {
        address resolver;
        Outcome outcome;
        bytes32 questionId;
    }

    struct Pair {
        address pass;
        address fail;
    }

    address public immutable tokenImplementation;
    address private immutable _deployer;

    /// @inheritdoc IConditionalVault
    address public amm;
    /// @inheritdoc IConditionalVault
    address public router;

    mapping(bytes32 conditionId => Condition) private _conditions;
    mapping(bytes32 conditionId => mapping(address collateral => Pair)) private _pairs;
    /// @inheritdoc IConditionalVault
    mapping(bytes32 conditionId => mapping(address collateral => uint256)) public collateralHeld;

    constructor(address tokenImplementation_) {
        if (tokenImplementation_ == address(0)) revert ZeroAddress();
        tokenImplementation = tokenImplementation_;
        _deployer = msg.sender;
    }

    /// @notice One-shot wiring of the trusted spenders baked into every conditional token (deploy step "Configure").
    function initialize(address amm_, address router_) external {
        if (msg.sender != _deployer) revert Unauthorized();
        if (amm != address(0)) revert AlreadyInitialized();
        if (amm_ == address(0) || router_ == address(0)) revert ZeroAddress();
        amm = amm_;
        router = router_;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Conditions
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IConditionalVault
    function prepareCondition(bytes32 questionId) external returns (bytes32 conditionId) {
        if (amm == address(0)) revert Unauthorized();
        conditionId = conditionIdOf(msg.sender, questionId);
        if (_conditions[conditionId].resolver != address(0)) revert ConditionExists();
        _conditions[conditionId] =
            Condition({resolver: msg.sender, outcome: Outcome.Unresolved, questionId: questionId});
        emit ConditionPrepared(conditionId, msg.sender, questionId);
    }

    /// @inheritdoc IConditionalVault
    function prepareCollateral(bytes32 conditionId, address collateral, string calldata label)
        external
        returns (address passToken, address failToken)
    {
        Condition storage c = _condition(conditionId);
        if (msg.sender != c.resolver) revert Unauthorized();
        if (collateral == address(0)) revert ZeroAddress();
        if (_pairs[conditionId][collateral].pass != address(0)) revert CollateralExists();

        uint8 dec = IERC20Metadata(collateral).decimals();
        passToken =
            Clones.cloneDeterministic(tokenImplementation, _salt(conditionId, collateral, Outcome.Pass));
        failToken =
            Clones.cloneDeterministic(tokenImplementation, _salt(conditionId, collateral, Outcome.Fail));
        IConditionalToken(passToken)
            .initialize(
                string.concat("Moneta PASS ", label),
                string.concat("p", label),
                dec,
                address(this),
                amm,
                router
            );
        IConditionalToken(failToken)
            .initialize(
                string.concat("Moneta FAIL ", label),
                string.concat("f", label),
                dec,
                address(this),
                amm,
                router
            );
        _pairs[conditionId][collateral] = Pair(passToken, failToken);
        emit ConditionalTokensCreated(conditionId, collateral, passToken, failToken);
    }

    /// @inheritdoc IConditionalVault
    function resolve(bytes32 conditionId, Outcome outcome) external {
        Condition storage c = _condition(conditionId);
        if (msg.sender != c.resolver) revert Unauthorized();
        if (outcome == Outcome.Unresolved) revert InvalidOutcome();
        if (c.outcome != Outcome.Unresolved) revert AlreadyResolved();
        c.outcome = outcome;
        emit Resolved(conditionId, outcome);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Positions
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IConditionalVault
    function split(bytes32 conditionId, address collateral, uint256 amount, address to)
        external
        nonReentrant
    {
        Condition storage c = _condition(conditionId);
        if (c.outcome != Outcome.Unresolved) revert AlreadyResolved();
        Pair memory pair = _pair(conditionId, collateral);
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 before = IERC20(collateral).balanceOf(address(this));
        IERC20(collateral).safeTransferFrom(msg.sender, address(this), amount);
        if (IERC20(collateral).balanceOf(address(this)) - before != amount) revert TransferAmountMismatch();

        collateralHeld[conditionId][collateral] += amount;
        IConditionalToken(pair.pass).mint(to, amount);
        IConditionalToken(pair.fail).mint(to, amount);
        emit Split(conditionId, collateral, msg.sender, to, amount);
    }

    /// @inheritdoc IConditionalVault
    function merge(bytes32 conditionId, address collateral, uint256 amount, address to)
        external
        nonReentrant
    {
        _condition(conditionId);
        Pair memory pair = _pair(conditionId, collateral);
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        IConditionalToken(pair.pass).burn(msg.sender, amount);
        IConditionalToken(pair.fail).burn(msg.sender, amount);
        collateralHeld[conditionId][collateral] -= amount;
        IERC20(collateral).safeTransfer(to, amount);
        emit Merged(conditionId, collateral, msg.sender, to, amount);
    }

    /// @inheritdoc IConditionalVault
    function redeem(bytes32 conditionId, address collateral, address to)
        external
        nonReentrant
        returns (uint256 payout)
    {
        Condition storage c = _condition(conditionId);
        if (c.outcome == Outcome.Unresolved) revert NotResolved();
        Pair memory pair = _pair(conditionId, collateral);
        if (to == address(0)) revert ZeroAddress();

        uint256 passBal = IERC20(pair.pass).balanceOf(msg.sender);
        uint256 failBal = IERC20(pair.fail).balanceOf(msg.sender);
        if (passBal > 0) IConditionalToken(pair.pass).burn(msg.sender, passBal);
        if (failBal > 0) IConditionalToken(pair.fail).burn(msg.sender, failBal);

        payout = c.outcome == Outcome.Pass ? passBal : failBal;
        if (payout > 0) {
            collateralHeld[conditionId][collateral] -= payout;
            IERC20(collateral).safeTransfer(to, payout);
        }
        emit Redeemed(conditionId, collateral, msg.sender, to, passBal, failBal, payout);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IConditionalVault
    function outcomeOf(bytes32 conditionId) external view returns (Outcome) {
        return _conditions[conditionId].outcome;
    }

    /// @inheritdoc IConditionalVault
    function resolverOf(bytes32 conditionId) external view returns (address) {
        return _conditions[conditionId].resolver;
    }

    /// @inheritdoc IConditionalVault
    function tokensOf(bytes32 conditionId, address collateral)
        external
        view
        returns (address passToken, address failToken)
    {
        Pair memory pair = _pairs[conditionId][collateral];
        return (pair.pass, pair.fail);
    }

    /// @inheritdoc IConditionalVault
    function conditionIdOf(address resolver, bytes32 questionId) public pure returns (bytes32) {
        return keccak256(abi.encode(resolver, questionId));
    }

    function _condition(bytes32 conditionId) private view returns (Condition storage c) {
        c = _conditions[conditionId];
        if (c.resolver == address(0)) revert ConditionNotFound();
    }

    function _pair(bytes32 conditionId, address collateral) private view returns (Pair memory pair) {
        pair = _pairs[conditionId][collateral];
        if (pair.pass == address(0)) revert CollateralNotPrepared();
    }

    function _salt(bytes32 conditionId, address collateral, Outcome outcome) private pure returns (bytes32) {
        return keccak256(abi.encode(conditionId, collateral, outcome));
    }
}
