import {
  parseSignature,
  type Account,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { PermitArgs } from "./types";

const erc20PermitAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "version",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "eip712Domain",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },
] as const;

/**
 * Resolve a token's EIP-712 permit domain. Circle USDC exposes `version()` ("2"); OpenZeppelin tokens
 * (ProjectToken) expose EIP-5267 `eip712Domain()`. Falls back to version "1".
 */
export async function permitDomain(client: PublicClient, token: Address, chainId: number) {
  try {
    const [, name, version] = await client.readContract({
      address: token,
      abi: erc20PermitAbi,
      functionName: "eip712Domain",
    });
    return { name, version, chainId, verifyingContract: token };
  } catch {
    const name = await client.readContract({
      address: token,
      abi: erc20PermitAbi,
      functionName: "name",
    });
    let version = "1";
    try {
      version = await client.readContract({
        address: token,
        abi: erc20PermitAbi,
        functionName: "version",
      });
    } catch {
      /* default */
    }
    return { name, version, chainId, verifyingContract: token };
  }
}

export const PERMIT_TTL_SECONDS = 1800n;

/** Sign an EIP-2612 permit and return it in the PermitArgs shape the contracts accept. */
export async function signPermit(params: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account | Address;
  token: Address;
  spender: Address;
  value: bigint;
  /** Unix seconds; default: latest block timestamp + 30 minutes (chain time — never the signer's clock). */
  deadline?: bigint;
}): Promise<PermitArgs> {
  const { publicClient, walletClient, token, spender, value } = params;
  const owner = typeof params.account === "string" ? params.account : params.account.address;
  const chainId = await publicClient.getChainId();
  const domain = await permitDomain(publicClient, token, chainId);
  const nonce = await publicClient.readContract({
    address: token,
    abi: erc20PermitAbi,
    functionName: "nonces",
    args: [owner],
  });
  // A skewed local clock (or a time-travelled dev chain) must not produce an already-expired permit.
  const deadline =
    params.deadline ??
    (await publicClient.getBlock({ blockTag: "latest" })).timestamp + PERMIT_TTL_SECONDS;

  const signature = await walletClient.signTypedData({
    account: params.account,
    domain,
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner, spender, value, nonce, deadline },
  });
  const sig = parseSignature(signature);
  return {
    enabled: true,
    value,
    deadline,
    v: Number(sig.v ?? BigInt(27 + (sig.yParity ?? 0))),
    r: sig.r,
    s: sig.s,
  };
}
