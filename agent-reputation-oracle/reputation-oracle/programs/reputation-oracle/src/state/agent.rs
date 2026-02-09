use anchor_lang::prelude::*;

#[account]
pub struct AgentProfile {
    pub authority: Pubkey,           // Agent's wallet
    pub metadata_uri: String,        // Off-chain metadata (name, description, capabilities)
    pub reputation_score: u64,       // Computed score
    pub total_vouches_received: u32, // Count of vouches received
    pub total_vouches_given: u32,    // Count of vouches given
    pub total_staked_for: u64,       // Total SOL staked by others vouching for this agent
    pub disputes_won: u32,           // Disputes won (vouches vindicated)
    pub disputes_lost: u32,          // Disputes lost (vouches slashed)
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
        4 + // disputes_won
        4 + // disputes_lost
        8 + // registered_at
        1; // bump
    
    pub fn compute_reputation(&self, config: &super::ReputationConfig) -> u64 {
        let stake_component = self.total_staked_for.saturating_mul(config.stake_weight as u64);
        let vouch_component = (self.total_vouches_received as u64).saturating_mul(config.vouch_weight as u64);
        let dispute_penalty = (self.disputes_lost as u64).saturating_mul(config.dispute_penalty as u64);
        
        // Calculate days since registration
        let now = Clock::get().unwrap().unix_timestamp;
        let age_seconds = now.saturating_sub(self.registered_at);
        let age_days = age_seconds / 86400;
        let longevity_component = (age_days as u64).saturating_mul(config.longevity_bonus as u64);
        
        stake_component
            .saturating_add(vouch_component)
            .saturating_add(longevity_component)
            .saturating_sub(dispute_penalty)
    }
}
