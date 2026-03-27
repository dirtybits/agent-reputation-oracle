use anchor_lang::prelude::*;
use std::collections::BTreeSet;

use crate::events::AuthorDisputeResolved as AuthorDisputeResolvedEvent;
use crate::instructions::vouch_settlement::slash_vouch;
use crate::state::{
    AgentProfile, AuthorDispute, AuthorDisputeRuling, AuthorDisputeStatus,
    AuthorDisputeVouchLink, ReputationConfig, Vouch,
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
        mut,
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

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, ResolveAuthorDispute<'info>>,
    _dispute_id: u64,
    ruling: AuthorDisputeRuling,
) -> Result<()> {
    let clock = Clock::get()?;
    let author_dispute_key = ctx.accounts.author_dispute.key();
    let linked_vouch_count = ctx.accounts.author_dispute.linked_vouch_count;
    let backing_vouch_count_snapshot = ctx.accounts.author_dispute.backing_vouch_count_snapshot;
    let bond_amount = ctx.accounts.author_dispute.bond_amount;
    require!(
        linked_vouch_count == backing_vouch_count_snapshot,
        ErrorCode::IncompleteBackingSnapshot
    );

    let total_slashed_amount = match ruling {
        AuthorDisputeRuling::Upheld => settle_backing_vouches(
            ctx.remaining_accounts,
            ctx.program_id,
            author_dispute_key,
            backing_vouch_count_snapshot,
            &mut ctx.accounts.author_profile,
            &ctx.accounts.config,
        )?,
        AuthorDisputeRuling::Dismissed => 0,
    };

    let author_dispute = &mut ctx.accounts.author_dispute;
    author_dispute.status = AuthorDisputeStatus::Resolved;
    author_dispute.ruling = Some(ruling);
    author_dispute.resolved_at = Some(clock.unix_timestamp);

    match ruling {
        AuthorDisputeRuling::Upheld => {
            let total_payout = bond_amount
                .checked_add(total_slashed_amount)
                .ok_or(ErrorCode::SlashAmountOverflow)?;
            **author_dispute.to_account_info().try_borrow_mut_lamports()? = author_dispute
                .to_account_info()
                .lamports()
                .checked_sub(bond_amount)
                .ok_or(ErrorCode::InsufficientFunds)?;

            **ctx.accounts.challenger.try_borrow_mut_lamports()? = ctx
                .accounts
                .challenger
                .lamports()
                .checked_add(total_payout)
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
        slashed_amount: total_slashed_amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

fn settle_backing_vouches<'info>(
    remaining_accounts: &'info [AccountInfo<'info>],
    program_id: &Pubkey,
    author_dispute_key: Pubkey,
    expected_backing_vouch_count: u32,
    author_profile: &mut Account<'info, AgentProfile>,
    config: &Account<'info, ReputationConfig>,
) -> Result<u64> {
    let expected_account_count = expected_backing_vouch_count
        .checked_mul(3)
        .ok_or(ErrorCode::BackingVouchCountOverflow)? as usize;
    require!(
        remaining_accounts.len() == expected_account_count,
        ErrorCode::InvalidSettlementAccounts
    );

    let mut unique_vouches = BTreeSet::new();
    let mut settled_vouch_count = 0u32;
    let mut total_slashed_amount = 0u64;
    let author_profile_key = author_profile.key();

    for account_triple in remaining_accounts.chunks_exact(3) {
        let link = Account::<AuthorDisputeVouchLink>::try_from(&account_triple[0])?;
        let mut vouch = Account::<Vouch>::try_from(&account_triple[1])?;
        let mut voucher_profile = Account::<AgentProfile>::try_from(&account_triple[2])?;

        require_keys_eq!(
            link.author_dispute,
            author_dispute_key,
            ErrorCode::AuthorDisputeVouchLinkMismatch
        );
        require_keys_eq!(
            link.vouch,
            vouch.key(),
            ErrorCode::AuthorDisputeSettlementVouchMismatch
        );
        require!(
            unique_vouches.insert(vouch.key()),
            ErrorCode::DuplicateSettlementBackingVouch
        );
        require_keys_eq!(
            vouch.vouchee,
            author_profile_key,
            ErrorCode::BackingVouchAuthorMismatch
        );
        require_keys_eq!(
            vouch.voucher,
            voucher_profile.key(),
            ErrorCode::BackingVouchVoucherMismatch
        );
        require!(
            vouch.status.counts_toward_author_wide_backing_snapshot(),
            ErrorCode::BackingVouchNotSlashable
        );

        total_slashed_amount = total_slashed_amount
            .checked_add(slash_vouch(
                &mut vouch,
                &mut voucher_profile,
                author_profile,
                config,
            )?)
            .ok_or(ErrorCode::SlashAmountOverflow)?;
        vouch.exit(program_id)?;
        voucher_profile.exit(program_id)?;
        settled_vouch_count = settled_vouch_count
            .checked_add(1)
            .ok_or(ErrorCode::BackingVouchCountOverflow)?;
    }

    require!(
        settled_vouch_count == expected_backing_vouch_count,
        ErrorCode::InvalidSettlementAccounts
    );

    Ok(total_slashed_amount)
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
    #[msg("Author dispute uphold must include every snapshotted backing vouch account triple")]
    InvalidSettlementAccounts,
    #[msg("Duplicate backing vouches are not allowed during settlement")]
    DuplicateSettlementBackingVouch,
    #[msg("Settlement link does not match this author dispute")]
    AuthorDisputeVouchLinkMismatch,
    #[msg("Settlement vouch does not match the recorded author dispute link")]
    AuthorDisputeSettlementVouchMismatch,
    #[msg("Backing vouch does not belong to the disputed author")]
    BackingVouchAuthorMismatch,
    #[msg("Backing vouch voucher profile does not match the recorded voucher")]
    BackingVouchVoucherMismatch,
    #[msg("Backing vouch can no longer be slashed through this author dispute")]
    BackingVouchNotSlashable,
    #[msg("Backing vouch count overflow")]
    BackingVouchCountOverflow,
    #[msg("Slash amount overflow")]
    SlashAmountOverflow,
}
