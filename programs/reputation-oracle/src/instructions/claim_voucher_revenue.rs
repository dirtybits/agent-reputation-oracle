use anchor_lang::prelude::*;
use crate::state::{SkillListing, Vouch, VouchStatus, AgentProfile};
use crate::events::RevenueClaimed;

#[derive(Accounts)]
pub struct ClaimVoucherRevenue<'info> {
    #[account(
        mut,
        constraint = skill_listing.author == author_profile.authority @ ClaimError::AuthorMismatch,
    )]
    pub skill_listing: Account<'info, SkillListing>,

    #[account(
        mut,
        seeds = [b"vouch", voucher_profile.key().as_ref(), author_profile.key().as_ref()],
        bump = vouch.bump,
        constraint = vouch.voucher == voucher_profile.key() @ ClaimError::VouchMismatch,
        constraint = vouch.vouchee == author_profile.key() @ ClaimError::VouchMismatch,
    )]
    pub vouch: Account<'info, Vouch>,

    #[account(
        seeds = [b"agent", voucher.key().as_ref()],
        bump = voucher_profile.bump,
    )]
    pub voucher_profile: Account<'info, AgentProfile>,

    #[account(
        seeds = [b"agent", skill_listing.author.as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,

    #[account(mut)]
    pub voucher: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimVoucherRevenue>) -> Result<()> {
    let vouch = &ctx.accounts.vouch;

    require!(
        vouch.status == VouchStatus::Active || vouch.status == VouchStatus::Vindicated,
        ClaimError::VouchNotEligible
    );

    let unclaimed = ctx.accounts.skill_listing.unclaimed_voucher_revenue;
    require!(unclaimed > 0, ClaimError::NothingToClaim);

    let total_staked = ctx.accounts.author_profile.total_staked_for;
    require!(total_staked > 0, ClaimError::NoStakeForAuthor);

    // Proportional share: unclaimed * stake_amount / total_staked_for
    let share = (unclaimed as u128)
        .checked_mul(vouch.stake_amount as u128)
        .unwrap()
        .checked_div(total_staked as u128)
        .unwrap() as u64;

    require!(share > 0, ClaimError::ShareTooSmall);

    // Transfer lamports from skill_listing PDA to voucher
    **ctx.accounts.skill_listing.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts.skill_listing.to_account_info().lamports()
        .checked_sub(share)
        .ok_or(ClaimError::InsufficientFunds)?;
    **ctx.accounts.voucher.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts.voucher.to_account_info().lamports()
        .checked_add(share)
        .ok_or(ClaimError::InsufficientFunds)?;

    // Update tracking
    let skill_listing = &mut ctx.accounts.skill_listing;
    skill_listing.unclaimed_voucher_revenue = skill_listing.unclaimed_voucher_revenue
        .checked_sub(share).unwrap();

    let clock = Clock::get()?;
    let vouch = &mut ctx.accounts.vouch;
    vouch.cumulative_revenue = vouch.cumulative_revenue.checked_add(share).unwrap();
    vouch.last_payout_at = clock.unix_timestamp;

    emit!(RevenueClaimed {
        skill_listing: ctx.accounts.skill_listing.key(),
        vouch: ctx.accounts.vouch.key(),
        voucher: ctx.accounts.voucher.key(),
        amount: share,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[error_code]
pub enum ClaimError {
    #[msg("Skill listing author does not match author profile")]
    AuthorMismatch,
    #[msg("Vouch does not match expected accounts")]
    VouchMismatch,
    #[msg("Vouch must be Active or Vindicated to claim")]
    VouchNotEligible,
    #[msg("No unclaimed revenue available")]
    NothingToClaim,
    #[msg("No stake exists for this author")]
    NoStakeForAuthor,
    #[msg("Calculated share is zero")]
    ShareTooSmall,
    #[msg("Insufficient funds in skill listing")]
    InsufficientFunds,
}
