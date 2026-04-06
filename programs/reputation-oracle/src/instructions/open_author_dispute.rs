use std::collections::BTreeSet;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use anchor_lang::system_program;

use crate::events::AuthorDisputeOpened as AuthorDisputeOpenedEvent;
use crate::state::{
    AgentProfile, AuthorDispute, AuthorDisputeReason, AuthorDisputeStatus,
    AuthorDisputeVouchLink, Purchase, ReputationConfig, SkillListing, Vouch,
};

#[derive(Accounts)]
#[instruction(dispute_id: u64)]
pub struct OpenAuthorDispute<'info> {
    #[account(
        init,
        payer = challenger,
        space = AuthorDispute::LEN,
        seeds = [b"author_dispute", author_profile.authority.as_ref(), &dispute_id.to_le_bytes()],
        bump
    )]
    pub author_dispute: Account<'info, AuthorDispute>,

    #[account(
        mut,
        seeds = [b"agent", author_profile.authority.as_ref()],
        bump = author_profile.bump
    )]
    pub author_profile: Account<'info, AgentProfile>,

    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ReputationConfig>,

    pub skill_listing: Option<Account<'info, SkillListing>>,

    pub purchase: Option<Account<'info, Purchase>>,

    #[account(mut)]
    pub challenger: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, OpenAuthorDispute<'info>>,
    dispute_id: u64,
    reason: AuthorDisputeReason,
    evidence_uri: String,
) -> Result<()> {
    require!(
        evidence_uri.len() <= AuthorDispute::MAX_EVIDENCE_URI_LENGTH,
        ErrorCode::EvidenceUriTooLong
    );

    let author = ctx.accounts.author_profile.authority;

    if let Some(skill_listing) = &ctx.accounts.skill_listing {
        require!(
            skill_listing.author == author,
            ErrorCode::SkillListingAuthorMismatch
        );
    }

    if let Some(purchase) = &ctx.accounts.purchase {
        let skill_listing = ctx
            .accounts
            .skill_listing
            .as_ref()
            .ok_or(ErrorCode::PurchaseRequiresSkillListing)?;
        require!(
            purchase.skill_listing == skill_listing.key(),
            ErrorCode::PurchaseSkillMismatch
        );
    }

    let config = &ctx.accounts.config;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.author_dispute.to_account_info(),
            },
        ),
        config.dispute_bond,
    )?;

    let clock = Clock::get()?;
    let skill_listing = ctx.accounts.skill_listing.as_ref().map(|account| account.key());
    let purchase = ctx.accounts.purchase.as_ref().map(|account| account.key());
    let expected_backing_vouch_count = ctx.accounts.author_profile.total_vouches_received;
    let author_dispute_key = ctx.accounts.author_dispute.key();
    let remaining_account_count = ctx.remaining_accounts.len();

    require!(
        remaining_account_count % 2 == 0,
        ErrorCode::InvalidBackingVouchAccounts
    );

    let supplied_backing_vouch_count = (remaining_account_count / 2) as u32;
    require!(
        supplied_backing_vouch_count == expected_backing_vouch_count,
        ErrorCode::IncompleteBackingVouchSet
    );

    let system_program_info = ctx.accounts.system_program.to_account_info();
    let challenger_info = ctx.accounts.challenger.to_account_info();
    let rent = Rent::get()?;
    let mut unique_vouches = BTreeSet::new();
    let mut linked_vouch_count = 0u32;

    for account_pair in ctx.remaining_accounts.chunks_exact(2) {
        let link_account = &account_pair[0];
        let vouch_account = &account_pair[1];
        let vouch = Account::<Vouch>::try_from(vouch_account)?;
        let vouch_key = vouch.key();

        require!(
            unique_vouches.insert(vouch_key),
            ErrorCode::DuplicateBackingVouch
        );
        require!(
            vouch.vouchee == ctx.accounts.author_profile.key(),
            ErrorCode::BackingVouchAuthorMismatch
        );
        require!(
            vouch.status.counts_toward_author_wide_backing_snapshot(),
            ErrorCode::BackingVouchNotLive
        );

        let (expected_link_key, link_bump) = Pubkey::find_program_address(
            &[
                b"author_dispute_vouch_link",
                author_dispute_key.as_ref(),
                vouch_key.as_ref(),
            ],
            ctx.program_id,
        );
        require_keys_eq!(
            link_account.key(),
            expected_link_key,
            ErrorCode::AuthorDisputeVouchLinkMismatch
        );
        require!(
            link_account.owner == &system_program::ID && link_account.data_is_empty(),
            ErrorCode::AuthorDisputeVouchLinkAlreadyInitialized
        );

        let link_bump_seed = [link_bump];
        let link_signer_seeds: &[&[u8]] = &[
            b"author_dispute_vouch_link",
            author_dispute_key.as_ref(),
            vouch_key.as_ref(),
            &link_bump_seed,
        ];
        invoke_signed(
            &system_instruction::create_account(
                &challenger_info.key(),
                &link_account.key(),
                rent.minimum_balance(AuthorDisputeVouchLink::LEN),
                AuthorDisputeVouchLink::LEN as u64,
                ctx.program_id,
            ),
            &[
                challenger_info.clone(),
                link_account.clone(),
                system_program_info.clone(),
            ],
            &[link_signer_seeds],
        )?;

        let link_state = AuthorDisputeVouchLink {
            author_dispute: author_dispute_key,
            vouch: vouch_key,
            added_at: clock.unix_timestamp,
            bump: link_bump,
        };
        let mut link_data = link_account.try_borrow_mut_data()?;
        let mut link_data_slice: &mut [u8] = &mut link_data;
        link_state.try_serialize(&mut link_data_slice)?;

        linked_vouch_count = linked_vouch_count
            .checked_add(1)
            .ok_or(ErrorCode::BackingVouchCountOverflow)?;
    }

    require!(
        linked_vouch_count == expected_backing_vouch_count,
        ErrorCode::IncompleteBackingVouchSet
    );

    let author_dispute = &mut ctx.accounts.author_dispute;
    author_dispute.dispute_id = dispute_id;
    author_dispute.author = author;
    author_dispute.challenger = ctx.accounts.challenger.key();
    author_dispute.reason = reason;
    author_dispute.evidence_uri = evidence_uri;
    author_dispute.status = AuthorDisputeStatus::Open;
    author_dispute.ruling = None;
    author_dispute.skill_listing = skill_listing;
    author_dispute.purchase = purchase;
    author_dispute.backing_vouch_count_snapshot = expected_backing_vouch_count;
    author_dispute.linked_vouch_count = linked_vouch_count;
    author_dispute.bond_amount = config.dispute_bond;
    author_dispute.created_at = clock.unix_timestamp;
    author_dispute.resolved_at = None;
    author_dispute.bump = ctx.bumps.author_dispute;
    ctx.accounts.author_profile.open_author_disputes = ctx
        .accounts
        .author_profile
        .open_author_disputes
        .checked_add(1)
        .ok_or(ErrorCode::OpenAuthorDisputeCountOverflow)?;

    emit!(AuthorDisputeOpenedEvent {
        author_dispute: author_dispute_key,
        author,
        challenger: ctx.accounts.challenger.key(),
        reason: reason_label(reason).to_string(),
        skill_listing,
        purchase,
        linked_vouch_count,
        bond_amount: config.dispute_bond,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

fn reason_label(reason: AuthorDisputeReason) -> &'static str {
    match reason {
        AuthorDisputeReason::MaliciousSkill => "MaliciousSkill",
        AuthorDisputeReason::FraudulentClaims => "FraudulentClaims",
        AuthorDisputeReason::FailedDelivery => "FailedDelivery",
        AuthorDisputeReason::Other => "Other",
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Evidence URI is too long")]
    EvidenceUriTooLong,
    #[msg("The provided skill listing does not belong to the disputed author")]
    SkillListingAuthorMismatch,
    #[msg("A purchase reference requires the matching skill listing account")]
    PurchaseRequiresSkillListing,
    #[msg("The provided purchase does not belong to the provided skill listing")]
    PurchaseSkillMismatch,
    #[msg("Author disputes must receive link and vouch accounts in pairs")]
    InvalidBackingVouchAccounts,
    #[msg("Author disputes must snapshot the full author-wide backing set")]
    IncompleteBackingVouchSet,
    #[msg("Duplicate backing vouches are not allowed in an author-wide dispute snapshot")]
    DuplicateBackingVouch,
    #[msg("The provided backing vouch does not belong to the disputed author")]
    BackingVouchAuthorMismatch,
    #[msg("The provided backing vouch is not part of the author's live backing set")]
    BackingVouchNotLive,
    #[msg("The provided author-dispute link PDA does not match the backing vouch")]
    AuthorDisputeVouchLinkMismatch,
    #[msg("The provided author-dispute link PDA is already initialized")]
    AuthorDisputeVouchLinkAlreadyInitialized,
    #[msg("The author-wide backing snapshot exceeded the supported link count")]
    BackingVouchCountOverflow,
    #[msg("Open author dispute count overflowed")]
    OpenAuthorDisputeCountOverflow,
}
