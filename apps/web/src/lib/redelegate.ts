"use client"
import {
  type Address,
  type Hex,
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  type PrivateKeyAccount,
} from "viem"
import type { GrantedPermissionContext } from "./permissions"
import { buildSpecialistCaveats } from "@marque/delegation"
import { USDC_BASE, type SpecialistKind } from "@marque/shared"

const DELEGATION_TYPES = {
  Caveat: [
    { name: "enforcer", type: "address" },
    { name: "terms", type: "bytes" },
  ],
  Delegation: [
    { name: "delegate", type: "address" },
    { name: "delegator", type: "address" },
    { name: "authority", type: "bytes32" },
    { name: "caveats", type: "Caveat[]" },
    { name: "salt", type: "uint256" },
  ],
} as const

export interface CaveatStruct {
  enforcer: Address
  terms: Hex
  args: Hex
}

export interface ChildDelegation {
  delegate: Address
  delegator: Address
  authority: Hex
  caveats: CaveatStruct[]
  salt: bigint
  signature: Hex
}

export interface SignChildDelegationArgs {
  delegator: PrivateKeyAccount
  delegate: Address
  delegationManager: Address
  chainId: number
  parent: GrantedPermissionContext
  caveats?: CaveatStruct[]
}

export interface SignSpecialistRedelegationArgs {
  delegator: PrivateKeyAccount
  delegate: Address
  delegationManager: Address
  chainId: number
  parent: GrantedPermissionContext
  specialistKind: SpecialistKind
  brokerAddress: Address
  perCallCapAtoms: bigint
  ttlSeconds: number
}

function parentAuthority(parent: GrantedPermissionContext): Hex {
  return keccak256(parent.context)
}

export async function signChildDelegation(args: SignChildDelegationArgs): Promise<ChildDelegation> {
  const salt = BigInt(`0x${crypto.getRandomValues(new Uint8Array(8)).reduce((acc, b) => acc + b.toString(16).padStart(2, "0"), "")}`)
  const caveats = args.caveats ?? []

  const message = {
    delegate: args.delegate,
    delegator: args.delegator.address,
    authority: parentAuthority(args.parent),
    caveats: caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
    salt,
  }

  const signature = await args.delegator.signTypedData({
    domain: {
      name: "DelegationManager",
      version: "1",
      chainId: args.chainId,
      verifyingContract: args.delegationManager,
    },
    types: DELEGATION_TYPES,
    primaryType: "Delegation",
    message,
  })

  return {
    delegate: args.delegate,
    delegator: args.delegator.address,
    authority: parentAuthority(args.parent),
    caveats,
    salt,
    signature,
  }
}

export function encodeChildDelegationAsContext(d: ChildDelegation, parentContext: Hex): Hex {
  const child = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "delegate", type: "address" },
          { name: "delegator", type: "address" },
          { name: "authority", type: "bytes32" },
          {
            name: "caveats",
            type: "tuple[]",
            components: [
              { name: "enforcer", type: "address" },
              { name: "terms", type: "bytes" },
              { name: "args", type: "bytes" },
            ],
          },
          { name: "salt", type: "uint256" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    [
      {
        delegate: d.delegate,
        delegator: d.delegator,
        authority: d.authority,
        caveats: d.caveats,
        salt: d.salt,
        signature: d.signature,
      },
    ],
  )
  return encodeAbiParameters([{ type: "bytes" }, { type: "bytes" }], [parentContext, child])
}

export function hashChildDelegation(d: ChildDelegation, delegationManager: Address, chainId: number): Hex {
  return hashTypedData({
    domain: {
      name: "DelegationManager",
      version: "1",
      chainId,
      verifyingContract: delegationManager,
    },
    types: DELEGATION_TYPES,
    primaryType: "Delegation",
    message: {
      delegate: d.delegate,
      delegator: d.delegator,
      authority: d.authority,
      caveats: d.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
      salt: d.salt,
    },
  })
}


export async function signSpecialistRedelegation(args: SignSpecialistRedelegationArgs): Promise<ChildDelegation> {
  const caveats = buildSpecialistCaveats({
    brokerAddress: args.brokerAddress,
    paymentToken: USDC_BASE,
    maxCalls: 1,
    perCallCapAtoms: args.perCallCapAtoms,
    ttlSeconds: args.ttlSeconds,
  })
  return signChildDelegation({
    delegator: args.delegator,
    delegate: args.delegate,
    delegationManager: args.delegationManager,
    chainId: args.chainId,
    parent: args.parent,
    caveats,
  })
}