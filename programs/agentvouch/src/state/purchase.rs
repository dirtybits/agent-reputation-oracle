use anchor_lang::prelude::*;

#[account]
pub struct Purchase {
    pub buyer: Pubkey,            // Who purchased the skill
    pub skill_listing: Pubkey,    // Which skill was purchased
    pub purchased_at: i64,        // Unix timestamp
    pub price_paid: u64,          // Amount paid in lamports
    pub bump: u8,                 // PDA bump seed
}

impl Purchase {
    pub const SPACE: usize = 8 + // discriminator
        32 + // buyer
        32 + // skill_listing
        8 + // purchased_at
        8 + // price_paid
        1; // bump
}
