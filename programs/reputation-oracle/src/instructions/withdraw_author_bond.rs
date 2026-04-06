use anchor_lang::prelude::*;

use crate::events::AuthorBondWithdrawn;
use crate::state::{AgentProfile, AuthorBond, ReputationConfig, AUTHOR_BOND_SEED};

#[derive(Accounts)]
pub struct WithdrawAuthorBond<'info> {
    #[account(
        mut,
        seeds = [AUTHOR_BOND_SEED, author.key().as_ref()],
        bump = author_bond.bump,
        constraint = author_bond.author == author.key() @ ErrorCode::AuthorBondAuthorityMismatch
    )]
    pub author_bond: Account<'info, AuthorBond>,

    #[account(
        mut,
        seeds = [b"agent", author.key().as_ref()],
        bump = author_profile.bump,
    )]
    pub author_profile: Account<'info, AgentProfile>,

    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ReputationConfig>,

    #[account(mut)]
    pub author: Signer<'info>,
}

pub fn handler(ctx: Context<WithdrawAuthorBond>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::AmountMustBePositive);

    let clock = Clock::get()?;
    let author_bond = &mut ctx.accounts.author_bond;
    let remaining_bond = author_bond
        .amount
        .checked_sub(amount)
        .ok_or(ErrorCode::InsufficientBondAmount)?;

    if ctx.accounts.author_profile.active_free_skill_listings > 0 {
        require!(
            remaining_bond >= ctx.accounts.config.min_author_bond_for_free_listing,
            ErrorCode::FreeListingsRequireBondFloor
        );
    }
    require!(
        ctx.accounts.author_profile.open_author_disputes == 0,
        ErrorCode::AuthorBondLockedWhileDisputesOpen
    );

    let minimum_rent = Rent::get()?.minimum_balance(AuthorBond::LEN);
    let remaining_lamports = author_bond
        .to_account_info()
        .lamports()
        .checked_sub(amount)
        .ok_or(ErrorCode::InsufficientLamports)?;
    require!(
        remaining_lamports >= minimum_rent,
        ErrorCode::InsufficientLamports
    );

    author_bond.amount = remaining_bond;
    author_bond.updated_at = clock.unix_timestamp;

    let author_profile = &mut ctx.accounts.author_profile;
    author_profile.author_bond_lamports = author_profile
        .author_bond_lamports
        .checked_sub(amount)
        .ok_or(ErrorCode::InsufficientBondAmount)?;
    author_profile.reputation_score = author_profile.compute_reputation(&ctx.accounts.config);

    **author_bond.to_account_info().try_borrow_mut_lamports()? = remaining_lamports;
    **ctx.accounts.author.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts
        .author
        .to_account_info()
        .lamports()
        .checked_add(amount)
        .ok_or(ErrorCode::LamportOverflow)?;

    emit!(AuthorBondWithdrawn {
        author_bond: author_bond.key(),
        author: ctx.accounts.author.key(),
        amount,
        total_bond_amount: author_bond.amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    AmountMustBePositive,
    #[msg("Author bond authority mismatch")]
    AuthorBondAuthorityMismatch,
    #[msg("Author bond amount is insufficient for this withdrawal")]
    InsufficientBondAmount,
    #[msg("Active free listings require the configured minimum author bond")]
    FreeListingsRequireBondFloor,
    #[msg("Author bond cannot be withdrawn while author disputes are open")]
    AuthorBondLockedWhileDisputesOpen,
    #[msg("Author bond account does not have enough lamports for this withdrawal")]
    InsufficientLamports,
    #[msg("Lamport amount overflowed")]
    LamportOverflow,
}
