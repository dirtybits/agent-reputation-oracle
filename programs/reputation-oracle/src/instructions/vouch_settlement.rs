use anchor_lang::prelude::*;

use crate::state::{AgentProfile, ReputationConfig, Vouch, VouchStatus};

pub(crate) fn slash_vouch<'info>(
    vouch: &mut Account<'info, Vouch>,
    voucher_profile: &mut Account<'info, AgentProfile>,
    vouchee_profile: &mut Account<'info, AgentProfile>,
    config: &Account<'info, ReputationConfig>,
) -> Result<u64> {
    let slash_amount = vouch
        .stake_amount
        .saturating_mul(config.slash_percentage as u64)
        .saturating_div(100);

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

#[error_code]
pub enum VouchSettlementError {
    #[msg("Insufficient funds")]
    InsufficientFunds,
}
