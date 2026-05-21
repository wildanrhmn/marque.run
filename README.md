# DELEGATE.RUN

A serverless runtime for agent swarms. Agents have no API keys, no servers, no custodied funds. Each agent carries a scoped MetaMask Smart Account delegation as its entire operating budget, paying Venice AI for inference via x402 and using 1Shot's permissionless relayer to settle on-chain actions in USDC.

Built for the MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off, May 2026.

## The demo

Type one sentence. Spend $2 USDC. Get a complete 30-second video ad minted as ERC-721 to your wallet. Five Venice endpoints, three redelegations, one user signature.

```
operator brief
  -> Director agent (signed root delegation, MultiTokenPeriodEnforcer + LogicalOrWrapperEnforcer)
       -> Concept writer specialist  (Venice /chat/completions)
       -> Image specialist x3        (Venice /image/generate)
       -> Voice specialist           (Venice /audio/speech)
       -> Music specialist           (Venice /audio/music)
       -> Video specialist           (Venice /video/complete)
  -> Composer worker stitches outputs
  -> Mint ERC-721 to operator, relayed by 1Shot, gas paid in USDC
```

Every specialist sub-delegation is signed by the Director and narrows the parent caveats further. Every call to Venice is paid via the DELEGATE.RUN broker, which redeems the delegation through the 1Shot Permissionless Relayer and forwards the request to Venice with its own x402 payment. The agent never touches funds.

## Repository layout

```
apps/
  web/        Next.js 15 operator dashboard
  broker/     Hono server, the delegation-to-x402 gateway, deploys to Progena VPS

packages/
  delegation/ MetaMask delegation helpers, redemption client, caveat composition
  x402/       x402 wire types, client, broker middleware
  agents/     Director orchestrator and specialist harnesses
  shared/     Zod schemas shared between web and broker

contracts/    Foundry, DelegateRunAd ERC-721
docs/         API notes, architecture diagrams, build journal
```

## Tracks targeted

| Track | Prize | How we hit it |
|-------|-------|---------------|
| Best A2A coordination | $3000 | Three real redelegations per run, each narrowed via caveats. Signed delegation chain submitted to DelegationManager. |
| Best use of Venice AI | $3000 | Five Venice endpoints called in the main flow (chat, image, speech, music, video). Venice crypto RPC also used for mint receipt readback. |
| Best Use of 1Shot Permissionless Relayer | $1000 | EIP-7702 upgrade through 1Shot on first run. Webhook-driven status updates. Custom x402-to-7710 facilitator built on the public mainnet relayer. |

## Local development

### Prerequisites

- Node.js 22+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@10.10.0 --activate`)
- Foundry (for the mint contract) — install from getfoundry.sh
- MetaMask Flask (for ERC-7715 `wallet_grantPermissions`) — production MetaMask does not yet expose the Advanced Permissions JSON-RPC
- A funded Base mainnet EOA for the operator: ~$10 USDC and a few dollars of ETH for the EIP-7702 upgrade
- A separate Base mainnet EOA for the broker float: ~$20 USDC plus dust ETH

### Repo layout

```
apps/web        Next.js 15 operator dashboard
apps/broker     Hono server, the delegation-to-x402 gateway, deploys to a small VPS
packages/
  shared        Constants, errors, shared types
  x402          Wire types, EIP-3009 helpers, x402 client
  delegation    Delegation chain types, redemption calldata builder
  agents        Director orchestrator and specialist definitions
contracts/      Foundry, DelegateRunAd ERC-721
docs/           API notes, build journal
```

### Install + typecheck

```powershell
pnpm install
pnpm -r typecheck
```

### Configure the broker

Copy `apps/broker/.env.example` to `apps/broker/.env` and fill in:

- `BROKER_BEARER_TOKEN`: a 32-byte hex secret shared with the dashboard
- `BROKER_FLOAT_PRIVATE_KEY` and `BROKER_FLOAT_ADDRESS`: the dedicated funding EOA on Base mainnet
- `ONESHOT_WEBHOOK_PUBLIC_BASE_URL`: the public URL of the broker (1Shot posts settlement events here)
- `DELEGATION_MANAGER_ADDRESS`: from MetaMask Smart Accounts Kit `getEnvironment(8453).contracts.DelegationManager`

Run with `pnpm dev:broker`. Listens on `:8789`.

### Configure the dashboard

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:

- `NEXT_PUBLIC_BROKER_URL`: the broker's public URL
- `NEXT_PUBLIC_BROKER_BEARER_TOKEN`: same secret as the broker
- `NEXT_PUBLIC_MINT_CONTRACT`: the deployed DelegateRunAd address (see `contracts/`)
- `NEXT_PUBLIC_BROKER_FLOAT_ADDRESS`: the broker float EOA (used in UI to show the chain)

Run with `pnpm dev:web`. Listens on `:3001`.

### Deploy the mint contract

```powershell
cd contracts
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-git
forge build
forge test
cp .env.example .env
forge script script/Deploy.s.sol:DeployDelegateRunAd --rpc-url base --private-key 0x... --broadcast --verify
```

### Spike: end-to-end on Base mainnet

The architectural risk is whether 1Shot's permissionless relayer accepts a real MetaMask ERC-7710 delegation chain. Run this before building any further features:

1. Start the broker locally with `pnpm dev:broker`.
2. Tunnel the broker port to the public internet (`ngrok http 8789`) and set `ONESHOT_WEBHOOK_PUBLIC_BASE_URL` to the ngrok URL.
3. Start the dashboard with `pnpm dev:web`.
4. Open `http://localhost:3001/run` in a browser with MetaMask Flask, connected to Base mainnet.
5. Click connect, grant the ERC-7715 budget permission (Flask will pop up), submit a brief.
6. Watch the timeline: every specialist call should produce a `broker.relay.submitted` then `broker.relay.confirmed` event, and `specialist.venice.response` after Venice settles.

If the first redemption confirms on Basescan, the architecture is real.

