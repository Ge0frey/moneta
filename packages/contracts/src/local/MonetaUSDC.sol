// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title MonetaUSDC
/// @notice Moneta's USDC for local chains. Mirrors the Circle USDC interface Moneta relies on: 6 decimals and
///         EIP-2612 permit with EIP-712 domain version "2". Minting is open on local chains; testnet and mainnet use
///         Circle USDC, so this contract is never deployed there.
contract MonetaUSDC is ERC20, IERC20Permit, EIP712, Nonces {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    error ExpiredSignature(uint256 deadline);
    error InvalidSigner(address signer, address owner);

    constructor() ERC20("USD Coin", "USDC") EIP712("USD Coin", "2") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Circle-compatible version getter (permit domain version).
    function version() external pure returns (string memory) {
        return "2";
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp > deadline) revert ExpiredSignature(deadline);
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s);
        if (signer != owner) revert InvalidSigner(signer, owner);
        _approve(owner, spender, value);
    }

    function nonces(address owner) public view override(IERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
