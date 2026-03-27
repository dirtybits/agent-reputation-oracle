use anchor_lang::prelude::*;
use crate::state::{Vouch, VouchStatus, Dispute, DisputeStatus, DisputeRuling, AgentProfile, ReputationConfig};
use crate::events::DisputeResolved as DisputeResolvedEvent;
use crate::instructions::vouch_settlement::slash_vouch;

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
            let voucher_profile = &mut ctx.accounts.voucher_profile;
            let vouchee_profile = &mut ctx.accounts.vouchee_profile;
            let slash_amount = slash_vouch(vouch, voucher_profile, vouchee_profile, config)?;

            // Transfer bond + slashed stake to challenger
            let bond = config.dispute_bond;
            let total_payout = bond.checked_add(slash_amount).ok_or(ErrorCode::InsufficientFunds)?;

            // Return bond from dispute PDA
            **dispute.to_account_info().try_borrow_mut_lamports()? = dispute
                .to_account_info()
                .lamports()
                .checked_sub(bond)
                .ok_or(ErrorCode::InsufficientFunds)?;

            // Credit challenger with bond + slashed stake
            **ctx.accounts.challenger.try_borrow_mut_lamports()? = ctx
                .accounts
                .challenger
                .lamports()
                .checked_add(total_payout)
                .ok_or(ErrorCode::InsufficientFunds)?;
        }

        DisputeRuling::Vindicate => {
            // A vindicated vouch returns to the active relationship state.
            vouch.status = VouchStatus::Active;

            let voucher_profile = &mut ctx.accounts.voucher_profile;
            voucher_profile.disputes_won = voucher_profile.disputes_won.saturating_add(1);
        }
    }

    let ruling_str = match ruling {
        DisputeRuling::SlashVoucher => "SlashVoucher",
        DisputeRuling::Vindicate => "Vindicate",
    };
    emit!(DisputeResolvedEvent {
        dispute: ctx.accounts.dispute.key(),
        vouch: ctx.accounts.vouch.key(),
        ruling: ruling_str.to_string(),
        timestamp: clock.unix_timestamp,
    });
    
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
