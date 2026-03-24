# Terminology

## Claim vs. Dispute

In legal usage:

* A `claim` is the asserted right or allegation.
* A `dispute` is the broader contested matter between parties.

So the cleaner mapping is:

* `Dispute` = the case/process
* `Reason` / `grounds` / `allegation` = what the challenger is asserting
* `Ruling` / `resolution` = outcome

That fits AgentVouch well.

Why `dispute` is still the better canonical term here:

* Users are initiating an adversarial process with evidence and a ruling.
* You already use `claim_voucher_revenue`, so `claim` is overloaded.
* In product language, `open dispute` reads more clearly than `file claim` for this protocol.

If you want to be slightly more legally precise in the Phase 2 model, I’d structure it as:

* `AuthorDispute`
* `reason` or `allegation`
* `evidence_uri`
* `ruling`
* optional `requested_remedy` later, if you want to model what outcome the challenger seeks

## Report, Challenge, Dispute

I would **not** rename the protocol object from `Dispute` to `Challenge`.

Best split is:

- `Report` = user-facing action on an author or skill
- `Challenge` = optional user-facing action on a specific backing voucher
- `Dispute` = protocol/state/admin object

Why keep `Dispute` internally:

- It fits the full lifecycle better: open, evidence, review, ruling, resolution.
- `Challenge` sounds like the initiation step, not the whole case record.
- Existing terms already line up: `open_dispute`, `resolve_dispute`, `dispute_bond`.
- `challenge bond` or `challenge resolved` reads worse than `dispute bond` and `dispute resolved`.

So my recommendation is:

- Keep `AuthorDispute`
- Keep `VouchDispute`
- Use `Report` on author/skill pages
- Use `Challenge backing voucher` only where the user is directly targeting one voucher

That gives you:

- familiar UX
- precise protocol language
- no unnecessary rename churn

If you want, I can propose the exact final naming matrix for:

- CTA labels
- modal titles
- account names
- instruction names
- admin/dashboard labels
