import type { Address, Hex } from "viem"

export const BASE_CHAIN_ID = 8453 as const
export const BASE_CAIP2 = "eip155:8453" as const

export const USDC_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

export const VENICE_PAY_TO: Address = "0x2670B922ef37C7Df47158725C0CC407b5382293F"
export const VENICE_BASE_URL = "https://api.venice.ai/api/v1"
export const VENICE_DEFAULT_TIMEOUT_SECONDS = 300

export const ONESHOT_MAINNET_RELAYER = "https://relayer.1shotapi.com/relayers"
export const ONESHOT_TESTNET_RELAYER = "https://relayer.1shotapi.dev/relayers"
export const ONESHOT_JWKS_URL = "https://relayer.1shotapi.com/.well-known/jwks.json"

export const USDC_EIP712_NAME = "USD Coin"
export const USDC_EIP712_VERSION = "2"

export const ZERO_BYTES32: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000"
