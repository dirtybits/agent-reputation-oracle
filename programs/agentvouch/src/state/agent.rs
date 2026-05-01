use anchor_lang::prelude::*;

#[account]
pub struct AgentProfile {
    pub authority: Pubkey,           // Agent's wallet
    pub metadata_uri: String,        // Off-chain metadata (name, description, capabilities)
    pub reputation_score: u64,       // Computed score
    pub total_vouches_received: u32, // Count of vouches received
    pub total_vouches_given: u32,    // Count of vouches given
    pub total_staked_for: u64,       // Total SOL staked by others vouching for this agent
    pub author_bond_lamports: u64,   // Self-staked capital posted by the author
    pub active_free_skill_listings: u32, // Active zero-price listings gated by the author bond
    pub open_author_disputes: u32,   // Open author-wide disputes that freeze bond withdrawals
    pub registered_at: i64,          // Timestamp
    pub bump: u8,                    // PDA bump
}

impl AgentProfile {
    pub const MAX_URI_LENGTH: usize = 200;
    
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        (4 + Self::MAX_URI_LENGTH) + // metadata_uri (String = 4 bytes length + content)
        8 + // reputation_score
        4 + // total_vouches_received
        4 + // total_vouches_given
        8 + // total_staked_for
        8 + // author_bond_lamports
        4 + // active_free_skill_listings
        4 + // open_author_disputes
        8 + // registered_at
        1; // bump
    
    pub fn compute_reputation(&self, config: &super::ReputationConfig) -> u64 {
        let total_stake_at_risk = self
            .total_staked_for
            .saturating_add(self.author_bond_lamports);
        let stake_component = total_stake_at_risk.saturating_mul(config.stake_weight as u64);
        let vouch_component = (self.total_vouches_received as u64).saturating_mul(config.vouch_weight as u64);
        
        // Calculate days since registration
        let now = Clock::get().unwrap().unix_timestamp;
        let age_seconds = now.saturating_sub(self.registered_at);
        let age_days = age_seconds / 86400;
        let longevity_component = (age_days as u64).saturating_mul(config.longevity_bonus as u64);
        
        stake_component
            .saturating_add(vouch_component)
            .saturating_add(longevity_component)
    }
}
