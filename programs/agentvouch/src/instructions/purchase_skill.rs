use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use crate::state::{AgentProfile, Purchase, ReputationConfig, SkillListing, SkillStatus, REWARD_INDEX_SCALE};
use crate::events::SkillPurchased;

#[derive(Accounts)]
pub struct PurchaseSkill<'info> {
    #[account(
        mut,
        constraint = skill_listing.status == SkillStatus::Active @ PurchaseError::SkillNotActive,
    )]
    pub skill_listing: Box<Account<'info, SkillListing>>,
    
    #[account(
        init,
        payer = buyer,
        space = Purchase::SPACE,
        seeds = [b"purchase", buyer.key().as_ref(), skill_listing.key().as_ref()],
        bump
    )]
    pub purchase: Box<Account<'info, Purchase>>,

    /// CHECK: Author wallet receives direct USDC payout.
    #[account(constraint = author.key() == skill_listing.author @ PurchaseError::InvalidAuthor)]
    pub author: UncheckedAccount<'info>,
    
    #[account(
        seeds = [b"agent", skill_listing.author.as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Box<Account<'info, AgentProfile>>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, ReputationConfig>>,

    #[account(address = config.usdc_mint @ PurchaseError::InvalidUsdcMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = buyer_usdc_account.mint == config.usdc_mint @ PurchaseError::InvalidTokenMint,
        constraint = buyer_usdc_account.owner == buyer.key() @ PurchaseError::InvalidTokenOwner
    )]
    pub buyer_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = author_usdc_account.mint == config.usdc_mint @ PurchaseError::InvalidTokenMint,
        constraint = author_usdc_account.owner == author.key() @ PurchaseError::InvalidTokenOwner
    )]
    pub author_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address = skill_listing.reward_vault @ PurchaseError::RewardVaultMismatch,
        constraint = reward_vault.mint == config.usdc_mint @ PurchaseError::InvalidTokenMint
    )]
    pub reward_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PurchaseSkill>) -> Result<()> {
    require!(!ctx.accounts.config.paused, PurchaseError::ProtocolPaused);
    let skill_listing_key = ctx.accounts.skill_listing.key();
    let price_usdc_micros = ctx.accounts.skill_listing.price_usdc_micros;
    require!(price_usdc_micros > 0, PurchaseError::FreeSkillNotPurchased);
    require!(
        ctx.accounts.skill_listing.active_reward_stake_usdc_micros > 0,
        PurchaseError::NoActiveRewardStake
    );

    let author_share_usdc_micros = price_usdc_micros
        .checked_mul(ctx.accounts.config.author_share_bps as u64)
        .ok_or(PurchaseError::PaymentOverflow)?
        .checked_div(10_000)
        .ok_or(PurchaseError::PaymentOverflow)?;
    let voucher_pool_usdc_micros = price_usdc_micros
        .checked_mul(ctx.accounts.config.voucher_share_bps as u64)
        .ok_or(PurchaseError::PaymentOverflow)?
        .checked_div(10_000)
        .ok_or(PurchaseError::PaymentOverflow)?;
    require!(voucher_pool_usdc_micros > 0, PurchaseError::VoucherPoolTooSmall);

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.buyer_usdc_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.author_usdc_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        author_share_usdc_micros,
        ctx.accounts.usdc_mint.decimals,
    )?;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.buyer_usdc_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.reward_vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        voucher_pool_usdc_micros,
        ctx.accounts.usdc_mint.decimals,
    )?;
    
    let skill_listing = &mut ctx.accounts.skill_listing;
    let index_delta = (voucher_pool_usdc_micros as u128)
        .checked_mul(REWARD_INDEX_SCALE)
        .ok_or(PurchaseError::RewardIndexOverflow)?
        .checked_div(skill_listing.active_reward_stake_usdc_micros as u128)
        .ok_or(PurchaseError::RewardIndexOverflow)?;
    require!(index_delta > 0, PurchaseError::VoucherPoolTooSmall);

    skill_listing.total_downloads = skill_listing
        .total_downloads
        .checked_add(1)
        .ok_or(PurchaseError::PaymentOverflow)?;
    skill_listing.total_revenue_usdc_micros = skill_listing
        .total_revenue_usdc_micros
        .checked_add(price_usdc_micros)
        .ok_or(PurchaseError::PaymentOverflow)?;
    skill_listing.total_author_revenue_usdc_micros = skill_listing
        .total_author_revenue_usdc_micros
        .checked_add(author_share_usdc_micros)
        .ok_or(PurchaseError::PaymentOverflow)?;
    skill_listing.total_voucher_revenue_usdc_micros = skill_listing
        .total_voucher_revenue_usdc_micros
        .checked_add(voucher_pool_usdc_micros)
        .ok_or(PurchaseError::PaymentOverflow)?;
    skill_listing.reward_index_usdc_micros_x1e12 = skill_listing
        .reward_index_usdc_micros_x1e12
        .checked_add(index_delta)
        .ok_or(PurchaseError::RewardIndexOverflow)?;
    skill_listing.unclaimed_voucher_revenue_usdc_micros = skill_listing
        .unclaimed_voucher_revenue_usdc_micros
        .checked_add(voucher_pool_usdc_micros)
        .ok_or(PurchaseError::PaymentOverflow)?;
    
    // Create purchase record
    let purchase = &mut ctx.accounts.purchase;
    let clock = Clock::get()?;
    purchase.buyer = ctx.accounts.buyer.key();
    purchase.skill_listing = skill_listing_key;
    purchase.purchased_at = clock.unix_timestamp;
    purchase.price_paid_usdc_micros = price_usdc_micros;
    purchase.author_share_usdc_micros = author_share_usdc_micros;
    purchase.voucher_pool_usdc_micros = voucher_pool_usdc_micros;
    purchase.usdc_mint = ctx.accounts.usdc_mint.key();
    purchase.bump = ctx.bumps.purchase;
    
    emit!(SkillPurchased {
        purchase: ctx.accounts.purchase.key(),
        skill_listing: skill_listing_key,
        buyer: ctx.accounts.buyer.key(),
        price_usdc_micros,
        author_share_usdc_micros,
        voucher_pool_usdc_micros,
        author_usdc_account: ctx.accounts.author_usdc_account.key(),
        reward_vault: ctx.accounts.reward_vault.key(),
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

#[error_code]
pub enum PurchaseError {
    #[msg("Skill is not active")]
    SkillNotActive,
    #[msg("Invalid author")]
    InvalidAuthor,
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Free skills do not require purchase")]
    FreeSkillNotPurchased,
    #[msg("Paid purchases require active linked vouch stake")]
    NoActiveRewardStake,
    #[msg("Payment calculation overflowed")]
    PaymentOverflow,
    #[msg("Voucher pool is too small")]
    VoucherPoolTooSmall,
    #[msg("Reward index overflowed")]
    RewardIndexOverflow,
    #[msg("USDC mint does not match config")]
    InvalidUsdcMint,
    #[msg("Token account mint does not match config")]
    InvalidTokenMint,
    #[msg("Token account owner is invalid")]
    InvalidTokenOwner,
    #[msg("Reward vault does not match listing state")]
    RewardVaultMismatch,
}
