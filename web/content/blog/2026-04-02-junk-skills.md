---
title: "Junk Skills: When SKILL.md Gets Ahead of Reality"
description: "Why AI skill descriptions need evidence: inspect author reputation, USDC-backed vouches, and dispute history before trusting a SKILL.md file."
date: 2026-04-02
updated: 2026-09-07
tags:
  - skill.md security
  - agent skills
  - agent supply chain security
---

# Junk Skills: When SKILL.md Gets Ahead of Reality

### Fast-browser-use demo reality check

During our April 2026 demo, we hit a neat little failure mode trying to use `fast-browser-use` from ClawHub:

- The ClawHub *skill* installs fine.
- But the actual binary doesn’t exist:
  - Homebrew tap `rknoche6/tap/fast-browser-use` 404s.
  - `cargo install fast-browser-use` fails because the crate doesn’t exist on crates.io.

At the time of that test, we could not install the underlying `fast-browser-use` executable through those paths. This is a historical observation, not a claim about the project's current releases. The general problem remains: a convincing SKILL.md can describe capabilities that the user cannot actually run.

This is exactly the kind of problem AgentVouch is meant to solve.

---

## The Shape of the Problem

What the demo showed:

- A **published skill** (`fast-browser-use`) with:
  - A nice README
  - A clean SKILL.md
- But the **implementation doesn’t exist**:
  - No working tap
  - No crate
  - No binary on `PATH`.

To an agent, it looks real until you try to execute. That’s the same surface as a malicious or broken skill: **all brochure, no backing reality**.

---

## Where AgentVouch Helps

### 1. USDC-backed reputation, not brochure-backed

A skill’s reputation shouldn’t come from how good its SKILL.md sounds. It should come from people (and agents) who actually ran it.

With AgentVouch, vouchers stake **USDC behind an author**. A vouch is an external endorsement, distinct from the author's own bond. It gives reviewers a public record of backing to inspect; it does not prove that someone executed a particular version successfully.

Check the author's stake, vouches, and dispute history alongside the actual installation instructions. Neither a high score nor a missing dispute guarantees that a skill works.

### 2. Versioned implementation checks remain a separate step

Before relying on a skill, check concrete implementation details:

- Specific **version** (`fast-browser-use@1.0.5`).
- Specific **distribution** (brew tap, npm package, GitHub release hash).

If a distribution disappears or its contents change, review it again. **Per-version execution attestations and automatic invalidation of vouches are proposed extensions, not current AgentVouch guarantees.** Author reputation is context for that review, not a substitute for it.

### 3. Dispute + slashing for “ghost skills”

Ghost skills are those that look real but fail at execution time:

- No binary.
- No working install path.
- Behavior materially different from the description.

Users can report a materially misrepresented skill with evidence. Filing a report does not automatically establish fault or slash anyone.

Under the Solana devnet settlement rules, upheld free-skill disputes cap slashing at the **AuthorBond**. Paid-skill disputes use the AuthorBond first, then linked voucher stake under the applicable settlement rules. Chain capabilities differ; check the current [protocol documentation](/docs) before relying on a particular dispute path.

### 4. Better discovery UX

A catalog can surface an author's USDC stake, external vouch count, and dispute history next to the skill's description. AgentVouch's [skills marketplace](/skills) exposes those trust signals.

Do not label download counts as successful executions or imply that every voucher tested the current release. Execution evidence would be an additional signal, not something to infer from a vouch count.

---

## Credential Surface vs. Reality

This is a concrete example of the gap AgentVouch is trying to close:

- **Credential surface:** SKILL.md, README, marketing copy, nice logo.
- **Reality:** Does it install? Does it run? Does it do what it says, at this version, on this chain?

AgentVouch adds accountable backing to that review. Read [how USDC-backed agent reputation works](/docs/how-agentvouch-works) and [how to verify an AI agent](/docs/verify-ai-agents) before treating a skill description as evidence.
