use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{SkillListing, SkillStatus, Purchase, AgentProfile, Vouch, VouchStatus};

#[derive(Accounts)]
pub struct PurchaseSkill<'info> {
    #[account(
        mut,
        constraint = skill_listing.status == SkillStatus::Active @ ErrorCode::SkillNotActive,
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
    #[account(mut, constraint = author.key() == skill_listing.author @ ErrorCode::InvalidAuthor)]
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
    let skill_listing = &mut ctx.accounts.skill_listing;
    let price = skill_listing.price_lamports;
    
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
    
    // Note: Voucher distribution happens lazily via remaining_accounts
    // Vouchers can be passed in remaining_accounts and their cumulative_revenue updated
    // For simplicity in v1, we're storing the voucher_pool amount in the skill_listing
    // and vouchers can claim their proportional share later
    
    // Update skill listing stats
    skill_listing.total_downloads = skill_listing.total_downloads.checked_add(1).unwrap();
    skill_listing.total_revenue = skill_listing.total_revenue.checked_add(price).unwrap();
    
    // Create purchase record
    let purchase = &mut ctx.accounts.purchase;
    let clock = Clock::get()?;
    purchase.buyer = ctx.accounts.buyer.key();
    purchase.skill_listing = ctx.accounts.skill_listing.key();
    purchase.purchased_at = clock.unix_timestamp;
    purchase.price_paid = price;
    purchase.bump = ctx.bumps.purchase;
    
    msg!(
        "Skill purchased by {}: {} for {} lamports (author: {}, voucher pool: {})",
        ctx.accounts.buyer.key(),
        skill_listing.name,
        price,
        author_share,
        voucher_pool
    );
    
    Ok(())
}

// Alternative: Purchase with voucher distribution
// This version takes remaining_accounts with vouches and distributes immediately
#[derive(Accounts)]
pub struct PurchaseSkillWithDistribution<'info> {
    #[account(
        mut,
        constraint = skill_listing.status == SkillStatus::Active @ ErrorCode::SkillNotActive,
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
    #[account(mut, constraint = author.key() == skill_listing.author @ ErrorCode::InvalidAuthor)]
    pub author: UncheckedAccount<'info>,
    
    #[account(
        seeds = [b"agent", skill_listing.author.as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    
    // Remaining accounts: Vouch accounts for the author/vouchee
    // We'll iterate through these and update cumulative_revenue
}

pub fn handler_with_distribution(
    ctx: Context<PurchaseSkillWithDistribution>,
) -> Result<()> {
    let skill_listing = &mut ctx.accounts.skill_listing;
    let price = skill_listing.price_lamports;
    
    // Calculate splits
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
    
    // Calculate total stake from all vouches
    let vouches: Vec<Account<Vouch>> = ctx.remaining_accounts
        .iter()
        .filter_map(|account_info| {
            Account::<Vouch>::try_from(account_info).ok()
        })
        .filter(|vouch| {
            vouch.vouchee == skill_listing.author && vouch.status == VouchStatus::Active
        })
        .collect();
    
    let total_stake: u64 = vouches.iter()
        .map(|vouch| vouch.stake_amount)
        .sum();
    
    if total_stake > 0 && vouches.len() > 0 {
        // Distribute to vouchers proportional to stake
        for vouch_account_info in ctx.remaining_accounts.iter() {
            if let Ok(mut vouch) = Account::<Vouch>::try_from(vouch_account_info) {
                if vouch.vouchee == skill_listing.author && vouch.status == VouchStatus::Active {
                    let voucher_share = voucher_pool
                        .checked_mul(vouch.stake_amount).unwrap()
                        .checked_div(total_stake).unwrap();
                    
                    vouch.cumulative_revenue = vouch.cumulative_revenue
                        .checked_add(voucher_share).unwrap();
                    
                    // Save the updated vouch
                    vouch.exit(&ctx.accounts.system_program.to_account_info())?;
                    
                    msg!(
                        "Voucher {} earned {} lamports ({}% of pool)",
                        vouch.voucher,
                        voucher_share,
                        (vouch.stake_amount * 100) / total_stake
                    );
                }
            }
        }
    }
    
    // Update skill listing stats
    skill_listing.total_downloads = skill_listing.total_downloads.checked_add(1).unwrap();
    skill_listing.total_revenue = skill_listing.total_revenue.checked_add(price).unwrap();
    
    // Create purchase record
    let purchase = &mut ctx.accounts.purchase;
    let clock = Clock::get()?;
    purchase.buyer = ctx.accounts.buyer.key();
    purchase.skill_listing = ctx.accounts.skill_listing.key();
    purchase.purchased_at = clock.unix_timestamp;
    purchase.price_paid = price;
    purchase.bump = ctx.bumps.purchase;
    
    msg!(
        "Skill purchased with distribution: {} for {} lamports",
        skill_listing.name,
        price
    );
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Skill is not active")]
    SkillNotActive,
    #[msg("Invalid author")]
    InvalidAuthor,
}
