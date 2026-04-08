use anchor_lang::prelude::*;
use crate::state::AgentProfile;

const MIN_PLAUSIBLE_REGISTERED_AT: i64 = 946_684_800; // 2000-01-01T00:00:00Z

fn is_plausible_registered_at(timestamp: i64, now: i64) -> bool {
    timestamp >= MIN_PLAUSIBLE_REGISTERED_AT
        && timestamp <= now.saturating_add(366 * 24 * 60 * 60)
}

/// Migrates an existing AgentProfile PDA to the current struct layout.
/// This is needed when the on-chain struct changed (e.g. fields were removed)
/// and the stored bump is at the wrong offset, causing ConstraintSeeds failures
/// in subsequent instructions that read `author_profile.bump`.
///
/// Uses AccountInfo (unchecked) to bypass Anchor's automatic seeds+bump validation
/// so we can read and rewrite the account data even when the stored bump is stale.
#[derive(Accounts)]
pub struct MigrateAgent<'info> {
    /// CHECK: AgentProfile PDA owned by this program. We bypass typed deserialization
    /// because the stored bump may be at a stale offset after a struct layout change.
    /// Seeds and owner are validated; we rewrite the account data manually.
    #[account(
        mut,
        seeds = [b"agent", authority.key().as_ref()],
        bump,
        owner = crate::ID,
    )]
    pub agent_profile: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MigrateAgent>, metadata_uri: String) -> Result<()> {
    require!(
        metadata_uri.len() <= AgentProfile::MAX_URI_LENGTH,
        MigrateAgentError::MetadataUriTooLong
    );

    let canonical_bump = ctx.bumps.agent_profile;
    let profile_info = &ctx.accounts.agent_profile;
    let authority_key = ctx.accounts.authority.key();

    // Resize the account to the current layout if needed
    let current_len = profile_info.data_len();
    let target_len = AgentProfile::LEN;
    if current_len != target_len {
        profile_info.realloc(target_len, false)?;
        // Refund or charge the difference
        let rent = Rent::get()?;
        let target_rent = rent.minimum_balance(target_len);
        let current_lamports = profile_info.lamports();
        if target_rent > current_lamports {
            // Need more lamports — transfer from authority
            let diff = target_rent - current_lamports;
            let cpi = anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: profile_info.to_account_info(),
            };
            anchor_lang::system_program::transfer(
                CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi),
                diff,
            )?;
        } else if current_lamports > target_rent {
            // Return excess lamports to authority
            let diff = current_lamports - target_rent;
            **profile_info.try_borrow_mut_lamports()? -= diff;
            **ctx.accounts.authority.try_borrow_mut_lamports()? += diff;
        }
    }

    // Now write the AgentProfile with the correct bump using Borsh serialization.
    // We preserve reputation stats from the existing account if it already has
    // a valid authority matching the caller.
    let data = profile_info.try_borrow_data()?;
    
    // Read existing stats to preserve them (best-effort — the layout may be stale
    // but authority and reputation fields are at predictable early offsets)
    let existing_authority = {
        use std::convert::TryInto;
        let bytes: [u8; 32] = data[8..40].try_into().unwrap_or([0u8; 32]);
        Pubkey::new_from_array(bytes)
    };
    let is_migration = existing_authority == authority_key;

    // We'll rebuild the struct from scratch preserving numeric stats when migrating
    drop(data);

    // Deserialize the best we can from the old layout to preserve stats
    // Old layout: disc(8) + authority(32) + uri(4+len) + rep(8) + recv(4) + given(4) + staked(8) + ... + reg_at(8) + bump(1)
    let raw = profile_info.try_borrow_data()?;
    let (preserved_score, preserved_recv, preserved_given, preserved_staked, preserved_reg_at) =
        if is_migration && raw.len() >= 8 + 32 + 4 {
            let uri_len = u32::from_le_bytes(raw[40..44].try_into().unwrap_or([0;4])) as usize;
            let base = 44 + uri_len;
            if raw.len() > base + 28 {
                let score = u64::from_le_bytes(raw[base..base+8].try_into().unwrap_or([0;8]));
                let recv = u32::from_le_bytes(raw[base+8..base+12].try_into().unwrap_or([0;4]));
                let given = u32::from_le_bytes(raw[base+12..base+16].try_into().unwrap_or([0;4]));
                let staked = u64::from_le_bytes(raw[base+16..base+24].try_into().unwrap_or([0;8]));
                let now = Clock::get()?.unix_timestamp;
                // reg_at is at base+24 in new layout; base+32 in old layout (after disputes_won+lost)
                // Prefer whichever timestamp is plausible; old legacy layouts can
                // produce a small positive integer at base+24 from disputes counters.
                let reg_at_new = i64::from_le_bytes(raw[base+24..base+32].try_into().unwrap_or([0;8]));
                let reg_at = if is_plausible_registered_at(reg_at_new, now) {
                    reg_at_new
                } else if raw.len() > base + 40 {
                    let reg_at_old = i64::from_le_bytes(raw[base+32..base+40].try_into().unwrap_or([0;8]));
                    if is_plausible_registered_at(reg_at_old, now) {
                        reg_at_old
                    } else {
                        now
                    }
                } else {
                    now
                };
                (score, recv, given, staked, reg_at)
            } else {
                (0, 0, 0, 0, Clock::get()?.unix_timestamp)
            }
        } else {
            (0, 0, 0, 0, Clock::get()?.unix_timestamp)
        };
    drop(raw);

    // Write the new correctly-structured AgentProfile
    let profile = AgentProfile {
        authority: authority_key,
        metadata_uri,
        reputation_score: preserved_score,
        total_vouches_received: preserved_recv,
        total_vouches_given: preserved_given,
        total_staked_for: preserved_staked,
        author_bond_lamports: 0,
        active_free_skill_listings: 0,
        open_author_disputes: 0,
        registered_at: preserved_reg_at,
        bump: canonical_bump,
    };

    let mut data = profile_info.try_borrow_mut_data()?;
    let dst = &mut data[..];
    // Write discriminator (AgentProfile discriminator = sha256("account:AgentProfile")[..8])
    use anchor_lang::Discriminator;
    dst[..8].copy_from_slice(&AgentProfile::DISCRIMINATOR);
    // Serialize the rest with Borsh
    let mut writer = &mut dst[8..];
    AnchorSerialize::serialize(&profile, &mut writer)?;

    Ok(())
}

#[error_code]
pub enum MigrateAgentError {
    #[msg("Metadata URI is too long")]
    MetadataUriTooLong,
}
