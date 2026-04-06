use anchor_lang::prelude::*;
use crate::state::{
    find_author_bond_pda, AgentProfile, AuthorBond, ReputationConfig, SkillListing, SkillStatus,
};
use crate::events::SkillListingCreated;

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
        mut,
        seeds = [b"agent", author.key().as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ReputationConfig>,

    pub author_bond: Option<Account<'info, AuthorBond>>,
    
    #[account(mut)]
    pub author: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateSkillListing>,
    _skill_id: String,
    skill_uri: String,
    name: String,
    description: String,
    price_lamports: u64,
) -> Result<()> {
    require!(
        skill_uri.len() <= SkillListing::MAX_URI_LEN,
        CreateSkillError::UriTooLong
    );
    require!(
        name.len() <= SkillListing::MAX_NAME_LEN,
        CreateSkillError::NameTooLong
    );
    require!(
        description.len() <= SkillListing::MAX_DESCRIPTION_LEN,
        CreateSkillError::DescriptionTooLong
    );
    require!(
        SkillListing::is_supported_price(price_lamports),
        CreateSkillError::PriceNotSupported
    );

    if SkillListing::is_free_price(price_lamports) {
        validate_free_listing_bond(
            ctx.program_id,
            &ctx.accounts.author.key(),
            &ctx.accounts.author_profile,
            &ctx.accounts.config,
            ctx.accounts.author_bond.as_ref(),
        )?;
    }
    
    let skill_listing = &mut ctx.accounts.skill_listing;
    let clock = Clock::get()?;
    
    skill_listing.author = ctx.accounts.author.key();
    skill_listing.skill_uri = skill_uri;
    skill_listing.name = name.clone();
    skill_listing.description = description;
    skill_listing.price_lamports = price_lamports;
    skill_listing.total_downloads = 0;
    skill_listing.total_revenue = 0;
    skill_listing.unclaimed_voucher_revenue = 0;
    skill_listing.created_at = clock.unix_timestamp;
    skill_listing.updated_at = clock.unix_timestamp;
    skill_listing.status = SkillStatus::Active;
    skill_listing.bump = ctx.bumps.skill_listing;

    if SkillListing::is_free_price(price_lamports) {
        ctx.accounts.author_profile.active_free_skill_listings = ctx
            .accounts
            .author_profile
            .active_free_skill_listings
            .checked_add(1)
            .ok_or(CreateSkillError::FreeListingCountOverflow)?;
    }
    
    emit!(SkillListingCreated {
        skill_listing: ctx.accounts.skill_listing.key(),
        author: ctx.accounts.author.key(),
        name,
        price_lamports,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

fn validate_free_listing_bond(
    program_id: &Pubkey,
    author: &Pubkey,
    author_profile: &Account<AgentProfile>,
    config: &Account<ReputationConfig>,
    author_bond_account: Option<&Account<AuthorBond>>,
) -> Result<()> {
    let author_bond_account =
        author_bond_account.ok_or(CreateSkillError::MissingAuthorBondForFreeListing)?;
    let (expected_author_bond, _) = find_author_bond_pda(author, program_id);
    require_keys_eq!(
        author_bond_account.key(),
        expected_author_bond,
        CreateSkillError::AuthorBondAccountMismatch
    );

    require_keys_eq!(
        author_bond_account.author,
        *author,
        CreateSkillError::AuthorBondAccountMismatch
    );
    require!(
        author_bond_account.amount == author_profile.author_bond_lamports,
        CreateSkillError::AuthorBondProfileMismatch
    );
    require!(
        author_bond_account.amount >= config.min_author_bond_for_free_listing,
        CreateSkillError::FreeListingRequiresBondFloor
    );

    Ok(())
}

#[error_code]
pub enum CreateSkillError {
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Price must be zero or at least the minimum paid listing price")]
    PriceNotSupported,
    #[msg("Free listings must provide the author's bond account")]
    MissingAuthorBondForFreeListing,
    #[msg("Free listings require the configured minimum author bond")]
    FreeListingRequiresBondFloor,
    #[msg("Author bond PDA does not match the expected author")]
    AuthorBondAccountMismatch,
    #[msg("Author bond account does not match the author profile totals")]
    AuthorBondProfileMismatch,
    #[msg("Active free listing count overflowed")]
    FreeListingCountOverflow,
}
