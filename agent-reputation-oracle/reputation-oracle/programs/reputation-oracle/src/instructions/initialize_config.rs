use anchor_lang::prelude::*;
use crate::state::ReputationConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = ReputationConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ReputationConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    min_stake: u64,
    dispute_bond: u64,
    slash_percentage: u8,
    cooldown_period: i64,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    
    config.authority = ctx.accounts.authority.key();
    config.min_stake = min_stake;
    config.dispute_bond = dispute_bond;
    config.slash_percentage = slash_percentage;
    config.cooldown_period = cooldown_period;
    
    // Default reputation weights
    config.stake_weight = 1;
    config.vouch_weight = 100;
    config.dispute_penalty = 500;
    config.longevity_bonus = 10;
    
    config.bump = ctx.bumps.config;
    
    Ok(())
}
