use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod events;

use instructions::*;
use state::{AuthorDisputeReason, AuthorDisputeRuling};

declare_id!("CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW");

#[program]
pub mod agentvouch {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        chain_context: String,
        config_authority: Pubkey,
        treasury_authority: Pubkey,
        settlement_authority: Pubkey,
        pause_authority: Pubkey,
        slash_percentage: u8,
        cooldown_period: i64,
    ) -> Result<()> {
        instructions::initialize_config::handler(
            ctx,
            chain_context,
            config_authority,
            treasury_authority,
            settlement_authority,
            pause_authority,
            slash_percentage,
            cooldown_period,
        )
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::register_agent::handler(ctx, metadata_uri)
    }

    pub fn deposit_author_bond(
        ctx: Context<DepositAuthorBond>,
        amount_usdc_micros: u64,
    ) -> Result<()> {
        instructions::deposit_author_bond::handler(ctx, amount_usdc_micros)
    }

    pub fn withdraw_author_bond(
        ctx: Context<WithdrawAuthorBond>,
        amount_usdc_micros: u64,
    ) -> Result<()> {
        instructions::withdraw_author_bond::handler(ctx, amount_usdc_micros)
    }

    pub fn vouch(
        ctx: Context<CreateVouch>,
        stake_usdc_micros: u64,
    ) -> Result<()> {
        instructions::vouch::handler(ctx, stake_usdc_micros)
    }

    pub fn revoke_vouch(ctx: Context<RevokeVouch>) -> Result<()> {
        instructions::revoke_vouch::handler(ctx)
    }

    pub fn open_author_dispute<'info>(
        ctx: Context<'_, '_, 'info, 'info, OpenAuthorDispute<'info>>,
        dispute_id: u64,
        reason: AuthorDisputeReason,
        evidence_uri: String,
    ) -> Result<()> {
        instructions::open_author_dispute::handler(ctx, dispute_id, reason, evidence_uri)
    }

    pub fn resolve_author_dispute<'info>(
        ctx: Context<'_, '_, 'info, 'info, ResolveAuthorDispute<'info>>,
        dispute_id: u64,
        ruling: AuthorDisputeRuling,
    ) -> Result<()> {
        instructions::resolve_author_dispute::handler(ctx, dispute_id, ruling)
    }

    pub fn create_skill_listing(
        ctx: Context<CreateSkillListing>,
        skill_id: String,
        skill_uri: String,
        name: String,
        description: String,
        price_usdc_micros: u64,
    ) -> Result<()> {
        instructions::create_skill_listing::handler(
            ctx,
            skill_id,
            skill_uri,
            name,
            description,
            price_usdc_micros,
        )
    }

    pub fn update_skill_listing(
        ctx: Context<UpdateSkillListing>,
        skill_id: String,
        skill_uri: String,
        name: String,
        description: String,
        price_usdc_micros: u64,
    ) -> Result<()> {
        instructions::update_skill_listing::handler(
            ctx,
            skill_id,
            skill_uri,
            name,
            description,
            price_usdc_micros,
        )
    }

    pub fn remove_skill_listing(
        ctx: Context<RemoveSkillListing>,
        skill_id: String,
    ) -> Result<()> {
        instructions::remove_skill_listing::handler(ctx, skill_id)
    }

    pub fn close_skill_listing(
        ctx: Context<CloseSkillListing>,
        skill_id: String,
    ) -> Result<()> {
        instructions::close_skill_listing::handler(ctx, skill_id)
    }

    pub fn purchase_skill(ctx: Context<PurchaseSkill>) -> Result<()> {
        instructions::purchase_skill::handler(ctx)
    }

    pub fn claim_voucher_revenue(ctx: Context<ClaimVoucherRevenue>) -> Result<()> {
        instructions::claim_voucher_revenue::handler(ctx)
    }

    pub fn link_vouch_to_listing(ctx: Context<LinkVouchToListing>) -> Result<()> {
        instructions::link_vouch_to_listing::handler(ctx)
    }

    pub fn unlink_vouch_from_listing(ctx: Context<UnlinkVouchFromListing>) -> Result<()> {
        instructions::unlink_vouch_from_listing::handler(ctx)
    }
}
