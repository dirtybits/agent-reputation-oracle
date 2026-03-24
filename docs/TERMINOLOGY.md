# Claim vs. Dispute

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
