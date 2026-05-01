use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::events::AuthorBondDeposited;
use crate::state::{AgentProfile, AuthorBond, ReputationConfig, AUTHOR_BOND_SEED};

#[derive(Accounts)]
pub struct DepositAuthorBond<'info> {
    #[account(
        init_if_needed,
        payer = author,
        space = AuthorBond::LEN,
        seeds = [AUTHOR_BOND_SEED, author.key().as_ref()],
        bump
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

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositAuthorBond>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::AmountMustBePositive);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.author.to_account_info(),
                to: ctx.accounts.author_bond.to_account_info(),
            },
        ),
        amount,
    )?;

    let clock = Clock::get()?;
    let author_bond = &mut ctx.accounts.author_bond;
    let is_new = author_bond.is_uninitialized();

    if is_new {
        author_bond.author = ctx.accounts.author.key();
        author_bond.amount = 0;
        author_bond.created_at = clock.unix_timestamp;
        author_bond.bump = ctx.bumps.author_bond;
    }

    author_bond.amount = author_bond
        .amount
        .checked_add(amount)
        .ok_or(ErrorCode::BondAmountOverflow)?;
    author_bond.updated_at = clock.unix_timestamp;

    let author_profile = &mut ctx.accounts.author_profile;
    author_profile.author_bond_lamports = author_profile
        .author_bond_lamports
        .checked_add(amount)
        .ok_or(ErrorCode::BondAmountOverflow)?;
    author_profile.reputation_score = author_profile.compute_reputation(&ctx.accounts.config);

    emit!(AuthorBondDeposited {
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
    #[msg("Author bond amount overflowed")]
    BondAmountOverflow,
}
