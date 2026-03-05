use anchor_lang::prelude::*;
use crate::state::{SkillListing, SkillStatus, AgentProfile};
use crate::events::SkillListingUpdated;

#[derive(Accounts)]
#[instruction(skill_id: String)]
pub struct UpdateSkillListing<'info> {
    #[account(
        mut,
        seeds = [b"skill", author.key().as_ref(), skill_id.as_bytes()],
        bump = skill_listing.bump,
        constraint = skill_listing.author == author.key() @ UpdateSkillError::NotAuthor,
        constraint = skill_listing.status != SkillStatus::Removed @ UpdateSkillError::SkillRemoved,
    )]
    pub skill_listing: Account<'info, SkillListing>,

    #[account(
        seeds = [b"agent", author.key().as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,

    pub author: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateSkillListing>,
    _skill_id: String,
    skill_uri: String,
    name: String,
    description: String,
    price_lamports: u64,
) -> Result<()> {
    require!(
        skill_uri.len() <= SkillListing::MAX_URI_LEN,
        UpdateSkillError::UriTooLong
    );
    require!(
        name.len() <= SkillListing::MAX_NAME_LEN,
        UpdateSkillError::NameTooLong
    );
    require!(
        description.len() <= SkillListing::MAX_DESCRIPTION_LEN,
        UpdateSkillError::DescriptionTooLong
    );
    require!(price_lamports > 0, UpdateSkillError::PriceMustBePositive);

    let skill_listing = &mut ctx.accounts.skill_listing;
    let clock = Clock::get()?;

    skill_listing.skill_uri = skill_uri;
    skill_listing.name = name.clone();
    skill_listing.description = description;
    skill_listing.price_lamports = price_lamports;
    skill_listing.updated_at = clock.unix_timestamp;

    emit!(SkillListingUpdated {
        skill_listing: ctx.accounts.skill_listing.key(),
        author: ctx.accounts.author.key(),
        name,
        price_lamports,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[error_code]
pub enum UpdateSkillError {
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Price must be greater than zero")]
    PriceMustBePositive,
    #[msg("Only the author can update this listing")]
    NotAuthor,
    #[msg("Cannot update a removed listing")]
    SkillRemoved,
}
