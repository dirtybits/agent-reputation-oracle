use anchor_lang::prelude::*;
use std::collections::BTreeSet;

use crate::events::AuthorBondSlashed as AuthorBondSlashedEvent;
use crate::events::AuthorDisputeResolved as AuthorDisputeResolvedEvent;
use crate::instructions::vouch_settlement::{
    compute_slash_amount, slash_author_bond, slash_vouch_with_amount,
};
use crate::state::{
    find_author_bond_pda, AgentProfile, AuthorBond, AuthorDispute,
    AuthorDisputeLiabilityScope, AuthorDisputeRuling, AuthorDisputeStatus,
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

    #[account(mut)]
    pub author_bond: Option<Account<'info, AuthorBond>>,

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
    let author_key = ctx.accounts.author_profile.authority;
    let liability_scope = ctx.accounts.author_dispute.liability_scope;
    let linked_vouch_count = ctx.accounts.author_dispute.linked_vouch_count;
    let backing_vouch_count_snapshot = ctx.accounts.author_dispute.backing_vouch_count_snapshot;
    let bond_amount = ctx.accounts.author_dispute.bond_amount;
    require!(
        linked_vouch_count == backing_vouch_count_snapshot,
        ErrorCode::IncompleteBackingSnapshot
    );

    let settlement_totals = match ruling {
        AuthorDisputeRuling::Upheld => settle_author_liability(
            ctx.remaining_accounts,
            ctx.program_id,
            author_dispute_key,
            author_key,
            backing_vouch_count_snapshot,
            &mut ctx.accounts.author_profile,
            &ctx.accounts.config,
            &mut ctx.accounts.author_bond,
            liability_scope,
        )?,
        AuthorDisputeRuling::Dismissed => SettlementTotals::default(),
    };
    let total_slashed_amount = settlement_totals.total_slashed_amount()?;

    let author_dispute = &mut ctx.accounts.author_dispute;
    author_dispute.status = AuthorDisputeStatus::Resolved;
    author_dispute.ruling = Some(ruling);
    author_dispute.resolved_at = Some(clock.unix_timestamp);
    ctx.accounts.author_profile.open_author_disputes = ctx
        .accounts
        .author_profile
        .open_author_disputes
        .checked_sub(1)
        .ok_or(ErrorCode::OpenAuthorDisputeCountUnderflow)?;

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
        liability_scope: liability_scope_label(liability_scope).to_string(),
        linked_vouch_count: author_dispute.linked_vouch_count,
        author_bond_slashed_amount: settlement_totals.author_bond_slashed_amount,
        voucher_slashed_amount: settlement_totals.voucher_slashed_amount,
        slashed_amount: total_slashed_amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Default)]
struct SettlementTotals {
    author_bond_slashed_amount: u64,
    voucher_slashed_amount: u64,
}

impl SettlementTotals {
    fn total_slashed_amount(&self) -> Result<u64> {
        self.author_bond_slashed_amount
            .checked_add(self.voucher_slashed_amount)
            .ok_or(ErrorCode::SlashAmountOverflow.into())
    }
}

fn settle_author_liability<'info>(
    remaining_accounts: &'info [AccountInfo<'info>],
    program_id: &Pubkey,
    author_dispute_key: Pubkey,
    author_key: Pubkey,
    expected_backing_vouch_count: u32,
    author_profile: &mut Account<'info, AgentProfile>,
    config: &Account<'info, ReputationConfig>,
    author_bond: &mut Option<Account<'info, AuthorBond>>,
    liability_scope: AuthorDisputeLiabilityScope,
) -> Result<SettlementTotals> {
    validate_author_bond(
        author_bond.as_ref(),
        program_id,
        &author_key,
        author_profile.author_bond_lamports,
    )?;
    let author_bond_amount = author_bond.as_ref().map(|bond| bond.amount).unwrap_or(0);
    let desired_total_slash = match liability_scope {
        AuthorDisputeLiabilityScope::AuthorBondOnly => {
            require!(
                remaining_accounts.is_empty(),
                ErrorCode::BondOnlyDisputeMustNotProvideSettlementAccounts
            );
            compute_slash_amount(author_bond_amount, config.slash_percentage)
        }
        AuthorDisputeLiabilityScope::AuthorBondThenVouchers => {
            let backing_summary = summarize_backing_vouches(
                remaining_accounts,
                author_dispute_key,
                expected_backing_vouch_count,
                author_profile.key(),
                config,
            )?;
            let total_stake_at_risk = author_bond_amount
                .checked_add(backing_summary.total_backing_stake)
                .ok_or(ErrorCode::SlashAmountOverflow)?;
            compute_slash_amount(total_stake_at_risk, config.slash_percentage)
        }
    };

    let author_bond_slashed_amount = if let Some(author_bond) = author_bond.as_mut() {
        let slash_amount = desired_total_slash.min(author_bond.amount);
        let slashed_amount = slash_author_bond(author_bond, author_profile, config, slash_amount)?;

        if slashed_amount > 0 {
            emit!(AuthorBondSlashedEvent {
                author_bond: author_bond.key(),
                author: author_key,
                amount: slashed_amount,
                remaining_bond_amount: author_bond.amount,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        slashed_amount
    } else {
        0
    };

    let voucher_slashed_amount = match liability_scope {
        AuthorDisputeLiabilityScope::AuthorBondOnly => 0,
        AuthorDisputeLiabilityScope::AuthorBondThenVouchers => {
            let backing_summary = summarize_backing_vouches(
                remaining_accounts,
                author_dispute_key,
                expected_backing_vouch_count,
                author_profile.key(),
                config,
            )?;
            let remaining_voucher_liability =
                desired_total_slash.saturating_sub(author_bond_slashed_amount);
            settle_backing_vouches(
                remaining_accounts,
                program_id,
                author_dispute_key,
                expected_backing_vouch_count,
                author_profile,
                config,
                remaining_voucher_liability,
                backing_summary.full_backing_slash_amount,
            )?
        }
    };

    Ok(SettlementTotals {
        author_bond_slashed_amount,
        voucher_slashed_amount,
    })
}

fn validate_author_bond(
    author_bond_account: Option<&Account<AuthorBond>>,
    program_id: &Pubkey,
    author_key: &Pubkey,
    author_bond_lamports_on_profile: u64,
) -> Result<()> {
    if author_bond_lamports_on_profile == 0 {
        return Ok(());
    }

    let author_bond_account =
        author_bond_account.ok_or(ErrorCode::MissingAuthorBondForSettlement)?;
    let (expected_author_bond, _) = find_author_bond_pda(author_key, program_id);
    require_keys_eq!(
        author_bond_account.key(),
        expected_author_bond,
        ErrorCode::AuthorBondAccountMismatch
    );

    require_keys_eq!(
        author_bond_account.author,
        *author_key,
        ErrorCode::AuthorBondAccountMismatch
    );
    require!(
        author_bond_account.amount == author_bond_lamports_on_profile,
        ErrorCode::AuthorBondProfileMismatch
    );

    Ok(())
}

struct BackingVouchSummary {
    total_backing_stake: u64,
    full_backing_slash_amount: u64,
}

fn summarize_backing_vouches<'info>(
    remaining_accounts: &'info [AccountInfo<'info>],
    author_dispute_key: Pubkey,
    expected_backing_vouch_count: u32,
    author_profile_key: Pubkey,
    config: &Account<'info, ReputationConfig>,
) -> Result<BackingVouchSummary> {
    let expected_account_count = expected_backing_vouch_count
        .checked_mul(3)
        .ok_or(ErrorCode::BackingVouchCountOverflow)? as usize;
    require!(
        remaining_accounts.len() == expected_account_count,
        ErrorCode::InvalidSettlementAccounts
    );

    let mut unique_vouches = BTreeSet::new();
    let mut total_backing_stake = 0u64;
    let mut full_backing_slash_amount = 0u64;
    let mut settled_vouch_count = 0u32;

    for account_triple in remaining_accounts.chunks_exact(3) {
        let link = Account::<AuthorDisputeVouchLink>::try_from(&account_triple[0])?;
        let vouch = Account::<Vouch>::try_from(&account_triple[1])?;
        let voucher_profile = Account::<AgentProfile>::try_from(&account_triple[2])?;

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

        total_backing_stake = total_backing_stake
            .checked_add(vouch.stake_amount)
            .ok_or(ErrorCode::SlashAmountOverflow)?;
        full_backing_slash_amount = full_backing_slash_amount
            .checked_add(compute_slash_amount(
                vouch.stake_amount,
                config.slash_percentage,
            ))
            .ok_or(ErrorCode::SlashAmountOverflow)?;
        settled_vouch_count = settled_vouch_count
            .checked_add(1)
            .ok_or(ErrorCode::BackingVouchCountOverflow)?;
    }

    require!(
        settled_vouch_count == expected_backing_vouch_count,
        ErrorCode::InvalidSettlementAccounts
    );

    Ok(BackingVouchSummary {
        total_backing_stake,
        full_backing_slash_amount,
    })
}

fn settle_backing_vouches<'info>(
    remaining_accounts: &'info [AccountInfo<'info>],
    program_id: &Pubkey,
    author_dispute_key: Pubkey,
    expected_backing_vouch_count: u32,
    author_profile: &mut Account<'info, AgentProfile>,
    config: &Account<'info, ReputationConfig>,
    remaining_voucher_liability: u64,
    full_backing_slash_amount: u64,
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
    let mut remaining_liability = remaining_voucher_liability;
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

        let full_vouch_slash_amount = compute_slash_amount(vouch.stake_amount, config.slash_percentage);
        let is_last_vouch = settled_vouch_count + 1 == expected_backing_vouch_count;
        let actual_slash_amount = if full_backing_slash_amount == 0 {
            0
        } else if is_last_vouch {
            remaining_liability
        } else {
            ((full_vouch_slash_amount as u128)
                .checked_mul(remaining_voucher_liability as u128)
                .ok_or(ErrorCode::SlashAmountOverflow)?
                .checked_div(full_backing_slash_amount as u128)
                .ok_or(ErrorCode::SlashAmountOverflow)?) as u64
        };
        let slashed_amount = slash_vouch_with_amount(
            &mut vouch,
            &mut voucher_profile,
            author_profile,
            config,
            actual_slash_amount,
        )?;

        remaining_liability = remaining_liability.saturating_sub(slashed_amount);
        total_slashed_amount = total_slashed_amount
            .checked_add(slashed_amount)
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
    require!(remaining_liability == 0, ErrorCode::InvalidSettlementAmounts);

    Ok(total_slashed_amount)
}

fn ruling_label(ruling: AuthorDisputeRuling) -> &'static str {
    match ruling {
        AuthorDisputeRuling::Upheld => "Upheld",
        AuthorDisputeRuling::Dismissed => "Dismissed",
    }
}

fn liability_scope_label(liability_scope: AuthorDisputeLiabilityScope) -> &'static str {
    match liability_scope {
        AuthorDisputeLiabilityScope::AuthorBondOnly => "AuthorBondOnly",
        AuthorDisputeLiabilityScope::AuthorBondThenVouchers => "AuthorBondThenVouchers",
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
    #[msg("Resolver must provide the author's bond account when bond capital exists")]
    MissingAuthorBondForSettlement,
    #[msg("Author bond PDA does not match the expected author")]
    AuthorBondAccountMismatch,
    #[msg("Author bond account does not match the author profile totals")]
    AuthorBondProfileMismatch,
    #[msg("Resolved voucher slash amounts did not match the expected liability")]
    InvalidSettlementAmounts,
    #[msg("Bond-only disputes must not include voucher settlement accounts")]
    BondOnlyDisputeMustNotProvideSettlementAccounts,
    #[msg("Open author dispute count underflowed")]
    OpenAuthorDisputeCountUnderflow,
}
