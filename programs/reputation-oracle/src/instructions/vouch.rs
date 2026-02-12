use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{AgentProfile, Vouch, VouchStatus, ReputationConfig};

#[derive(Accounts)]
#[instruction(stake_amount: u64)]
pub struct CreateVouch<'info> {
    #[account(
        init,
        payer = voucher,
        space = Vouch::LEN,
        seeds = [b"vouch", voucher_profile.key().as_ref(), vouchee_profile.key().as_ref()],
        bump
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

pub fn handler(
    ctx: Context<CreateVouch>,
    stake_amount: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    
    require!(
        stake_amount >= config.min_stake,
        ErrorCode::StakeBelowMinimum
    );
    
    require!(
        ctx.accounts.voucher_profile.authority != ctx.accounts.vouchee_profile.authority,
        ErrorCode::CannotVouchForSelf
    );
    
    // Transfer stake to vouch PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.voucher.to_account_info(),
                to: ctx.accounts.vouch.to_account_info(),
            },
        ),
        stake_amount,
    )?;
    
    let vouch = &mut ctx.accounts.vouch;
    let clock = Clock::get()?;
    
    vouch.voucher = ctx.accounts.voucher_profile.key();
    vouch.vouchee = ctx.accounts.vouchee_profile.key();
    vouch.stake_amount = stake_amount;
    vouch.created_at = clock.unix_timestamp;
    vouch.status = VouchStatus::Active;
    vouch.cumulative_revenue = 0; // Initialize marketplace revenue tracking
    vouch.last_payout_at = clock.unix_timestamp;
    vouch.bump = ctx.bumps.vouch;
    
    // Update profiles
    let voucher_profile = &mut ctx.accounts.voucher_profile;
    voucher_profile.total_vouches_given = voucher_profile.total_vouches_given.saturating_add(1);
    
    let vouchee_profile = &mut ctx.accounts.vouchee_profile;
    vouchee_profile.total_vouches_received = vouchee_profile.total_vouches_received.saturating_add(1);
    vouchee_profile.total_staked_for = vouchee_profile.total_staked_for.saturating_add(stake_amount);
    
    // Recompute reputation
    vouchee_profile.reputation_score = vouchee_profile.compute_reputation(config);
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Stake amount is below minimum")]
    StakeBelowMinimum,
    #[msg("Cannot vouch for yourself")]
    CannotVouchForSelf,
}
