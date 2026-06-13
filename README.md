<div align="center">

# Marque

**Every premium AI model, one budget, no subscription.**

Describe what you want → agents make it → you pay only for what it costs, in USDC, on-chain → you own the result.

[![Base](https://img.shields.io/badge/Base-mainnet-0052FF)](https://basescan.org/address/0x478Bb80C56a708ded5A2f3D2EA0d204aEE92a01b)
[![MetaMask Smart Accounts](https://img.shields.io/badge/MetaMask-Smart%20Accounts-F6851B)](https://docs.metamask.io/smart-accounts-kit/)
[![1Shot Relayer](https://img.shields.io/badge/1Shot-permissionless%20relayer-111)](https://1shotapi.com/)
[![Venice AI](https://img.shields.io/badge/Venice-AI-7C5CFC)](https://venice.ai/)

</div>

---

Marque is a creative studio where autonomous AI agents carry a **scoped, revocable MetaMask Smart Account delegation** as their entire budget. Describe anything (an image set, a voiceover, a track, a video, or a full ad assembled from all of them) and an agent swarm makes it on **Venice AI**'s premium models, paying per use. Every step settles on **Base mainnet** through the **1Shot permissionless relayer** (gas paid in **USDC**, the agents hold zero ETH) via an **x402 + ERC-7710** facilitator, and the finished piece is minted to you as an NFT with its media pinned to **IPFS**.

## The problem

If you make things, you rent a stack of subscriptions to do it. One tool for images, another for voice, another for music, another for video. Each is priced for *access*, not *usage*, so you pay for every month you barely touch it, the bill climbs past $80 to $100 just to keep the doors open, and you still do not truly own or have provenance for what comes out.

The reason nobody just bills you per use is custody. For an agent to pay per use across all of those services, it has to *hold money*, and there has never been a safe way to do that. An API key is an unbounded drain. A card on file has no revocation and no granularity. A hot wallet is a honeypot. So the industry defaulted to subscriptions, and you pay for idle access instead of the few renders you actually wanted.

Marque removes the custody problem, which removes the subscriptions. You keep **one USDC balance** in a MetaMask Smart Account. When you create, your account **delegates a capped, time-boxed slice** of that balance to an ephemeral agent, which **redelegates** narrower to the relayer that executes the spend. The agent is born, spends inside its envelope, settles on-chain, and dies. Your main wallet never signs a transaction it did not initiate, you pay only for what you make, and you withdraw whatever is left. **The agent carries a budget, not your keys.**

## What you can make

| You ask for | The swarm makes it with |
|---|---|
| **Image sets** | concept copy + Venice image generation |
| **Voiceovers and narration** | script + Venice text-to-speech |
| **Music** | Venice music generation |
| **Video** | Venice video generation |
| **A full ad** | all of the above, assembled into one MP4 |

Every output is paid for per use from the same USDC balance, and minted to you as a MarquePiece NFT with on-chain provenance. None of these is a separate subscription; they are one budget.

## The money & trust model

```mermaid
flowchart TD
    MM["🦊 Your MetaMask<br/>(controls everything)"] -->|deposit USDC| SA["◆ Studio Smart Account<br/>EIP-7702 · holds your balance"]
    SA -->|"ERC-7710 delegation<br/>(USDC cap, expiry)"| DIR["🤖 Director agent<br/>ephemeral session key"]
    DIR -->|"ERC-7710 redelegation<br/>(narrowed)"| RLY["⛓ 1Shot relayer target"]
    RLY -->|"redeemDelegations()<br/>gas paid in USDC"| DM["DelegationManager<br/>on Base mainnet"]
    DM -->|fee| FC["1Shot fee collector"]
    DM -->|work| TR["Marque treasury"]
    SA -.->|withdraw anytime| MM

    classDef user fill:#1c1708,stroke:#c9a45c,color:#ece6d8
    classDef chain fill:#0a1a2f,stroke:#5fd4c4,color:#ece6d8
    class MM,SA user
    class DIR,RLY,DM,FC,TR chain
```

- **You** keep your keys. Your MetaMask only ever signs a deposit, a withdraw, or the one signature that derives your studio account.
- The **studio account** is a MetaMask Smart Account (Stateless **EIP-7702**), derived deterministically from your signature, recoverable and controlled only by you.
- Each generation step signs a fresh **ERC-7710** delegation capped in USDC and time-boxed, then **redelegates** to the relayer. Caveats enforce the cap on-chain.
- The **1Shot relayer** redeems the chain and pays gas **in USDC**, so the agents never hold ETH.

## System architecture

```mermaid
flowchart TB
    MM["🦊 You · MetaMask"]

    subgraph WEB["apps/web · studio"]
        direction LR
        ORC["Orchestrator"]
        UI["Studio UI + balance"]
        GAL["Gallery"]
    end

    subgraph BRK["apps/broker · x402-7710 facilitator"]
        direction LR
        VEN["/broker/venice/:agent"]
        MNT["/mint"]
    end

    subgraph EXT["external services + Base mainnet"]
        direction LR
        VENICE["🎨 Venice AI"]
        ONE["⛓ 1Shot relayer"]
        PINATA["📌 Pinata / IPFS"]
        PIECE["🖼 MarquePiece NFT"]
    end

    MM -->|deposit / sign| UI
    UI --> ORC
    ORC -->|"x402 · ERC-7710 chain"| VEN
    UI -->|save| MNT

    VEN -->|generate| VENICE
    VEN -->|"settle · gas in USDC"| ONE
    MNT -->|pin media| PINATA
    MNT -->|mintPiece| PIECE

    GAL -->|read PieceMinted| PIECE
    GAL -->|load media| PINATA

    classDef web fill:#1c1708,stroke:#c9a45c,color:#ece6d8
    classDef brk fill:#13110a,stroke:#e2bd74,color:#ece6d8
    classDef ext fill:#0a1a2f,stroke:#5fd4c4,color:#ece6d8
    class UI,ORC,GAL web
    class VEN,MNT brk
    class VENICE,ONE,PINATA,PIECE ext
```

## End-to-end flow

```mermaid
sequenceDiagram
    autonumber
    actor U as You (MetaMask)
    participant W as Studio (web)
    participant SA as Studio Account
    participant B as Broker
    participant R as 1Shot relayer
    participant V as Venice AI
    participant C as MarquePiece

    U->>W: Connect + one signature
    W->>SA: Derive studio Smart Account (EIP-7702)
    U->>SA: Deposit USDC
    U->>W: "Make it" (a brief)
    loop each agent (concept, image, …)
        W->>SA: sign ERC-7710 delegation + redelegation
        W->>B: POST /broker/venice/:agent (X-PAYMENT = chain)
        B->>V: generate
        V-->>B: result
        B->>R: redeem delegations (gas in USDC)
        R-->>B: settlement tx hash
        B-->>W: media + settlement hash
    end
    U->>W: Save to collection
    W->>B: POST /mint (asset)
    B->>B: pin asset + metadata to IPFS
    B->>C: mintPiece(studio account, ipfs://…)
    C-->>W: token + tx
    Note over U,C: Withdraw remaining USDC to MetaMask anytime
```

> **Note on ordering:** the broker **generates first and settles only on success**, so a failed inference never costs you anything.

## Repository layout

```
marque.run/
├─ apps/
│  ├─ web/         Next.js 15 studio: UI, studio account, orchestrator, gallery   → apps/web/README.md
│  └─ broker/      Hono server: the x402-7710 facilitator, IPFS mint, 1Shot       → apps/broker/README.md
├─ contracts/      Foundry: MarquePiece ERC-721 provenance NFT                     → contracts/README.md
├─ packages/
│  ├─ shared/      Zod schemas, the model catalog, constants, errors
│  ├─ delegation/  MetaMask delegation helpers, caveat composition, redemption
│  ├─ x402/        x402 wire types, EIP-3009 helpers
│  └─ agents/      Director orchestrator + specialist harnesses
└─ docs/           API notes, demo script (gitignored)
```

## Tech stack

| Layer | What |
|---|---|
| **Frontend** | Next.js 15 (Turbopack), React 19, Tailwind, framer-motion, wagmi + viem |
| **Smart accounts** | `@metamask/smart-accounts-kit`: EIP-7702 Stateless delegator, ERC-7710 delegation/redelegation |
| **Relayer** | 1Shot permissionless relayer (`relayer_send7710Transaction`), gas in USDC, EIP-7702 authorizations |
| **AI** | Venice AI: chat, image, audio/speech, audio (music), video |
| **Storage** | Pinata / IPFS for asset + ERC-721 metadata |
| **Backend** | Hono on Node 22, deployed behind nginx on a VPS |
| **Contract** | Solidity 0.8.27, Foundry, OpenZeppelin ERC-721 |
| **Chain** | Base mainnet (chainId 8453) |

## Deployed on Base mainnet

| Contract | Address |
|---|---|
| **MarquePiece** (this project) | [`0x478Bb80C56a708ded5A2f3D2EA0d204aEE92a01b`](https://basescan.org/address/0x478Bb80C56a708ded5A2f3D2EA0d204aEE92a01b#code) |
| DelegationManager (MetaMask) | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| EIP7702StatelessDeleGator | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Getting started

**Prerequisites:** Node 22+, pnpm 10+ (`corepack enable && corepack prepare pnpm@10.10.0 --activate`), Foundry, a MetaMask wallet on Base mainnet with a little USDC + ETH.

```bash
pnpm install
pnpm typecheck            # typecheck every workspace
pnpm dev:broker           # broker on 127.0.0.1:8789
pnpm dev:web              # studio on localhost:3001
```

Each app has its own setup, env, and architecture notes:

- **[apps/web/README.md](apps/web/README.md)** the studio: studio account, balance drawer, orchestrator, gallery
- **[apps/broker/README.md](apps/broker/README.md)** the facilitator: redemption flow, Venice client, IPFS mint, 1Shot
- **[contracts/README.md](contracts/README.md)** MarquePiece: provenance model, deploy, verify

---

<div align="center">
<sub>Marque · agents that carry a delegation, not your keys.</sub>
</div>
