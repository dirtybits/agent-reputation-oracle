use anchor_lang::prelude::*;

use crate::state::AgentProfile;

use crate::instructions::agent_profile_migration::{
    parse_agent_profile_for_migration, resize_agent_profile_account_if_needed,
    serialize_migrated_agent_profile, ParsedAgentProfile,
};

/// Migrates an existing AgentProfile PDA to the current struct layout.
/// This is needed when the on-chain struct changed (e.g. fields were removed)
/// and the stored bump is at the wrong offset, causing ConstraintSeeds failures
/// in subsequent instructions that read `author_profile.bump`.
///
/// Uses AccountInfo (unchecked) to bypass Anchor's automatic seeds+bump validation
/// so we can read and rewrite the account data even when the stored bump is stale.
#[derive(Accounts)]
pub struct MigrateAgent<'info> {
    /// CHECK: AgentProfile PDA owned by this program. We bypass typed deserialization
    /// because the stored bump may be at a stale offset after a struct layout change.
    /// Seeds and owner are validated; we rewrite the account data manually.
    #[account(
        mut,
        seeds = [b"agent", authority.key().as_ref()],
        bump,
        owner = crate::ID,
    )]
    pub agent_profile: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

fn build_migrated_profile(
    parsed: ParsedAgentProfile,
    metadata_uri: String,
    canonical_bump: u8,
) -> AgentProfile {
    AgentProfile {
        authority: parsed.authority,
        metadata_uri,
        reputation_score: parsed.reputation_score,
        total_vouches_received: parsed.total_vouches_received,
        total_vouches_given: parsed.total_vouches_given,
        total_staked_for: parsed.total_staked_for,
        author_bond_lamports: parsed.author_bond_lamports,
        active_free_skill_listings: parsed.active_free_skill_listings,
        open_author_disputes: parsed.open_author_disputes,
        registered_at: parsed.registered_at,
        bump: canonical_bump,
    }
}

pub fn handler(ctx: Context<MigrateAgent>, metadata_uri: String) -> Result<()> {
    require!(
        metadata_uri.len() <= AgentProfile::MAX_URI_LENGTH,
        MigrateAgentError::MetadataUriTooLong
    );

    let canonical_bump = ctx.bumps.agent_profile;
    let profile_info = &ctx.accounts.agent_profile;
    let authority_key = ctx.accounts.authority.key();
    let raw = profile_info.try_borrow_data()?.to_vec();
    let parsed = parse_agent_profile_for_migration(&raw)?;
    require!(
        parsed.authority == authority_key,
        MigrateAgentError::UnauthorizedAgentAuthority
    );

    resize_agent_profile_account_if_needed(
        &profile_info.to_account_info(),
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
    )?;

    let profile = build_migrated_profile(parsed, metadata_uri, canonical_bump);
    serialize_migrated_agent_profile(&profile_info.to_account_info(), &profile)?;

    Ok(())
}

#[error_code]
pub enum MigrateAgentError {
    #[msg("Metadata URI is too long")]
    MetadataUriTooLong,
    #[msg("Only the agent authority can migrate this profile")]
    UnauthorizedAgentAuthority,
}
