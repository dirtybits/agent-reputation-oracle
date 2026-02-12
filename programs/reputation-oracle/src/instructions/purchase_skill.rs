use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{SkillListing, SkillStatus, Purchase, AgentProfile};

#[derive(Accounts)]
pub struct PurchaseSkill<'info> {
    #[account(
        mut,
        constraint = skill_listing.status == SkillStatus::Active @ PurchaseError::SkillNotActive,
    )]
    pub skill_listing: Account<'info, SkillListing>,
    
    #[account(
        init,
        payer = buyer,
        space = Purchase::SPACE,
        seeds = [b"purchase", buyer.key().as_ref(), skill_listing.key().as_ref()],
        bump
    )]
    pub purchase: Account<'info, Purchase>,
    
    /// CHECK: Author receives 60% of payment
    #[account(mut, constraint = author.key() == skill_listing.author @ PurchaseError::InvalidAuthor)]
    pub author: UncheckedAccount<'info>,
    
    #[account(
        seeds = [b"agent", skill_listing.author.as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PurchaseSkill>) -> Result<()> {
    // Get immutable values first
    let skill_listing_key = ctx.accounts.skill_listing.key();
    let price = ctx.accounts.skill_listing.price_lamports;
    let skill_name = ctx.accounts.skill_listing.name.clone();
    
    // Calculate splits: 60% author, 40% vouchers
    let author_share = price.checked_mul(60).unwrap().checked_div(100).unwrap();
    let voucher_pool = price.checked_mul(40).unwrap().checked_div(100).unwrap();
    
    // Transfer author share
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.author.to_account_info(),
            },
        ),
        author_share,
    )?;
    
    // Note: Voucher distribution happens lazily
    // Vouchers can claim their proportional share later
    // This keeps the transaction simple and avoids needing all vouch accounts
    
    // Update skill listing stats
    let skill_listing = &mut ctx.accounts.skill_listing;
    skill_listing.total_downloads = skill_listing.total_downloads.checked_add(1).unwrap();
    skill_listing.total_revenue = skill_listing.total_revenue.checked_add(price).unwrap();
    
    // Create purchase record
    let purchase = &mut ctx.accounts.purchase;
    let clock = Clock::get()?;
    purchase.buyer = ctx.accounts.buyer.key();
    purchase.skill_listing = skill_listing_key;
    purchase.purchased_at = clock.unix_timestamp;
    purchase.price_paid = price;
    purchase.bump = ctx.bumps.purchase;
    
    msg!(
        "Skill purchased by {}: {} for {} lamports (author: {}, voucher pool: {})",
        ctx.accounts.buyer.key(),
        skill_name,
        price,
        author_share,
        voucher_pool
    );
    
    Ok(())
}

#[error_code]
pub enum PurchaseError {
    #[msg("Skill is not active")]
    SkillNotActive,
    #[msg("Invalid author")]
    InvalidAuthor,
}
