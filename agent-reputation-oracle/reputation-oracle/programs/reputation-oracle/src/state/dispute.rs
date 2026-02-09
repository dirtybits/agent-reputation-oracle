use anchor_lang::prelude::*;

#[account]
pub struct Dispute {
    pub vouch: Pubkey,               // The vouch being disputed
    pub challenger: Pubkey,          // Who opened the dispute
    pub evidence_uri: String,        // Off-chain evidence
    pub status: DisputeStatus,       // Open, Resolved
    pub ruling: Option<DisputeRuling>,
    pub created_at: i64,
    pub resolved_at: Option<i64>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DisputeStatus {
    Open,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DisputeRuling {
    SlashVoucher,    // Voucher was wrong — stake slashed
    Vindicate,       // Vouch was valid — challenger penalized
}

impl Dispute {
    pub const MAX_EVIDENCE_URI_LENGTH: usize = 200;
    
    pub const LEN: usize = 8 + // discriminator
        32 + // vouch
        32 + // challenger
        (4 + Self::MAX_EVIDENCE_URI_LENGTH) + // evidence_uri
        1 + // status
        (1 + 1) + // ruling (Option<enum>)
        8 + // created_at
        (1 + 8) + // resolved_at (Option<i64>)
        1; // bump
}
