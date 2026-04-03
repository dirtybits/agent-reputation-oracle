use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AuthorDisputeReason {
    MaliciousSkill,
    FraudulentClaims,
    FailedDelivery,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AuthorDisputeStatus {
    Open,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AuthorDisputeRuling {
    Upheld,
    Dismissed,
}

#[account]
pub struct AuthorDispute {
    pub dispute_id: u64,
    pub author: Pubkey,
    pub challenger: Pubkey,
    pub reason: AuthorDisputeReason,
    pub evidence_uri: String,
    pub status: AuthorDisputeStatus,
    pub ruling: Option<AuthorDisputeRuling>,
    pub skill_listing: Option<Pubkey>,
    pub purchase: Option<Pubkey>,
    pub backing_vouch_count_snapshot: u32,
    pub linked_vouch_count: u32,
    pub bond_amount: u64,
    pub created_at: i64,
    pub resolved_at: Option<i64>,
    pub bump: u8,
}

impl AuthorDispute {
    pub const MAX_EVIDENCE_URI_LENGTH: usize = 200;

    pub const LEN: usize = 8 + // discriminator
        8 + // dispute_id
        32 + // author
        32 + // challenger
        1 + // reason
        (4 + Self::MAX_EVIDENCE_URI_LENGTH) + // evidence_uri
        1 + // status
        (1 + 1) + // ruling
        (1 + 32) + // skill_listing
        (1 + 32) + // purchase
        4 + // backing_vouch_count_snapshot
        4 + // linked_vouch_count
        8 + // bond_amount
        8 + // created_at
        (1 + 8) + // resolved_at
        1; // bump
}
