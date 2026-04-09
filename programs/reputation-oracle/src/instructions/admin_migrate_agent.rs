use anchor_lang::prelude::*;

use crate::state::{AgentProfile, ReputationConfig};

use crate::instructions::agent_profile_migration::{
    derive_canonical_agent_pda, parse_agent_profile_for_migration,
    resize_agent_profile_account_if_needed, serialize_migrated_agent_profile,
    AgentProfileMigrationError,
};

#[derive(Accounts)]
pub struct AdminMigrateAgent<'info> {
    /// CHECK: This account may use a legacy layout or stale stored bump, so we
    /// validate its owner/discriminator/PDA manually before rewriting it.
    #[account(mut, owner = crate::ID)]
    pub agent_profile: UncheckedAccount<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ AdminMigrateAgentError::UnauthorizedMigrationAuthority
    )]
    pub config: Account<'info, ReputationConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AdminMigrateAgent>) -> Result<()> {
    let profile_info = &ctx.accounts.agent_profile;
    let raw = profile_info.try_borrow_data()?.to_vec();
    let parsed = parse_agent_profile_for_migration(&raw)?;
    let (expected_pda, canonical_bump) = derive_canonical_agent_pda(&parsed.authority);

    require!(
        expected_pda == profile_info.key(),
        AgentProfileMigrationError::InvalidAgentProfilePda
    );

    resize_agent_profile_account_if_needed(
        &profile_info.to_account_info(),
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
    )?;

    let mut profile = AgentProfile {
        authority: parsed.authority,
        metadata_uri: parsed.metadata_uri,
        reputation_score: parsed.reputation_score,
        total_vouches_received: parsed.total_vouches_received,
        total_vouches_given: parsed.total_vouches_given,
        total_staked_for: parsed.total_staked_for,
        author_bond_lamports: parsed.author_bond_lamports,
        active_free_skill_listings: parsed.active_free_skill_listings,
        open_author_disputes: parsed.open_author_disputes,
        registered_at: parsed.registered_at,
        bump: canonical_bump,
    };
    profile.reputation_score = profile.compute_reputation(&ctx.accounts.config);

    serialize_migrated_agent_profile(&profile_info.to_account_info(), &profile)?;
    Ok(())
}

#[error_code]
pub enum AdminMigrateAgentError {
    #[msg("Only the config authority can run admin agent migrations")]
    UnauthorizedMigrationAuthority,
}
