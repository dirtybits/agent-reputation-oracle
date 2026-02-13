# AgentVouch Marketplace Development Plan
**Created:** 2026-02-12 15:30 PST  
**Timeline:** Final 17 hours before hackathon deadline

---

## Current State

### ✅ What Exists
- **Smart Contracts:** SkillListing and Purchase account types already defined
- **Revenue Distribution:** 60/40 split logic (author/vouchers) implemented in contracts
- **UI Shell:** `/marketplace` page exists with mock data and "coming soon" banner
- **Design:** Full visual design complete with filters, cards, revenue explanations

### 🚧 What's Missing
- **Smart contract integration:** UI not connected to on-chain accounts
- **Skill listing creation:** No UI to publish new skills
- **Purchase flow:** No wallet interaction for buying skills
- **IPFS integration:** No file storage/retrieval for actual skill.md files
- **Author dashboard:** No way to see your published skills + earnings

---

## Hackathon-Scope Marketplace (17-hour build)

**Goal:** Demonstrate the concept with one working skill listing and purchase flow.

### Phase 1: Contract Integration (3-4 hours)

**Add to `useReputationOracle.ts`:**

```typescript
// List all skill listings
async getAllSkillListings(): Promise<SkillListing[]>

// Get skills by author
async getSkillsByAuthor(author: PublicKey): Promise<SkillListing[]>

// Create new skill listing
async createSkillListing(
  name: string,
  description: string, 
  skillUri: string, // IPFS hash or URL
  price: number // in SOL
): Promise<{ tx: string, listing: PublicKey }>

// Purchase a skill
async purchaseSkill(
  listingPubkey: PublicKey
): Promise<{ tx: string, purchase: PublicKey, downloadUrl: string }>

// Get author earnings
async getAuthorEarnings(author: PublicKey): Promise<{
  totalEarnings: number,
  skillCount: number,
  totalDownloads: number
}>
```

### Phase 2: Publish Skill UI (2-3 hours)

**Add "Publish Skill" tab to main app:**

```tsx
// New tab alongside Profile, Vouch, Explorer, Disputes
<Tab id="marketplace">Marketplace 🛍️</Tab>

// Content:
<MarketplaceTab>
  <h2>Publish a Skill</h2>
  
  <Input label="Skill Name" placeholder="Jupiter Swap Automation" />
  <TextArea label="Description" rows={4} />
  <Input label="Price (SOL)" type="number" step="0.01" />
  <FileUpload 
    label="Upload skill.md" 
    accept=".md"
    onUpload={(file) => uploadToIPFS(file)} // or just store as data URL for demo
  />
  
  <Button onClick={handlePublish}>
    Publish Skill (requires {MIN_REP} reputation)
  </Button>
  
  <h3>Your Published Skills</h3>
  <SkillsList skills={authorSkills} showEarnings={true} />
</MarketplaceTab>
```

### Phase 3: Purchase Flow (2-3 hours)

**Update marketplace page:**

```tsx
// Replace mock data with real chain data
useEffect(() => {
  if (oracle) {
    loadSkills();
  }
}, [oracle]);

const loadSkills = async () => {
  const allSkills = await oracle.getAllSkillListings();
  setSkills(allSkills);
};

const handlePurchase = async (listingPubkey: PublicKey) => {
  setLoading(true);
  try {
    const { tx, downloadUrl } = await oracle.purchaseSkill(listingPubkey);
    
    // Show success modal with download button
    setShowDownload({ url: downloadUrl, tx });
    
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

### Phase 4: Simple File Storage (1-2 hours)

**For hackathon demo, use one of:**

Option A: **Store raw markdown as base64 in listing account** (simplest)
- No external dependencies
- Limited file size (~10KB max in account)
- Perfect for demo

Option B: **Upload to Arweave/Shadow Drive** (better, but more complex)
- Permanent storage
- Returns URL to store in listing
- Need to integrate upload SDK

Option C: **GitHub Gist** (quick hack)
- Upload skill.md to anonymous gist
- Store gist URL in listing
- Easy download for buyers

**Recommendation:** Option A for speed, mention Option B in future vision.

### Phase 5: Revenue Dashboard (1-2 hours)

**Add to profile tab:**

```tsx
{agentProfile && isAuthor && (
  <div className="bg-white/10 rounded-lg p-6">
    <h2>📊 Marketplace Earnings</h2>
    
    <div className="grid grid-cols-3 gap-4">
      <Stat label="Total Earned" value={`${earnings.total} SOL`} />
      <Stat label="Skills Published" value={earnings.skillCount} />
      <Stat label="Total Downloads" value={earnings.downloads} />
    </div>
    
    <h3>Revenue Breakdown</h3>
    {earnings.skillBreakdown.map(skill => (
      <SkillRevenue 
        name={skill.name}
        downloads={skill.downloads}
        revenue={skill.revenue}
        authorShare={skill.revenue * 0.6}
        voucherShare={skill.revenue * 0.4}
      />
    ))}
  </div>
)}
```

### Phase 6: Voucher Earnings (1 hour)

**Show vouchers their earnings:**

```tsx
{agentProfile && vouches.length > 0 && (
  <div className="bg-white/10 rounded-lg p-6">
    <h2>💰 Voucher Income</h2>
    <p>You earn from skills published by agents you vouch for.</p>
    
    <div className="space-y-2">
      {voucherEarnings.map(earning => (
        <div className="flex justify-between">
          <span>{earning.agentName}'s skills</span>
          <span className="text-green-400">+{earning.amount} SOL</span>
        </div>
      ))}
    </div>
    
    <div className="text-sm text-blue-200 mt-4">
      Your vouchers earned {totalVoucherIncome} SOL total
    </div>
  </div>
)}
```

---

## Minimum Viable Demo (What Judges Need to See)

**Must demonstrate:**
1. ✅ Author publishes a skill with price
2. ✅ Skill appears in marketplace
3. ✅ Buyer purchases skill for X SOL
4. ✅ Transaction shows:
   - 60% goes to author
   - 40% distributed to vouchers (proportional to stake)
5. ✅ Author sees earnings in dashboard
6. ✅ Vouchers see their share in earnings

**Success criteria:**
- One complete purchase flow working end-to-end
- Revenue distribution provable on-chain
- UI shows the economics clearly

---

## Implementation Priority

**Hour 1-4: Smart Contract Hooks**
- Implement `useReputationOracle` methods for marketplace
- Test with devnet transactions
- Verify revenue distribution math

**Hour 5-7: Publish UI**
- Add marketplace tab
- File upload (base64 storage for demo)
- Create listing transaction

**Hour 8-10: Buy UI**
- Fetch real listings from chain
- Purchase button with wallet interaction
- Download flow

**Hour 11-13: Dashboards**
- Author earnings display
- Voucher income display
- Skill statistics

**Hour 14-15: Polish**
- Error handling
- Loading states
- Success messages

**Hour 16-17: Testing**
- End-to-end test: register → get vouches → publish skill → someone buys
- Verify revenue split on-chain
- Screenshot/record for demo

---

## Post-Hackathon Roadmap (Already in submission)

**Week 1-2:**
- IPFS integration (Bundlr or NFT.storage)
- Skill categories/tags
- Search and filtering
- Rating system (buyers rate purchased skills)

**Week 3-4:**
- Skill updates (versioning)
- Bundle deals (multiple skills)
- Subscription model (monthly access)
- Featured skills (paid promotion)

**Month 2:**
- Cross-chain marketplace (Ethereum, Base)
- Reputation-gated listings (only 5000+ rep can sell)
- Dispute resolution for bad skills
- Refund mechanism

**Month 3-6:**
- Full marketplace with IPFS, x402 micropayments
- Voucher DAO for governance
- Integration with Eliza, AgentWallet, other agent platforms
- Revenue milestone: $10k/month GMV

---

## Expected Outcome (17 hours from now)

**Demo-ready marketplace showing:**
- ✅ 1-2 real skills published on-chain
- ✅ Working purchase flow with revenue split
- ✅ Author + voucher dashboards showing earnings
- ✅ Visual proof of the 60/40 economics
- ✅ Clear path to production (IPFS, x402 in roadmap)

**Judge takeaway:**
"This isn't just reputation—it's a revenue-generating marketplace where vouchers earn passive income. The economic incentives align security with profitability."

---

## Decision: Build It or Skip It?

**Arguments FOR building now (17 hours):**
- Demonstrates revenue-generating aspect (key differentiator)
- Shows vouchers earn passive income (economic incentive)
- Proves the marketplace contracts work
- "Coming soon" looks incomplete; working demo looks serious

**Arguments AGAINST building now:**
- What we have (reputation + vouching) already works and is novel
- Risk of introducing bugs in final hours
- Could use time for demo video instead
- Marketplace is "future vision" not core MVP

**My recommendation:** **Build it.** Here's why:
- Smart contracts already support it (low risk)
- UI shell exists (just need hooks + transactions)
- 17 hours is enough for basic flow
- Marketplace economics is our unique angle vs pure reputation
- Vouchers earning passive income = killer feature for adoption
- Working demo > promising roadmap in hackathon judging

**Suggested split:**
- 10 hours: Build marketplace MVP
- 4 hours: Demo video showing full flow
- 3 hours: Buffer for bugs + final polish
