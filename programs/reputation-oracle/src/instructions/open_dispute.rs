use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Vouch, VouchStatus, Dispute, DisputeStatus, ReputationConfig};

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(
        init,
        payer = challenger,
        space = Dispute::LEN,
        seeds = [b"dispute", vouch.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    #[account(
        mut,
        constraint = vouch.status == VouchStatus::Active @ ErrorCode::VouchNotActive
    )]
    pub vouch: Account<'info, Vouch>,
    
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ReputationConfig>,
    
    #[account(mut)]
    pub challenger: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<OpenDispute>,
    evidence_uri: String,
) -> Result<()> {
    require!(
        evidence_uri.len() <= Dispute::MAX_EVIDENCE_URI_LENGTH,
        ErrorCode::EvidenceUriTooLong
    );
    
    let config = &ctx.accounts.config;
    
    // Charge dispute bond (simplified - just transfer for MVP)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.dispute.to_account_info(),
            },
        ),
        config.dispute_bond,
    )?;
    
    let dispute = &mut ctx.accounts.dispute;
    let clock = Clock::get()?;
    
    dispute.vouch = ctx.accounts.vouch.key();
    dispute.challenger = ctx.accounts.challenger.key();
    dispute.evidence_uri = evidence_uri;
    dispute.status = DisputeStatus::Open;
    dispute.ruling = None;
    dispute.created_at = clock.unix_timestamp;
    dispute.resolved_at = None;
    dispute.bump = ctx.bumps.dispute;
    
    // Mark vouch as disputed
    let vouch = &mut ctx.accounts.vouch;
    vouch.status = VouchStatus::Disputed;
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Vouch is not active")]
    VouchNotActive,
    #[msg("Evidence URI is too long")]
    EvidenceUriTooLong,
}
