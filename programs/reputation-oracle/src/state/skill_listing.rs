use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum SkillStatus {
    Active,
    Suspended,
    Removed,
}

#[account]
pub struct SkillListing {
    pub author: Pubkey,           // Agent who published the skill
    pub skill_uri: String,        // IPFS hash or Arweave URL
    pub name: String,             // Skill name
    pub description: String,      // Short description
    pub price_lamports: u64,      // Price in lamports
    pub total_downloads: u64,     // Number of purchases
    pub total_revenue: u64,       // Total revenue generated
    pub created_at: i64,          // Unix timestamp
    pub updated_at: i64,          // Last update timestamp
    pub status: SkillStatus,      // Active, Suspended, or Removed
    pub bump: u8,                 // PDA bump seed
}

impl SkillListing {
    pub const MAX_NAME_LEN: usize = 64;
    pub const MAX_DESCRIPTION_LEN: usize = 256;
    pub const MAX_URI_LEN: usize = 256;
    
    pub const SPACE: usize = 8 + // discriminator
        32 + // author
        (4 + Self::MAX_URI_LEN) + // skill_uri
        (4 + Self::MAX_NAME_LEN) + // name
        (4 + Self::MAX_DESCRIPTION_LEN) + // description
        8 + // price_lamports
        8 + // total_downloads
        8 + // total_revenue
        8 + // created_at
        8 + // updated_at
        1 + // status
        1; // bump
}
