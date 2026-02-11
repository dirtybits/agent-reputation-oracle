use anchor_lang::prelude::*;

#[account]
pub struct ReputationConfig {
    pub authority: Pubkey,            // Program admin
    pub min_stake: u64,               // Minimum vouch stake (lamports)
    pub dispute_bond: u64,            // Bond required to open dispute
    pub slash_percentage: u8,         // % of stake slashed (e.g. 50)
    pub cooldown_period: i64,         // Seconds before revoked vouch stake returns
    
    // Reputation score weights
    pub stake_weight: u32,            // Weight per lamport staked (default: 1)
    pub vouch_weight: u32,            // Points per vouch (default: 100)
    pub dispute_penalty: u32,         // Points lost per dispute loss (default: 500)
    pub longevity_bonus: u32,         // Points per day registered (default: 10)
    
    pub bump: u8,
}

impl ReputationConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // min_stake
        8 + // dispute_bond
        1 + // slash_percentage
        8 + // cooldown_period
        4 + // stake_weight
        4 + // vouch_weight
        4 + // dispute_penalty
        4 + // longevity_bonus
        1; // bump
}
