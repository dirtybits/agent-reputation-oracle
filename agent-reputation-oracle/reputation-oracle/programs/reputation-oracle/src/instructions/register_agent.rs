use anchor_lang::prelude::*;
use crate::state::AgentProfile;

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = AgentProfile::LEN,
        seeds = [b"agent", authority.key().as_ref()],
        bump
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterAgent>,
    metadata_uri: String,
) -> Result<()> {
    require!(
        metadata_uri.len() <= AgentProfile::MAX_URI_LENGTH,
        ErrorCode::MetadataUriTooLong
    );
    
    let agent_profile = &mut ctx.accounts.agent_profile;
    let clock = Clock::get()?;
    
    agent_profile.authority = ctx.accounts.authority.key();
    agent_profile.metadata_uri = metadata_uri;
    agent_profile.reputation_score = 0;
    agent_profile.total_vouches_received = 0;
    agent_profile.total_vouches_given = 0;
    agent_profile.total_staked_for = 0;
    agent_profile.disputes_won = 0;
    agent_profile.disputes_lost = 0;
    agent_profile.registered_at = clock.unix_timestamp;
    agent_profile.bump = ctx.bumps.agent_profile;
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Metadata URI is too long")]
    MetadataUriTooLong,
}
