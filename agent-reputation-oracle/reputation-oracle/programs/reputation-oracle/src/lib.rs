use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;

use instructions::*;
use state::DisputeRuling;

declare_id!("EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj");

#[program]
pub mod reputation_oracle {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        min_stake: u64,
        dispute_bond: u64,
        slash_percentage: u8,
        cooldown_period: i64,
    ) -> Result<()> {
        instructions::initialize_config::handler(
            ctx,
            min_stake,
            dispute_bond,
            slash_percentage,
            cooldown_period,
        )
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::register_agent::handler(ctx, metadata_uri)
    }

    pub fn vouch(
        ctx: Context<CreateVouch>,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::vouch::handler(ctx, stake_amount)
    }

    pub fn revoke_vouch(ctx: Context<RevokeVouch>) -> Result<()> {
        instructions::revoke_vouch::handler(ctx)
    }

    pub fn open_dispute(
        ctx: Context<OpenDispute>,
        evidence_uri: String,
    ) -> Result<()> {
        instructions::open_dispute::handler(ctx, evidence_uri)
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        ruling: DisputeRuling,
    ) -> Result<()> {
        instructions::resolve_dispute::handler(ctx, ruling)
    }
}
