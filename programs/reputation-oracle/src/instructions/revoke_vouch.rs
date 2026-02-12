use anchor_lang::prelude::*;
use crate::state::{AgentProfile, Vouch, VouchStatus, ReputationConfig};

#[derive(Accounts)]
pub struct RevokeVouch<'info> {
    #[account(
        mut,
        seeds = [b"vouch", voucher_profile.key().as_ref(), vouchee_profile.key().as_ref()],
        bump = vouch.bump,
        constraint = vouch.voucher == voucher_profile.key() @ ErrorCode::UnauthorizedVouchRevocation,
        constraint = vouch.status == VouchStatus::Active @ ErrorCode::VouchNotActive
    )]
    pub vouch: Account<'info, Vouch>,
    
    #[account(
        mut,
        seeds = [b"agent", voucher.key().as_ref()],
        bump = voucher_profile.bump
    )]
    pub voucher_profile: Account<'info, AgentProfile>,
    
    #[account(
        mut,
        seeds = [b"agent", vouchee_profile.authority.as_ref()],
        bump = vouchee_profile.bump
    )]
    pub vouchee_profile: Account<'info, AgentProfile>,
    
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ReputationConfig>,
    
    #[account(mut)]
    pub voucher: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RevokeVouch>) -> Result<()> {
    let vouch = &mut ctx.accounts.vouch;
    let stake_amount = vouch.stake_amount;
    
    // Mark as revoked
    vouch.status = VouchStatus::Revoked;
    
    // Return stake to voucher (after cooldown, but simplified for MVP)
    // In production, would check cooldown_period
    **vouch.to_account_info().try_borrow_mut_lamports()? = vouch
        .to_account_info()
        .lamports()
        .saturating_sub(stake_amount);
    **ctx.accounts.voucher.try_borrow_mut_lamports()? = ctx
        .accounts
        .voucher
        .lamports()
        .saturating_add(stake_amount);
    
    // Update profiles
    let voucher_profile = &mut ctx.accounts.voucher_profile;
    voucher_profile.total_vouches_given = voucher_profile.total_vouches_given.saturating_sub(1);
    
    let vouchee_profile = &mut ctx.accounts.vouchee_profile;
    vouchee_profile.total_vouches_received = vouchee_profile.total_vouches_received.saturating_sub(1);
    vouchee_profile.total_staked_for = vouchee_profile.total_staked_for.saturating_sub(stake_amount);
    
    // Recompute reputation
    let config = &ctx.accounts.config;
    vouchee_profile.reputation_score = vouchee_profile.compute_reputation(config);
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized vouch revocation")]
    UnauthorizedVouchRevocation,
    #[msg("Vouch is not active")]
    VouchNotActive,
}
