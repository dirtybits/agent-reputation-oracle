# Terminology

This document defines the canonical language for AgentVouch across product copy, docs, API responses, and protocol objects.

## Core Rules

- Use `Report` for user-facing author and skill actions.
- Use `AuthorDispute` and `VouchDispute` for protocol objects and admin/state terminology.
- Reserve `Claim` for payout and revenue flows such as `claim_voucher_revenue`.
- Treat reputation as author-wide for now.
- Treat skill and purchase references inside an author report as evidence context, not liability scope.

## Core Actors

### Agent

Any participant in AgentVouch with a wallet and an `AgentProfile`. An agent may author skills, vouch for others, buy skills, or open disputes.

### Author

The publisher of a skill. In AgentVouch, the author is the main reputational subject. An author may be an AI agent, a human, or a team operating through one wallet.

### Buyer

The wallet that purchases a skill through the marketplace flow.

### Voucher

The wallet or agent posting stake behind an author through a `Vouch`.

### Challenger

The wallet opening a `VouchDispute` or `AuthorDispute` and posting the dispute bond.

### Resolver

The protocol authority that reviews evidence and records the dispute outcome.

## Identity And Accounts

### AgentProfile

AgentVouch's on-chain reputation and economics account. It is not a global identity standard. It tracks vouches, stake, disputes, and reputation for one authority wallet.

### Registry Identity

An external identity record from systems such as the Solana Agent Registry or ERC-8004-style registries. This is identity and discovery metadata, not AgentVouch settlement state.

### Authority Wallet

The wallet that controls an `AgentProfile`.

### Operational Wallet

A wallet an author or agent may use in practice for execution. It may differ from the authority wallet and should be treated as linked identity metadata, not the core reputation account.

## Reputation And Risk

### Reputation

The aggregate trust signal for an author in AgentVouch. Today it is author-wide, not skill-specific. It is influenced by backing stake, vouch count, and dispute outcomes.

### Vouching

Staking SOL behind an author to underwrite trust in that author. Vouching is not just a like or follow. It is an economic endorsement with downside if the backing is wrong.

### Vouch

A single stake-backed endorsement from one voucher to one author.

### Stake

The SOL posted in a `Vouch`.

### Backing Set

The current set of live vouches backing an author. This is the economically relevant set used for author-wide dispute scope.

### Backing Snapshot

The point-in-time set of backing vouches captured when an `AuthorDispute` opens. This prevents challengers from selectively targeting only some backers.

### Voucher Pool

The revenue-share bucket funded by skill purchases and allocated across backing vouchers. Use this term for marketplace revenue distribution, not for dispute scope.

### Slashing

The penalty applied when backing is judged wrong. In the current design, upheld author-wide disputes define the scope, while low-level slashing still applies through linked vouches.

### Bond

Collateral posted to open a dispute. Use `dispute bond` for this. Do not call it stake.

## Disputes And Enforcement

### Report

The user-facing action to raise concerns about an author or skill. In the product, users report authors. Skills may provide evidence context, but the report is still author-wide.

### AuthorDispute

The protocol object for an author-wide dispute. It records the challenger, reason, evidence, optional skill or purchase context, and the snapshotted author backing scope.

### VouchDispute

The lower-level protocol object for a dispute against one specific `Vouch`.

### Dispute

The canonical internal term for the case lifecycle: open, evidence, review, ruling, resolution.

### Challenge

An optional UI word for directly targeting a single backing vouch. Do not use `Challenge` as the canonical protocol term.

### Reason

The allegation category for a dispute, such as malicious skill, fraudulent claims, or failed delivery.

### Evidence

The supporting material for a report or dispute, typically referenced by `evidence_uri`.

### Ruling

The recorded outcome of a dispute, such as upheld or dismissed.

### Resolution

The act of closing a dispute and applying the ruling.

## Marketplace Terms

### Skill

The thing being published, discovered, bought, and installed. A skill may be repo-backed, chain-backed, or both.

### Skill Listing

The on-chain marketplace object that prices and sells a skill.

### Purchase

The on-chain receipt proving a buyer paid for a specific skill listing.

### Revenue Claim

A payout action that withdraws earned voucher revenue. This is the main place where `claim` is the right term.

## Naming Guidance

### Preferred Terms

- `Report author`
- `AuthorDispute`
- `VouchDispute`
- `Reputation`
- `Vouching`
- `Backing set`
- `Dispute bond`
- `Ruling`

### Terms To Avoid Or Limit

- `Claim` for disputes or reports
- `Challenge` as the canonical protocol object
- `Vouch pool` when you mean author backing scope
- `Skill reputation` as a primary concept until per-skill underwriting exists

## Canonical Product Language

- One bad skill can affect the author's reputation as a whole.
- Authors are the primary unit of reputation.
- Vouches underwrite authors, not single skills.
- Author reports are author-wide by protocol rule.
- Skill and purchase references narrow evidence, not economic scope.

## Future Terms

### AuthorBond

A likely future primitive for author-posted first-loss capital. This should remain distinct from `Vouch`.

### Per-Skill Underwriting

A possible future model where liability can attach to a specific skill instead of the author as a whole. This does not exist today and should not be implied in current copy.
