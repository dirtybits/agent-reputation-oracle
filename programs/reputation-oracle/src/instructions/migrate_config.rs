use anchor_lang::prelude::*;
use anchor_lang::system_program;
use std::convert::TryInto;

use crate::state::ReputationConfig;

const LEGACY_REPUTATION_CONFIG_LEN: usize = 82;

#[derive(Clone, Copy)]
struct ParsedReputationConfig {
    authority: Pubkey,
    min_stake: u64,
    dispute_bond: u64,
    min_author_bond_for_free_listing: u64,
    slash_percentage: u8,
    cooldown_period: i64,
    stake_weight: u32,
    vouch_weight: u32,
    longevity_bonus: u32,
    bump: u8,
}

fn read_pubkey(raw: &[u8], start: usize) -> Result<Pubkey> {
    let bytes: [u8; 32] = raw
        .get(start..start + 32)
        .ok_or(error!(MigrateConfigError::InvalidConfigLayout))?
        .try_into()
        .map_err(|_| error!(MigrateConfigError::InvalidConfigLayout))?;
    Ok(Pubkey::new_from_array(bytes))
}

fn read_u64(raw: &[u8], start: usize) -> Result<u64> {
    let bytes: [u8; 8] = raw
        .get(start..start + 8)
        .ok_or(error!(MigrateConfigError::InvalidConfigLayout))?
        .try_into()
        .map_err(|_| error!(MigrateConfigError::InvalidConfigLayout))?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_i64(raw: &[u8], start: usize) -> Result<i64> {
    let bytes: [u8; 8] = raw
        .get(start..start + 8)
        .ok_or(error!(MigrateConfigError::InvalidConfigLayout))?
        .try_into()
        .map_err(|_| error!(MigrateConfigError::InvalidConfigLayout))?;
    Ok(i64::from_le_bytes(bytes))
}

fn read_u32(raw: &[u8], start: usize) -> Result<u32> {
    let bytes: [u8; 4] = raw
        .get(start..start + 4)
        .ok_or(error!(MigrateConfigError::InvalidConfigLayout))?
        .try_into()
        .map_err(|_| error!(MigrateConfigError::InvalidConfigLayout))?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_u8(raw: &[u8], start: usize) -> Result<u8> {
    raw.get(start)
        .copied()
        .ok_or(error!(MigrateConfigError::InvalidConfigLayout))
}

fn parse_legacy_config(raw: &[u8], canonical_bump: u8) -> Result<ParsedReputationConfig> {
    let dispute_bond = read_u64(raw, 48)?;
    let dispute_penalty = read_u32(raw, 73)?;
    msg!(
        "Migrating legacy config layout; carrying forward values and replacing legacy dispute_penalty={} with min_author_bond_for_free_listing={}",
        dispute_penalty,
        dispute_bond
    );

    Ok(ParsedReputationConfig {
        authority: read_pubkey(raw, 8)?,
        min_stake: read_u64(raw, 40)?,
        dispute_bond,
        min_author_bond_for_free_listing: dispute_bond,
        slash_percentage: read_u8(raw, 56)?,
        cooldown_period: read_i64(raw, 57)?,
        stake_weight: read_u32(raw, 65)?,
        vouch_weight: read_u32(raw, 69)?,
        longevity_bonus: read_u32(raw, 77)?,
        bump: canonical_bump,
    })
}

fn parse_current_config(raw: &[u8], canonical_bump: u8) -> Result<ParsedReputationConfig> {
    Ok(ParsedReputationConfig {
        authority: read_pubkey(raw, 8)?,
        min_stake: read_u64(raw, 40)?,
        dispute_bond: read_u64(raw, 48)?,
        min_author_bond_for_free_listing: read_u64(raw, 56)?,
        slash_percentage: read_u8(raw, 64)?,
        cooldown_period: read_i64(raw, 65)?,
        stake_weight: read_u32(raw, 73)?,
        vouch_weight: read_u32(raw, 77)?,
        longevity_bonus: read_u32(raw, 81)?,
        bump: canonical_bump,
    })
}

#[derive(Accounts)]
pub struct MigrateConfig<'info> {
    /// CHECK: The config account may still use a legacy layout and cannot be
    /// deserialized as `Account<ReputationConfig>` yet. Seeds and ownership are
    /// validated here, then the account is rewritten manually.
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        owner = crate::ID,
    )]
    pub config: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MigrateConfig>) -> Result<()> {
    let canonical_bump = ctx.bumps.config;
    let config_info = &ctx.accounts.config;
    let authority_key = ctx.accounts.authority.key();
    let current_len = config_info.data_len();

    require!(
        current_len == LEGACY_REPUTATION_CONFIG_LEN || current_len == ReputationConfig::LEN,
        MigrateConfigError::UnsupportedConfigLayout
    );

    let raw = config_info.try_borrow_data()?.to_vec();
    require!(
        raw.starts_with(&ReputationConfig::DISCRIMINATOR),
        MigrateConfigError::InvalidConfigDiscriminator
    );

    let stored_authority = read_pubkey(&raw, 8)?;
    require!(
        stored_authority == authority_key,
        MigrateConfigError::UnauthorizedConfigAuthority
    );

    let parsed = if current_len == LEGACY_REPUTATION_CONFIG_LEN {
        parse_legacy_config(&raw, canonical_bump)?
    } else {
        parse_current_config(&raw, canonical_bump)?
    };

    if current_len != ReputationConfig::LEN {
        config_info.resize(ReputationConfig::LEN)?;

        let rent = Rent::get()?;
        let target_rent = rent.minimum_balance(ReputationConfig::LEN);
        let current_lamports = config_info.lamports();

        if target_rent > current_lamports {
            let diff = target_rent - current_lamports;
            let cpi = system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: config_info.to_account_info(),
            };
            system_program::transfer(
                CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi),
                diff,
            )?;
        } else if current_lamports > target_rent {
            let diff = current_lamports - target_rent;
            **config_info.try_borrow_mut_lamports()? -= diff;
            **ctx.accounts.authority.try_borrow_mut_lamports()? += diff;
        }
    }

    let next = ReputationConfig {
        authority: parsed.authority,
        min_stake: parsed.min_stake,
        dispute_bond: parsed.dispute_bond,
        min_author_bond_for_free_listing: parsed.min_author_bond_for_free_listing,
        slash_percentage: parsed.slash_percentage,
        cooldown_period: parsed.cooldown_period,
        stake_weight: parsed.stake_weight,
        vouch_weight: parsed.vouch_weight,
        longevity_bonus: parsed.longevity_bonus,
        bump: parsed.bump,
    };

    let mut data = config_info.try_borrow_mut_data()?;
    data[..8].copy_from_slice(&ReputationConfig::DISCRIMINATOR);
    let mut writer = &mut data[8..];
    AnchorSerialize::serialize(&next, &mut writer)?;

    Ok(())
}

#[error_code]
pub enum MigrateConfigError {
    #[msg("Only the current config authority can migrate the config account")]
    UnauthorizedConfigAuthority,
    #[msg("The config PDA uses an unsupported account layout")]
    UnsupportedConfigLayout,
    #[msg("The config PDA does not contain the ReputationConfig discriminator")]
    InvalidConfigDiscriminator,
    #[msg("The config PDA data could not be parsed")]
    InvalidConfigLayout,
}
