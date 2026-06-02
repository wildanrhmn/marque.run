import type { Address, Hex } from "viem"

export interface Erc7715Permission {
  type:
    | "erc20-token-periodic"
    | "erc20-token-stream"
    | "native-token-periodic"
    | "native-token-stream"
  data: Record<string, unknown>
  isAdjustmentAllowed: boolean
}

export interface Erc7715GrantRequest {
  chainId: number
  expiry: number
  signer: { type: "account"; data: { address: Address } }
  permission: Erc7715Permission
}

export interface GrantedPermissionContext {
  chainId: number
  context: Hex
  delegationManager: Address
  from: Address
  to: Address
  permission: Erc7715Permission
  signer: { type: string; data: Record<string, unknown> }
  accountMeta?: unknown
  rules?: { type: string; data: Record<string, unknown> }[]
}

export interface RequestPermissionsArgs {
  delegateAddress: Address
  chainId: number
  perDayUsdcAtoms: bigint
  ttlSeconds: number
  paymentToken: Address
}

export class FlaskRequiredError extends Error {
  constructor() {
    super("MetaMask Flask required for wallet_grantPermissions")
    this.name = "FlaskRequiredError"
  }
}

function getEthereum(): { request: (args: { method: string; params: unknown }) => Promise<unknown> } | null {
  if (typeof window === "undefined") return null
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params: unknown }) => Promise<unknown> } }).ethereum
  return eth ?? null
}

export async function requestBudgetPermission(
  args: RequestPermissionsArgs,
): Promise<GrantedPermissionContext> {
  const eth = getEthereum()
  if (!eth) throw new FlaskRequiredError()

  const expiry = Math.floor(Date.now() / 1000) + args.ttlSeconds

  const request: Erc7715GrantRequest = {
    chainId: args.chainId,
    expiry,
    signer: { type: "account", data: { address: args.delegateAddress } },
    permission: {
      type: "erc20-token-periodic",
      data: {
        token: args.paymentToken,
        periodAmount: args.perDayUsdcAtoms.toString(),
        periodDuration: 86400,
        startTime: Math.floor(Date.now() / 1000),
        justification: "marque agent swarm budget",
      },
      isAdjustmentAllowed: true,
    },
  }

  let response: unknown
  try {
    response = await eth.request({ method: "wallet_grantPermissions", params: [request] })
  } catch (err) {
    const code = (err as { code?: number }).code
    if (code === -32601) throw new FlaskRequiredError()
    throw err
  }

  const wrapped = Array.isArray(response) ? response[0] : response
  return wrapped as GrantedPermissionContext
}

export async function detectFlask(): Promise<boolean> {
  const eth = getEthereum()
  if (!eth) return false
  try {
    await eth.request({ method: "wallet_getSnaps", params: [] })
    return true
  } catch {
    return false
  }
}
