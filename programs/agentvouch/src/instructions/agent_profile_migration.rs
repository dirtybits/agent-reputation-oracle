use std::convert::TryInto;

use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::AgentProfile;

pub(crate) const MIN_PLAUSIBLE_REGISTERED_AT: i64 = 946_684_800; // 2000-01-01T00:00:00Z
pub(crate) const MAX_FUTURE_SKEW_SECONDS: i64 = 366 * 24 * 60 * 60;
const LEGACY_AGENT_PROFILE_TRAILING_LEN: usize = 41;

#[derive(Clone)]
pub(crate) struct ParsedAgentProfile {
    pub authority: Pubkey,
    pub metadata_uri: String,
    pub reputation_score: u64,
    pub total_vouches_received: u32,
    pub total_vouches_given: u32,
    pub total_staked_for: u64,
    pub author_bond_lamports: u64,
    pub active_free_skill_listings: u32,
    pub open_author_disputes: u32,
    pub registered_at: i64,
}

pub(crate) fn is_plausible_registered_at(timestamp: i64, now: i64) -> bool {
    timestamp >= MIN_PLAUSIBLE_REGISTERED_AT
        && timestamp <= now.saturating_add(MAX_FUTURE_SKEW_SECONDS)
}

fn read_pubkey(raw: &[u8], start: usize) -> Result<Pubkey> {
    let bytes: [u8; 32] = raw
        .get(start..start + 32)
        .ok_or(error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?
        .try_into()
        .map_err(|_| error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?;
    Ok(Pubkey::new_from_array(bytes))
}

fn read_u64(raw: &[u8], start: usize) -> Result<u64> {
    let bytes: [u8; 8] = raw
        .get(start..start + 8)
        .ok_or(error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?
        .try_into()
        .map_err(|_| error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_i64(raw: &[u8], start: usize) -> Result<i64> {
    let bytes: [u8; 8] = raw
        .get(start..start + 8)
        .ok_or(error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?
        .try_into()
        .map_err(|_| error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?;
    Ok(i64::from_le_bytes(bytes))
}

fn read_u32(raw: &[u8], start: usize) -> Result<u32> {
    let bytes: [u8; 4] = raw
        .get(start..start + 4)
        .ok_or(error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?
        .try_into()
        .map_err(|_| error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_metadata_uri(raw: &[u8]) -> Result<(String, usize)> {
    let uri_len = read_u32(raw, 40)? as usize;
    require!(
        uri_len <= AgentProfile::MAX_URI_LENGTH,
        AgentProfileMigrationError::MetadataUriTooLong
    );

    let start = 44;
    let end = start + uri_len;
    let bytes = raw
        .get(start..end)
        .ok_or(error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?;
    let metadata_uri = String::from_utf8(bytes.to_vec())
        .map_err(|_| error!(AgentProfileMigrationError::InvalidMetadataUriEncoding))?;

    Ok((metadata_uri, end))
}

fn parse_current_agent_profile(raw: &[u8], now: i64) -> Result<ParsedAgentProfile> {
    let mut slice = raw;
    let profile = AgentProfile::try_deserialize(&mut slice)
        .map_err(|_| error!(AgentProfileMigrationError::InvalidAgentProfileLayout))?;
    let registered_at = if is_plausible_registered_at(profile.registered_at, now) {
        profile.registered_at
    } else {
        now
    };

    Ok(ParsedAgentProfile {
        authority: profile.authority,
        metadata_uri: profile.metadata_uri,
        reputation_score: profile.reputation_score,
        total_vouches_received: profile.total_vouches_received,
        total_vouches_given: profile.total_vouches_given,
        total_staked_for: profile.total_staked_for,
        author_bond_lamports: profile.author_bond_lamports,
        active_free_skill_listings: profile.active_free_skill_listings,
        open_author_disputes: profile.open_author_disputes,
        registered_at,
    })
}

fn parse_legacy_agent_profile(raw: &[u8], now: i64) -> Result<ParsedAgentProfile> {
    require!(
        raw.len() >= 8 + 32 + 4 + LEGACY_AGENT_PROFILE_TRAILING_LEN,
        AgentProfileMigrationError::InvalidAgentProfileLayout
    );

    let authority = read_pubkey(raw, 8)?;
    let (metadata_uri, base) = read_metadata_uri(raw)?;
    require!(
        raw.len() >= base + LEGACY_AGENT_PROFILE_TRAILING_LEN,
        AgentProfileMigrationError::InvalidAgentProfileLayout
    );

    let reputation_score = read_u64(raw, base)?;
    let total_vouches_received = read_u32(raw, base + 8)?;
    let total_vouches_given = read_u32(raw, base + 12)?;
    let total_staked_for = read_u64(raw, base + 16)?;
    let candidate_registered_at = read_i64(raw, base + 24)?;
    let legacy_registered_at = read_i64(raw, base + 32)?;
    let registered_at = if is_plausible_registered_at(candidate_registered_at, now) {
        candidate_registered_at
    } else if is_plausible_registered_at(legacy_registered_at, now) {
        legacy_registered_at
    } else {
        now
    };

    Ok(ParsedAgentProfile {
        authority,
        metadata_uri,
        reputation_score,
        total_vouches_received,
        total_vouches_given,
        total_staked_for,
        author_bond_lamports: 0,
        active_free_skill_listings: 0,
        open_author_disputes: 0,
        registered_at,
    })
}

pub(crate) fn parse_agent_profile_for_migration(raw: &[u8]) -> Result<ParsedAgentProfile> {
    require!(
        raw.starts_with(&AgentProfile::DISCRIMINATOR),
        AgentProfileMigrationError::InvalidAgentProfileDiscriminator
    );

    let now = Clock::get()?.unix_timestamp;
    if raw.len() == AgentProfile::LEN {
        parse_current_agent_profile(raw, now)
    } else {
        parse_legacy_agent_profile(raw, now)
    }
}

pub(crate) fn derive_canonical_agent_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"agent", authority.as_ref()], &crate::ID)
}

pub(crate) fn resize_agent_profile_account_if_needed<'info>(
    profile_info: &AccountInfo<'info>,
    payer_info: &AccountInfo<'info>,
    system_program_info: &AccountInfo<'info>,
) -> Result<()> {
    let target_len = AgentProfile::LEN;
    if profile_info.data_len() == target_len {
        return Ok(());
    }

    profile_info.resize(target_len)?;

    let rent = Rent::get()?;
    let target_rent = rent.minimum_balance(target_len);
    let current_lamports = profile_info.lamports();

    if target_rent > current_lamports {
        let diff = target_rent - current_lamports;
        let cpi = system_program::Transfer {
            from: payer_info.clone(),
            to: profile_info.clone(),
        };
        system_program::transfer(
            CpiContext::new(system_program_info.clone(), cpi),
            diff,
        )?;
    } else if current_lamports > target_rent {
        let diff = current_lamports - target_rent;
        **profile_info.try_borrow_mut_lamports()? -= diff;
        **payer_info.try_borrow_mut_lamports()? += diff;
    }

    Ok(())
}

pub(crate) fn serialize_migrated_agent_profile<'info>(
    profile_info: &AccountInfo<'info>,
    profile: &AgentProfile,
) -> Result<()> {
    let mut data = profile_info.try_borrow_mut_data()?;
    data[..8].copy_from_slice(&AgentProfile::DISCRIMINATOR);
    let mut writer = &mut data[8..];
    AnchorSerialize::serialize(profile, &mut writer)?;
    Ok(())
}

#[error_code]
pub enum AgentProfileMigrationError {
    #[msg("The agent profile discriminator does not match AgentProfile")]
    InvalidAgentProfileDiscriminator,
    #[msg("The agent profile data could not be parsed")]
    InvalidAgentProfileLayout,
    #[msg("The metadata URI is too long")]
    MetadataUriTooLong,
    #[msg("The stored metadata URI is not valid UTF-8")]
    InvalidMetadataUriEncoding,
    #[msg("The provided account is not the canonical agent profile PDA for its authority")]
    InvalidAgentProfilePda,
}
