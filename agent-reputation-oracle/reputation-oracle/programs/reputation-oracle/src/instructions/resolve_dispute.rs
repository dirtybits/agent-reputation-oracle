use anchor_lang::prelude::*;
use crate::state::{Vouch, VouchStatus, Dispute, DisputeStatus, DisputeRuling, AgentProfile, ReputationConfig};

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [b"dispute", vouch.key().as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Open @ ErrorCode::DisputeNotOpen
    )]
    pub dispute: Account<'info, Dispute>,
    
    #[account(
        mut,
        constraint = vouch.status == VouchStatus::Disputed @ ErrorCode::VouchNotDisputed
    )]
    pub vouch: Account<'info, Vouch>,
    
    #[account(
        mut,
        seeds = [b"agent", voucher_profile.authority.as_ref()],
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
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::UnauthorizedResolver
    )]
    pub config: Account<'info, ReputationConfig>,
    
    pub authority: Signer<'info>,
    
    /// CHECK: Challenger receives refund if vindicated
    #[account(mut)]
    pub challenger: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ResolveDispute>,
    ruling: DisputeRuling,
) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;
    let vouch = &mut ctx.accounts.vouch;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;
    
    dispute.status = DisputeStatus::Resolved;
    dispute.ruling = Some(ruling);
    dispute.resolved_at = Some(clock.unix_timestamp);
    
    match ruling {
        DisputeRuling::SlashVoucher => {
            // Slash the voucher
            let _slash_amount = vouch.stake_amount
                .saturating_mul(config.slash_percentage as u64)
                .saturating_div(100);
            
            vouch.status = VouchStatus::Slashed;
            
            // Update voucher profile
            let voucher_profile = &mut ctx.accounts.voucher_profile;
            voucher_profile.disputes_lost = voucher_profile.disputes_lost.saturating_add(1);
            voucher_profile.total_vouches_given = voucher_profile.total_vouches_given.saturating_sub(1);
            
            // Update vouchee profile
            let vouchee_profile = &mut ctx.accounts.vouchee_profile;
            vouchee_profile.total_vouches_received = vouchee_profile.total_vouches_received.saturating_sub(1);
            vouchee_profile.total_staked_for = vouchee_profile.total_staked_for.saturating_sub(vouch.stake_amount);
            
            // Recompute reputation
            vouchee_profile.reputation_score = vouchee_profile.compute_reputation(config);
            
            // Return dispute bond to challenger
            let bond = config.dispute_bond;
            **dispute.to_account_info().try_borrow_mut_lamports()? = dispute
                .to_account_info()
                .lamports()
                .checked_sub(bond)
                .ok_or(ErrorCode::InsufficientFunds)?;
            **ctx.accounts.challenger.try_borrow_mut_lamports()? = ctx
                .accounts
                .challenger
                .lamports()
                .checked_add(bond)
                .ok_or(ErrorCode::InsufficientFunds)?;
            
            // Note: Slashed stake remains in vouch PDA (can be distributed later)
        }
        
        DisputeRuling::Vindicate => {
            // Vouch was valid
            vouch.status = VouchStatus::Vindicated;
            
            // Update voucher profile (they won)
            let voucher_profile = &mut ctx.accounts.voucher_profile;
            voucher_profile.disputes_won = voucher_profile.disputes_won.saturating_add(1);
            
            // Challenger loses bond (kept in dispute PDA or distributed to treasury)
            // For MVP, just keep it in dispute PDA
        }
    }
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Dispute is not open")]
    DisputeNotOpen,
    #[msg("Vouch is not disputed")]
    VouchNotDisputed,
    #[msg("Unauthorized resolver")]
    UnauthorizedResolver,
    #[msg("Insufficient funds")]
    InsufficientFunds,
}
