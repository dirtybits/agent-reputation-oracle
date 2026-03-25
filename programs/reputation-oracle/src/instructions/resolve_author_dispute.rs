use anchor_lang::prelude::*;

use crate::events::AuthorDisputeResolved as AuthorDisputeResolvedEvent;
use crate::state::{
    AgentProfile, AuthorDispute, AuthorDisputeRuling, AuthorDisputeStatus, ReputationConfig,
};

#[derive(Accounts)]
#[instruction(dispute_id: u64)]
pub struct ResolveAuthorDispute<'info> {
    #[account(
        mut,
        seeds = [b"author_dispute", author_profile.authority.as_ref(), &dispute_id.to_le_bytes()],
        bump = author_dispute.bump,
        constraint = author_dispute.status == AuthorDisputeStatus::Open @ ErrorCode::AuthorDisputeNotOpen,
        constraint = author_dispute.author == author_profile.authority @ ErrorCode::AuthorMismatch,
    )]
    pub author_dispute: Account<'info, AuthorDispute>,

    #[account(
        seeds = [b"agent", author_profile.authority.as_ref()],
        bump = author_profile.bump
    )]
    pub author_profile: Account<'info, AgentProfile>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::UnauthorizedResolver
    )]
    pub config: Account<'info, ReputationConfig>,

    pub authority: Signer<'info>,

    /// CHECK: This account is validated against the stored challenger pubkey.
    #[account(mut, address = author_dispute.challenger @ ErrorCode::ChallengerMismatch)]
    pub challenger: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<ResolveAuthorDispute>,
    _dispute_id: u64,
    ruling: AuthorDisputeRuling,
) -> Result<()> {
    let clock = Clock::get()?;

    let author_dispute = &mut ctx.accounts.author_dispute;
    require!(
        author_dispute.linked_vouch_count == author_dispute.backing_vouch_count_snapshot,
        ErrorCode::IncompleteBackingSnapshot
    );
    author_dispute.status = AuthorDisputeStatus::Resolved;
    author_dispute.ruling = Some(ruling);
    author_dispute.resolved_at = Some(clock.unix_timestamp);

    let bond_amount = author_dispute.bond_amount;
    match ruling {
        AuthorDisputeRuling::Upheld => {
            **author_dispute.to_account_info().try_borrow_mut_lamports()? = author_dispute
                .to_account_info()
                .lamports()
                .checked_sub(bond_amount)
                .ok_or(ErrorCode::InsufficientFunds)?;

            **ctx.accounts.challenger.try_borrow_mut_lamports()? = ctx
                .accounts
                .challenger
                .lamports()
                .checked_add(bond_amount)
                .ok_or(ErrorCode::InsufficientFunds)?;
        }
        AuthorDisputeRuling::Dismissed => {
            **author_dispute.to_account_info().try_borrow_mut_lamports()? = author_dispute
                .to_account_info()
                .lamports()
                .checked_sub(bond_amount)
                .ok_or(ErrorCode::InsufficientFunds)?;

            **ctx.accounts.config.to_account_info().try_borrow_mut_lamports()? = ctx
                .accounts
                .config
                .to_account_info()
                .lamports()
                .checked_add(bond_amount)
                .ok_or(ErrorCode::InsufficientFunds)?;
        }
    }

    emit!(AuthorDisputeResolvedEvent {
        author_dispute: author_dispute.key(),
        author: author_dispute.author,
        ruling: ruling_label(ruling).to_string(),
        linked_vouch_count: author_dispute.linked_vouch_count,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

fn ruling_label(ruling: AuthorDisputeRuling) -> &'static str {
    match ruling {
        AuthorDisputeRuling::Upheld => "Upheld",
        AuthorDisputeRuling::Dismissed => "Dismissed",
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Author dispute is not open")]
    AuthorDisputeNotOpen,
    #[msg("The disputed author does not match this author dispute")]
    AuthorMismatch,
    #[msg("Only the configured authority can resolve author disputes")]
    UnauthorizedResolver,
    #[msg("Challenger account mismatch")]
    ChallengerMismatch,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Author dispute cannot resolve without its full author-wide backing snapshot")]
    IncompleteBackingSnapshot,
}
