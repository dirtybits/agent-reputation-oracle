use anchor_lang::prelude::*;

#[account]
pub struct AuthorDisputeVouchLink {
    pub author_dispute: Pubkey,
    pub vouch: Pubkey,
    pub added_at: i64,
    pub bump: u8,
}

impl AuthorDisputeVouchLink {
    pub const LEN: usize = 8 + // discriminator
        32 + // author_dispute
        32 + // vouch
        8 + // added_at
        1; // bump
}
