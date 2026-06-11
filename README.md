# MARQUE

A serverless runtime for agent swarms.

Agents have no API keys, no servers, no custodied funds. Each agent carries a scoped MetaMask Smart Account delegation as its entire operating budget. It pays AI inference via x402, settles on-chain actions through a permissionless relayer in stablecoins, and never touches the user's keys.

## The premise

Every agentic product today has the same custody problem. To pay for inference, storage, or on-chain actions, the agent needs an API key (centralized), a credit card on file (centralized), or a hot wallet seeded by its operator (custodial). All three couple the agent to long-lived state somebody else has to defend.

MARQUE inverts that. The operator signs a single ERC-7715 permission granting a scoped, time-boxed, asset-allowlisted budget to a session-bound agent. The agent redelegates further to specialist sub-agents via ERC-7710 with narrowed caveats. Each specialist pays for what it actually consumes via x402, settled on-chain by a permissionless relayer that takes its fee in the same stablecoin. The agent is born, spends within its envelope, and dies; nothing persists.

```
operator's smart account
  └─ ERC-7715 permission ─→ Director (session EOA)
                              └─ ERC-7710 redelegation ─→ Specialist (session EOA)
                                                            └─ x402 ─→ AI service
                                                            └─ settled via permissionless relayer
```

## What's in this repository

```
apps/
  web/        Next.js operator dashboard
  broker/     Hono server, the delegation-to-x402 gateway

packages/
  delegation/ MetaMask delegation helpers, redemption client, caveat composition
  x402/       x402 wire types, EIP-3009 helpers, client
  agents/     Director orchestrator and specialist harnesses
  shared/     Zod schemas, constants, errors

contracts/    Foundry, ERC-721 provenance contract
docs/         API notes, architecture diagrams
```

## Local development

### Prerequisites

- Node.js 22+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@10.10.0 --activate`)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A MetaMask wallet that supports ERC-7715 `wallet_grantPermissions`
- A Base mainnet EOA for the operator with ~$20 USDC plus a few dollars of ETH
- A separate Base mainnet EOA for the broker float with ~$30 USDC

### Install and typecheck

```bash
pnpm install
pnpm -r typecheck
```

### Configure the broker

Copy `apps/broker/.env.example` to `apps/broker/.env` and fill in `BROKER_BEARER_TOKEN`, `BROKER_FLOAT_PRIVATE_KEY`, `BROKER_FLOAT_ADDRESS`, `ONESHOT_WEBHOOK_PUBLIC_BASE_URL`, and `DELEGATION_MANAGER_ADDRESS`. The broker listens on `127.0.0.1:8789` and is expected to be fronted by nginx or a similar reverse proxy that handles TLS.

```bash
pnpm dev:broker
```

### Configure the dashboard

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in `NEXT_PUBLIC_BROKER_URL`, `NEXT_PUBLIC_BROKER_BEARER_TOKEN`, `NEXT_PUBLIC_MINT_CONTRACT`, and `NEXT_PUBLIC_BROKER_FLOAT_ADDRESS`.

```bash
pnpm dev:web
```

### Deploy the provenance contract

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-git
forge build
forge test
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol:DeployMarquePiece \
  --rpc-url https://mainnet.base.org --broadcast
```

### Verifying end-to-end on Base mainnet

The architecture's load-bearing question is whether the permissionless relayer accepts a real MetaMask ERC-7710 delegation chain, redeems it, and confirms on Basescan. Run this once before shipping anything else:

1. Start the broker; expose port 8789 via a public URL (ngrok works for local; nginx + Let's Encrypt for a real deploy).
2. Set `ONESHOT_WEBHOOK_PUBLIC_BASE_URL` to that URL.
3. Start the dashboard at `localhost:3001`.
4. Connect a wallet, grant the budget permission, submit a brief.
5. Watch the timeline. The first specialist call should fire `broker.relay.submitted`, `broker.relay.confirmed`, then `specialist.venice.response`. If you see all three with a Basescan hash, the chain works end-to-end.

## Status

Active development. The broker, dashboard, agent runtime, and contract are implemented and typecheck cleanly across the workspace. End-to-end mainnet verification and additional documentation are in progress.
