use anchor_lang::prelude::*;
use crate::state::{SkillListing, SkillStatus, AgentProfile};

#[derive(Accounts)]
#[instruction(skill_id: String)]
pub struct RemoveSkillListing<'info> {
    #[account(
        mut,
        seeds = [b"skill", author.key().as_ref(), skill_id.as_bytes()],
        bump = skill_listing.bump,
        constraint = skill_listing.author == author.key() @ RemoveSkillError::NotAuthor,
        constraint = skill_listing.status != SkillStatus::Removed @ RemoveSkillError::AlreadyRemoved,
    )]
    pub skill_listing: Account<'info, SkillListing>,

    #[account(
        seeds = [b"agent", author.key().as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,

    #[account(mut)]
    pub author: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveSkillListing>, _skill_id: String) -> Result<()> {
    ctx.accounts.skill_listing.status = SkillStatus::Removed;
    ctx.accounts.skill_listing.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[error_code]
pub enum RemoveSkillError {
    #[msg("Only the skill author can remove this listing")]
    NotAuthor,
    #[msg("Skill listing is already removed")]
    AlreadyRemoved,
}
