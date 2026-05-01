use anchor_lang::prelude::*;

use crate::state::{AgentProfile, AuthorBond, ReputationConfig, Vouch, VouchStatus};

pub(crate) fn compute_slash_amount(stake_amount: u64, slash_percentage: u8) -> u64 {
    stake_amount
        .saturating_mul(slash_percentage as u64)
        .saturating_div(100)
}

pub(crate) fn slash_vouch_with_amount<'info>(
    vouch: &mut Account<'info, Vouch>,
    voucher_profile: &mut Account<'info, AgentProfile>,
    vouchee_profile: &mut Account<'info, AgentProfile>,
    config: &Account<'info, ReputationConfig>,
    slash_amount: u64,
) -> Result<u64> {
    require!(
        slash_amount <= vouch.stake_amount,
        VouchSettlementError::InvalidSlashAmount
    );

    vouch.status = VouchStatus::Slashed;

    voucher_profile.total_vouches_given = voucher_profile.total_vouches_given.saturating_sub(1);
    voucher_profile.reputation_score = voucher_profile.compute_reputation(config);

    vouchee_profile.total_vouches_received = vouchee_profile.total_vouches_received.saturating_sub(1);
    vouchee_profile.total_staked_for =
        vouchee_profile.total_staked_for.saturating_sub(vouch.stake_amount);
    vouchee_profile.reputation_score = vouchee_profile.compute_reputation(config);

    **vouch.to_account_info().try_borrow_mut_lamports()? = vouch
        .to_account_info()
        .lamports()
        .checked_sub(slash_amount)
        .ok_or(VouchSettlementError::InsufficientFunds)?;

    Ok(slash_amount)
}

pub(crate) fn slash_author_bond<'info>(
    author_bond: &mut Account<'info, AuthorBond>,
    author_profile: &mut Account<'info, AgentProfile>,
    config: &Account<'info, ReputationConfig>,
    slash_amount: u64,
) -> Result<u64> {
    require!(
        slash_amount <= author_bond.amount,
        VouchSettlementError::InvalidSlashAmount
    );

    author_bond.amount = author_bond
        .amount
        .checked_sub(slash_amount)
        .ok_or(VouchSettlementError::InsufficientBondAmount)?;
    author_bond.updated_at = Clock::get()?.unix_timestamp;

    author_profile.author_bond_lamports = author_profile
        .author_bond_lamports
        .checked_sub(slash_amount)
        .ok_or(VouchSettlementError::InsufficientBondAmount)?;
    author_profile.reputation_score = author_profile.compute_reputation(config);

    **author_bond.to_account_info().try_borrow_mut_lamports()? = author_bond
        .to_account_info()
        .lamports()
        .checked_sub(slash_amount)
        .ok_or(VouchSettlementError::InsufficientFunds)?;

    Ok(slash_amount)
}

#[error_code]
pub enum VouchSettlementError {
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Bond amount is lower than the requested slash amount")]
    InsufficientBondAmount,
    #[msg("Slash amount exceeds the supported amount for this account")]
    InvalidSlashAmount,
}
