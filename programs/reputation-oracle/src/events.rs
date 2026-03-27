use anchor_lang::prelude::*;

#[event]
pub struct VouchCreated {
    pub vouch: Pubkey,
    pub voucher: Pubkey,
    pub vouchee: Pubkey,
    pub stake_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct VouchRevoked {
    pub vouch: Pubkey,
    pub voucher: Pubkey,
    pub vouchee: Pubkey,
    pub stake_returned: u64,
    pub timestamp: i64,
}

#[event]
pub struct DisputeOpened {
    pub dispute: Pubkey,
    pub vouch: Pubkey,
    pub challenger: Pubkey,
    pub bond_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub dispute: Pubkey,
    pub vouch: Pubkey,
    pub ruling: String,
    pub timestamp: i64,
}

#[event]
pub struct AuthorDisputeOpened {
    pub author_dispute: Pubkey,
    pub author: Pubkey,
    pub challenger: Pubkey,
    pub reason: String,
    pub skill_listing: Option<Pubkey>,
    pub purchase: Option<Pubkey>,
    pub linked_vouch_count: u32,
    pub bond_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuthorDisputeResolved {
    pub author_dispute: Pubkey,
    pub author: Pubkey,
    pub ruling: String,
    pub linked_vouch_count: u32,
    pub slashed_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuthorDisputeVouchLinked {
    pub author_dispute: Pubkey,
    pub vouch: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SkillListingCreated {
    pub skill_listing: Pubkey,
    pub author: Pubkey,
    pub name: String,
    pub price_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct SkillListingUpdated {
    pub skill_listing: Pubkey,
    pub author: Pubkey,
    pub name: String,
    pub price_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct SkillPurchased {
    pub purchase: Pubkey,
    pub skill_listing: Pubkey,
    pub buyer: Pubkey,
    pub price: u64,
    pub author_share: u64,
    pub voucher_pool: u64,
    pub timestamp: i64,
}

#[event]
pub struct RevenueClaimed {
    pub skill_listing: Pubkey,
    pub vouch: Pubkey,
    pub voucher: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
