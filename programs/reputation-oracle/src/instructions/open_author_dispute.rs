use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::events::AuthorDisputeOpened as AuthorDisputeOpenedEvent;
use crate::state::{
    AgentProfile, AuthorDispute, AuthorDisputeReason, AuthorDisputeStatus, Purchase,
    ReputationConfig, SkillListing,
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

pub fn handler(
    ctx: Context<OpenAuthorDispute>,
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
    author_dispute.linked_vouch_count = 0;
    author_dispute.bond_amount = config.dispute_bond;
    author_dispute.created_at = clock.unix_timestamp;
    author_dispute.resolved_at = None;
    author_dispute.bump = ctx.bumps.author_dispute;

    emit!(AuthorDisputeOpenedEvent {
        author_dispute: ctx.accounts.author_dispute.key(),
        author,
        challenger: ctx.accounts.challenger.key(),
        reason: reason_label(reason).to_string(),
        skill_listing,
        purchase,
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
}
