// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// ── Shared ───────────────────────────────────────────────────────────────────
error ZeroAddress();
error ZeroAmount();
error Unauthorized();
error AlreadyInitialized();
error TransferAmountMismatch();
error InvalidParam(bytes32 field);

// ── Factory ──────────────────────────────────────────────────────────────────
error CreationPaused();
error QuoteNotAllowed(address quote);
error MemoTooLarge(uint256 size, uint256 max);
error FeeTooHigh();
error UnknownRaise();

// ── Raise ────────────────────────────────────────────────────────────────────
error NotOpen();
error TooEarly();
error AlreadyFinalized();
error NotFinalized();
error NothingToClaim();
error AlreadyClaimed();
error GraceNotOver();

// ── AMM ──────────────────────────────────────────────────────────────────────
error PoolNotFound();
error PoolIsClosed();
error NotPoolOwner();
error TradingClosed();
error NoLiquidity();
error Slippage(uint256 out, uint256 minOut);
error InvalidPool();
error TwapNotReady();

// ── Vault ────────────────────────────────────────────────────────────────────
error ConditionExists();
error ConditionNotFound();
error CollateralExists();
error CollateralNotPrepared();
error AlreadyResolved();
error NotResolved();
error InvalidOutcome();

// ── Treasury ─────────────────────────────────────────────────────────────────
error NotLaunched();
error AlreadyLaunched();
error ProjectRedeemed();
error NotRedeemed();
error NotFounder();
error SlotBusy();
error RedemptionQueued();
error InvalidAction(uint8 code);
error NotActive();
error NotPassed();
error ExecutionExpired();
error InsufficientFunds(uint256 needed, uint256 available);
error BondsAtRisk();
error TargetNotMet(uint256 twap, uint256 target);
error AlreadyUnlocked();
error UnlockNotStarted();

// ── Router ───────────────────────────────────────────────────────────────────
error UnknownTreasury();
