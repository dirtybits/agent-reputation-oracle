use anchor_lang::prelude::*;

use crate::events::AuthorDisputeVouchLinked as AuthorDisputeVouchLinkedEvent;
use crate::state::{
    AgentProfile, AuthorDispute, AuthorDisputeStatus, AuthorDisputeVouchLink, Vouch, VouchStatus,
};

#[derive(Accounts)]
#[instruction(dispute_id: u64)]
pub struct LinkAuthorDisputeVouch<'info> {
    #[account(
        mut,
        seeds = [b"author_dispute", author_profile.authority.as_ref(), &dispute_id.to_le_bytes()],
        bump = author_dispute.bump,
        constraint = author_dispute.status == AuthorDisputeStatus::Open @ ErrorCode::AuthorDisputeNotOpen,
        constraint = author_dispute.author == author_profile.authority @ ErrorCode::AuthorMismatch,
        constraint = author_dispute.challenger == challenger.key() @ ErrorCode::UnauthorizedChallenger,
    )]
    pub author_dispute: Account<'info, AuthorDispute>,

    #[account(
        init,
        payer = challenger,
        space = AuthorDisputeVouchLink::LEN,
        seeds = [b"author_dispute_vouch_link", author_dispute.key().as_ref(), vouch.key().as_ref()],
        bump
    )]
    pub author_dispute_vouch_link: Account<'info, AuthorDisputeVouchLink>,

    #[account(
        constraint = vouch.status == VouchStatus::Active @ ErrorCode::VouchNotActive,
        constraint = vouch.vouchee == author_profile.key() @ ErrorCode::VouchNotForAuthor,
    )]
    pub vouch: Account<'info, Vouch>,

    #[account(
        seeds = [b"agent", author_profile.authority.as_ref()],
        bump = author_profile.bump
    )]
    pub author_profile: Account<'info, AgentProfile>,

    #[account(mut)]
    pub challenger: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<LinkAuthorDisputeVouch>, _dispute_id: u64) -> Result<()> {
    let clock = Clock::get()?;

    let link = &mut ctx.accounts.author_dispute_vouch_link;
    link.author_dispute = ctx.accounts.author_dispute.key();
    link.vouch = ctx.accounts.vouch.key();
    link.added_at = clock.unix_timestamp;
    link.bump = ctx.bumps.author_dispute_vouch_link;

    let author_dispute = &mut ctx.accounts.author_dispute;
    author_dispute.linked_vouch_count = author_dispute.linked_vouch_count.saturating_add(1);

    emit!(AuthorDisputeVouchLinkedEvent {
        author_dispute: author_dispute.key(),
        vouch: ctx.accounts.vouch.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Author dispute is not open")]
    AuthorDisputeNotOpen,
    #[msg("The disputed author does not match the linked vouch target")]
    AuthorMismatch,
    #[msg("Only the challenger can attach vouches to this author dispute")]
    UnauthorizedChallenger,
    #[msg("Only active vouches can be linked to an author dispute")]
    VouchNotActive,
    #[msg("This vouch does not back the disputed author")]
    VouchNotForAuthor,
}
