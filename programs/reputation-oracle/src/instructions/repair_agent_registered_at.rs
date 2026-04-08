use anchor_lang::prelude::*;

use crate::state::{AgentProfile, ReputationConfig};

const MIN_PLAUSIBLE_REGISTERED_AT: i64 = 946_684_800; // 2000-01-01T00:00:00Z
const MAX_FUTURE_SKEW_SECONDS: i64 = 366 * 24 * 60 * 60;

#[derive(Accounts)]
pub struct RepairAgentRegisteredAt<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent_profile.authority.as_ref()],
        bump = agent_profile.bump
    )]
    pub agent_profile: Account<'info, AgentProfile>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ RepairAgentRegisteredAtError::UnauthorizedRepairAuthority
    )]
    pub config: Account<'info, ReputationConfig>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<RepairAgentRegisteredAt>, registered_at: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        registered_at >= MIN_PLAUSIBLE_REGISTERED_AT
            && registered_at <= now.saturating_add(MAX_FUTURE_SKEW_SECONDS),
        RepairAgentRegisteredAtError::InvalidRegisteredAt
    );

    let agent_profile = &mut ctx.accounts.agent_profile;
    agent_profile.registered_at = registered_at;
    agent_profile.reputation_score = agent_profile.compute_reputation(&ctx.accounts.config);

    Ok(())
}

#[error_code]
pub enum RepairAgentRegisteredAtError {
    #[msg("Only the config authority can repair agent registration timestamps")]
    UnauthorizedRepairAuthority,
    #[msg("The repaired registration timestamp is outside the allowed range")]
    InvalidRegisteredAt,
}
