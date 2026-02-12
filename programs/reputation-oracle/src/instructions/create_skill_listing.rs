use anchor_lang::prelude::*;
use crate::state::{SkillListing, SkillStatus, AgentProfile};

#[derive(Accounts)]
#[instruction(skill_id: String)]
pub struct CreateSkillListing<'info> {
    #[account(
        init,
        payer = author,
        space = SkillListing::SPACE,
        seeds = [b"skill", author.key().as_ref(), skill_id.as_bytes()],
        bump
    )]
    pub skill_listing: Account<'info, SkillListing>,
    
    #[account(
        seeds = [b"agent", author.key().as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,
    
    #[account(mut)]
    pub author: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateSkillListing>,
    skill_id: String,
    skill_uri: String,
    name: String,
    description: String,
    price_lamports: u64,
) -> Result<()> {
    require!(
        skill_uri.len() <= SkillListing::MAX_URI_LEN,
        ErrorCode::UriTooLong
    );
    require!(
        name.len() <= SkillListing::MAX_NAME_LEN,
        ErrorCode::NameTooLong
    );
    require!(
        description.len() <= SkillListing::MAX_DESCRIPTION_LEN,
        ErrorCode::DescriptionTooLong
    );
    require!(price_lamports > 0, ErrorCode::PriceMustBePositive);
    
    let skill_listing = &mut ctx.accounts.skill_listing;
    let clock = Clock::get()?;
    
    skill_listing.author = ctx.accounts.author.key();
    skill_listing.skill_uri = skill_uri;
    skill_listing.name = name;
    skill_listing.description = description;
    skill_listing.price_lamports = price_lamports;
    skill_listing.total_downloads = 0;
    skill_listing.total_revenue = 0;
    skill_listing.created_at = clock.unix_timestamp;
    skill_listing.updated_at = clock.unix_timestamp;
    skill_listing.status = SkillStatus::Active;
    skill_listing.bump = ctx.bumps.skill_listing;
    
    msg!("Skill listing created: {} by {}", name, ctx.accounts.author.key());
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Price must be greater than zero")]
    PriceMustBePositive,
}
