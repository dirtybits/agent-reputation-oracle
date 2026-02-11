use anchor_lang::prelude::*;

#[account]
pub struct Vouch {
    pub voucher: Pubkey,         // Who is vouching
    pub vouchee: Pubkey,         // Who is being vouched for
    pub stake_amount: u64,       // SOL staked (lamports)
    pub created_at: i64,         // Timestamp
    pub status: VouchStatus,     // Active, Revoked, Disputed, Slashed, Vindicated
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
        1; // bump
}
