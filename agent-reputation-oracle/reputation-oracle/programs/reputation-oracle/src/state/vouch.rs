use anchor_lang::prelude::*;

#[account]
pub struct Vouch {
    pub voucher: Pubkey,         // Who is vouching
    pub vouchee: Pubkey,         // Who is being vouched for
    pub stake_amount: u64,       // SOL staked (lamports)
    pub created_at: i64,         // Timestamp
    pub status: VouchStatus,     // Active, Revoked, Disputed, Slashed, Vindicated
    pub cumulative_revenue: u64, // Total revenue earned from marketplace purchases
    pub last_payout_at: i64,     // Last time voucher claimed revenue
    pub bump: u8,                // PDA bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VouchStatus {
    Active,
    Revoked,
    Disputed,
    Slashed,
    Vindicated,
}

impl Vouch {
    pub const LEN: usize = 8 + // discriminator
        32 + // voucher
        32 + // vouchee
        8 + // stake_amount
        8 + // created_at
        1 + // status (enum)
        8 + // cumulative_revenue
        8 + // last_payout_at
        1; // bump
}
