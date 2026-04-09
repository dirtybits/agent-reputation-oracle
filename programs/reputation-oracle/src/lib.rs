use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod events;

use instructions::*;
use state::{AuthorDisputeReason, AuthorDisputeRuling};

declare_id!("ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf");

#[program]
pub mod reputation_oracle {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        min_stake: u64,
        dispute_bond: u64,
        min_author_bond_for_free_listing: u64,
        slash_percentage: u8,
        cooldown_period: i64,
    ) -> Result<()> {
        instructions::initialize_config::handler(
            ctx,
            min_stake,
            dispute_bond,
            min_author_bond_for_free_listing,
            slash_percentage,
            cooldown_period,
        )
    }

    pub fn migrate_config(ctx: Context<MigrateConfig>) -> Result<()> {
        instructions::migrate_config::handler(ctx)
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::register_agent::handler(ctx, metadata_uri)
    }

    pub fn migrate_agent(
        ctx: Context<MigrateAgent>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::migrate_agent::handler(ctx, metadata_uri)
    }

    pub fn admin_migrate_agent(ctx: Context<AdminMigrateAgent>) -> Result<()> {
        instructions::admin_migrate_agent::handler(ctx)
    }

    pub fn repair_agent_registered_at(
        ctx: Context<RepairAgentRegisteredAt>,
        registered_at: i64,
    ) -> Result<()> {
        instructions::repair_agent_registered_at::handler(ctx, registered_at)
    }

    pub fn deposit_author_bond(
        ctx: Context<DepositAuthorBond>,
        amount: u64,
    ) -> Result<()> {
        instructions::deposit_author_bond::handler(ctx, amount)
    }

    pub fn withdraw_author_bond(
        ctx: Context<WithdrawAuthorBond>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_author_bond::handler(ctx, amount)
    }

    pub fn vouch(
        ctx: Context<CreateVouch>,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::vouch::handler(ctx, stake_amount)
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
        price_lamports: u64,
    ) -> Result<()> {
        instructions::create_skill_listing::handler(
            ctx,
            skill_id,
            skill_uri,
            name,
            description,
            price_lamports,
        )
    }

    pub fn update_skill_listing(
        ctx: Context<UpdateSkillListing>,
        skill_id: String,
        skill_uri: String,
        name: String,
        description: String,
        price_lamports: u64,
    ) -> Result<()> {
        instructions::update_skill_listing::handler(
            ctx,
            skill_id,
            skill_uri,
            name,
            description,
            price_lamports,
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
}
