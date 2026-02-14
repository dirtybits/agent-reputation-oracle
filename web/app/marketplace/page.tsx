'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

type Tab = 'browse' | 'publish' | 'purchases' | 'listings';
type Filter = 'all' | 'newest' | 'popular';

interface SkillListing {
  publicKey: string;
  author: string;
  name: string;
  description: string;
  skillUri: string;
  price: number; // SOL
  downloads: number;
  revenue: number;
  createdAt: Date;
}

export default function MarketplacePage() {
  const { publicKey, connected } = useWallet();
  const oracle = useReputationOracle();
  
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [filter, setFilter] = useState<Filter>('all');
  const [skills, setSkills] = useState<SkillListing[]>([]);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Publish form state
  const [skillId, setSkillId] = useState('');
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillUri, setSkillUri] = useState('');
  const [skillPrice, setSkillPrice] = useState('0.05');

  useEffect(() => {
    if (activeTab === 'browse') {
      loadAllSkills();
    } else if (activeTab === 'purchases' && connected) {
      loadMyPurchases();
    } else if (activeTab === 'listings' && connected) {
      loadMyListings();
    }
  }, [activeTab, connected]);

  const loadAllSkills = async () => {
    setLoading(true);
    try {
      const allSkills = await oracle.getAllSkillListings();
      
      const formatted: SkillListing[] = allSkills.map((skill: any) => ({
        publicKey: skill.publicKey.toString(),
        author: skill.account.author.toString(),
        name: skill.account.name,
        description: skill.account.description,
        skillUri: skill.account.skillUri,
        price: skill.account.priceLamports.toNumber() / LAMPORTS_PER_SOL,
        downloads: skill.account.totalDownloads.toNumber(),
        revenue: skill.account.totalRevenue.toNumber() / LAMPORTS_PER_SOL,
        createdAt: new Date(skill.account.createdAt.toNumber() * 1000),
      }));

      // Apply filter
      let sorted = [...formatted];
      if (filter === 'newest') {
        sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else if (filter === 'popular') {
        sorted.sort((a, b) => b.downloads - a.downloads);
      }
      
      setSkills(sorted);
    } catch (error: any) {
      console.error('Error loading skills:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMyPurchases = async () => {
    setLoading(true);
    try {
      const purchases = await oracle.getMyPurchases();
      setMyPurchases(purchases);
    } catch (error: any) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyListings = async () => {
    setLoading(true);
    try {
      const listings = await oracle.getMyListings();
      setMyListings(listings);
    } catch (error: any) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishSkill = async () => {
    if (!skillId || !skillName || !skillDescription || !skillUri) {
      setStatus('Please fill in all fields');
      return;
    }

    setLoading(true);
    setStatus('Publishing skill...');
    
    try {
      const priceLamports = parseFloat(skillPrice) * LAMPORTS_PER_SOL;
      const { tx } = await oracle.createSkillListing(
        skillId,
        skillUri,
        skillName,
        skillDescription,
        priceLamports
      );
      
      setStatus(`Skill published! TX: ${tx}`);
      setSkillId('');
      setSkillName('');
      setSkillDescription('');
      setSkillUri('');
      
      // Refresh listings
      setTimeout(() => {
        setActiveTab('listings');
        loadMyListings();
      }, 2000);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSkill = async (skillListingKey: string, authorKey: string) => {
    if (!connected) {
      setStatus('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setStatus('Purchasing skill...');
    
    try {
      const { tx } = await oracle.purchaseSkill(
        new PublicKey(skillListingKey),
        new PublicKey(authorKey)
      );
      
      setStatus(`Skill purchased! TX: ${tx}`);
      
      // Refresh purchases and skills
      setTimeout(() => {
        loadAllSkills();
        if (activeTab === 'purchases') {
          loadMyPurchases();
        }
      }, 2000);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const tabs = [
    { id: 'browse' as Tab, label: 'Browse Skills', icon: '📚' },
    { id: 'publish' as Tab, label: 'Publish Skill', icon: '📦' },
    { id: 'purchases' as Tab, label: 'My Purchases', icon: '🛒' },
    { id: 'listings' as Tab, label: 'My Listings', icon: '📦' },
  ];

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-purple-900 dark:via-blue-900 dark:to-indigo-900 relative">
      <div 
        className="absolute inset-0 opacity-10 dark:opacity-15 bg-center bg-no-repeat bg-cover"
        style={{ backgroundImage: 'url(/network-backdrop.png)' }}
      />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <Link href="/" className="text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 text-sm mb-2 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Skill Marketplace 🛍️
            </h1>
            <p className="text-gray-700 dark:text-blue-200">
              Discover, buy, and publish AI agent skills. Revenue shared 60/40 with vouchers.
            </p>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <WalletMultiButton />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Browse Skills Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-2">
              {(['all', 'newest', 'popular'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    loadAllSkills();
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
                    filter === f
                      ? 'bg-white text-blue-900'
                      : 'bg-white/10 text-blue-200 hover:bg-white/20'
                  }`}
                >
                  {f === 'all' && 'All'}
                  {f === 'newest' && '🆕 Newest'}
                  {f === 'popular' && '🔥 Popular'}
                </button>
              ))}
            </div>

            {/* Skills Grid */}
            {loading ? (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 text-center">
                <p className="text-xl text-white">Loading skills...</p>
              </div>
            ) : skills.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 text-center">
                <p className="text-xl text-white mb-4">No skills published yet</p>
                <p className="text-blue-200 mb-6">Be the first to publish a skill!</p>
                <button
                  onClick={() => setActiveTab('publish')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  Publish Skill →
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
                {skills.map((skill) => (
                  <div
                    key={skill.publicKey}
                    className="bg-white/10 backdrop-blur-lg rounded-lg p-6 hover:bg-white/15 transition border border-white/20"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold text-white">{skill.name}</h3>
                      <div className="text-green-400 font-bold text-2xl whitespace-nowrap ml-2">
                        {skill.price} SOL
                      </div>
                    </div>
                    
                    <p className="text-blue-200 text-sm mb-4">
                      {skill.description}
                    </p>
                    
                    <div className="flex items-center gap-2 mb-3 text-sm text-blue-200">
                      <span>👤 {shortenAddress(skill.author)}</span>
                      <span className="text-blue-300">•</span>
                      <span>{formatDate(skill.createdAt)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                      <div className="bg-black/30 rounded p-3 text-center">
                        <div className="text-blue-200">Downloads</div>
                        <div className="text-white font-bold text-lg">{skill.downloads}</div>
                      </div>
                      <div className="bg-black/30 rounded p-3 text-center">
                        <div className="text-blue-200">Revenue</div>
                        <div className="text-green-400 font-bold text-lg">{skill.revenue.toFixed(2)} SOL</div>
                      </div>
                    </div>
                    
                    {/* Skill Address */}
                    <div className="mb-4 bg-black/30 rounded p-3">
                      <div className="text-blue-200 text-xs mb-1">📄 Skill Address</div>
                      <div className="font-mono text-xs text-white break-all">
                        {skill.publicKey}
                      </div>
                    </div>

                    {/* Skill URI Link */}
                    <div className="mb-4">
                      <a
                        href={skill.skillUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                      >
                        📄 {skill.skillUri.startsWith('http') ? 'View skill.md' : 'IPFS Link'} →
                      </a>
                    </div>
                    
                    <button
                      onClick={() => handlePurchaseSkill(skill.publicKey, skill.author)}
                      disabled={!connected || loading}
                      className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition"
                    >
                      {!connected ? 'Connect Wallet' : loading ? '...' : `Buy for ${skill.price} SOL`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Publish Skill Tab */}
        {activeTab === 'publish' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">📦 Publish a New Skill</h2>
            <p className="text-blue-200 mb-6">
              Publish your agent skill and earn 60% of each sale. Vouchers earn the remaining 40%.
            </p>
            
            {!connected ? (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-6 text-center">
                <p className="text-yellow-200 mb-4">Connect your wallet to publish skills</p>
                <WalletMultiButton />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-white mb-2 font-semibold">Skill ID (unique identifier)</label>
                  <input
                    type="text"
                    value={skillId}
                    onChange={(e) => setSkillId(e.target.value)}
                    placeholder="my-trading-bot-v1"
                    className="w-full px-4 py-3 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                  />
                  <p className="text-xs text-blue-200 mt-1">Use lowercase, hyphens, no spaces (e.g., "jupiter-swap-v2")</p>
                </div>
                
                <div>
                  <label className="block text-white mb-2 font-semibold">Skill Name</label>
                  <input
                    type="text"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="Jupiter Trading Bot"
                    className="w-full px-4 py-3 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                  />
                </div>
                
                <div>
                  <label className="block text-white mb-2 font-semibold">Description</label>
                  <textarea
                    value={skillDescription}
                    onChange={(e) => setSkillDescription(e.target.value)}
                    placeholder="Automated trading strategies using Jupiter aggregator..."
                    className="w-full px-4 py-3 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400 h-24"
                  />
                </div>
                
                <div>
                  <label className="block text-white mb-2 font-semibold">Skill URI (IPFS or HTTPS)</label>
                  <input
                    type="text"
                    value={skillUri}
                    onChange={(e) => setSkillUri(e.target.value)}
                    placeholder="ipfs://QmXxx... or https://example.com/skill.md"
                    className="w-full px-4 py-3 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                  />
                  <p className="text-xs text-blue-200 mt-1">Link to your skill.md file</p>
                </div>
                
                <div>
                  <label className="block text-white mb-2 font-semibold">Price (SOL)</label>
                  <input
                    type="number"
                    value={skillPrice}
                    onChange={(e) => setSkillPrice(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="w-full px-4 py-3 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                  />
                </div>
                
                <div className="bg-blue-900/30 border border-blue-400/50 rounded-lg p-4">
                  <p className="text-blue-200 text-sm">
                    💡 <strong>Revenue split:</strong> You earn 60% ({(parseFloat(skillPrice) * 0.6).toFixed(2)} SOL per sale), 
                    vouchers earn 40% ({(parseFloat(skillPrice) * 0.4).toFixed(2)} SOL distributed by stake)
                  </p>
                </div>
                
                <button
                  onClick={handlePublishSkill}
                  disabled={loading || !skillId || !skillName || !skillDescription || !skillUri}
                  className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-bold text-lg transition"
                >
                  {loading ? 'Publishing...' : 'Publish Skill'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* My Purchases Tab */}
        {activeTab === 'purchases' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">🛒 My Purchases</h2>
            
            {!connected ? (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-6 text-center">
                <p className="text-yellow-200">Connect your wallet to view purchases</p>
              </div>
            ) : loading ? (
              <p className="text-blue-200">Loading purchases...</p>
            ) : myPurchases.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xl text-white mb-4">No purchases yet</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  Browse Skills →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myPurchases.map((purchase, idx) => (
                  <div key={idx} className="bg-black/30 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="text-sm text-blue-200 mb-1">Purchase Address:</p>
                        <p className="font-mono text-xs text-white break-all mb-3">
                          {purchase.publicKey.toString()}
                        </p>
                        <p className="text-sm text-blue-200 mb-1">Skill Address:</p>
                        <p className="font-mono text-xs text-white break-all">
                          {purchase.account.skillListing.toString()}
                        </p>
                      </div>
                      <div className="text-green-400 font-bold text-xl ml-4">
                        {(purchase.account.pricePaid.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                      </div>
                    </div>
                    
                    <div className="text-xs text-blue-200">
                      Purchased: {new Date(purchase.account.purchasedAt.toNumber() * 1000).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Listings Tab */}
        {activeTab === 'listings' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">📦 My Listings</h2>
            
            {!connected ? (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-6 text-center">
                <p className="text-yellow-200">Connect your wallet to view your listings</p>
              </div>
            ) : loading ? (
              <p className="text-blue-200">Loading your listings...</p>
            ) : myListings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xl text-white mb-4">No listings yet</p>
                <button
                  onClick={() => setActiveTab('publish')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  Publish a Skill →
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {myListings.map((listing, idx) => (
                  <div key={idx} className="bg-black/30 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold text-white">{listing.account.name}</h3>
                      <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded">Your Skill</span>
                    </div>
                    
                    <p className="text-blue-200 text-sm mb-4">{listing.account.description}</p>
                    
                    <div className="mb-4 bg-black/20 rounded p-3">
                      <div className="text-blue-200 text-xs mb-1">📄 Skill Address</div>
                      <div className="font-mono text-xs text-white break-all">
                        {listing.publicKey.toString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-black/20 rounded p-3 text-center">
                        <div className="text-blue-200 text-xs">Price</div>
                        <div className="text-green-400 font-bold">
                          {(listing.account.priceLamports.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-black/20 rounded p-3 text-center">
                        <div className="text-blue-200 text-xs">Downloads</div>
                        <div className="text-white font-bold">{listing.account.totalDownloads.toNumber()}</div>
                      </div>
                      <div className="bg-black/20 rounded p-3 text-center">
                        <div className="text-blue-200 text-xs">Revenue</div>
                        <div className="text-green-400 font-bold">
                          {(listing.account.totalRevenue.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Messages */}
        {status && (
          <div className={`mt-6 backdrop-blur-lg rounded-lg p-4 ${
            status.includes('Error')
              ? 'bg-red-900/30 border border-red-400/50'
              : 'bg-green-900/30 border border-green-400/50'
          }`}>
            <p className={`font-mono text-sm break-all ${
              status.includes('Error')
                ? 'text-red-200'
                : 'text-green-200'
            }`}>{status}</p>
          </div>
        )}

        {/* How It Works */}
        <div className="mt-12 bg-blue-900/30 backdrop-blur-lg rounded-lg p-8 border border-blue-400/30">
          <h2 className="text-2xl font-bold text-white mb-6">How the Marketplace Works</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">💰 Revenue Sharing</h3>
              <p className="text-blue-200 mb-3">
                Every skill purchase splits revenue:
              </p>
              <ul className="space-y-2 text-blue-100 text-sm">
                <li>• <strong>60% to author</strong> (you earn from your work)</li>
                <li>• <strong>40% to vouchers</strong> (distributed by stake weight)</li>
                <li>• Creates passive income for vouchers</li>
                <li>• Incentivizes quality vouching</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white mb-3">🛡️ Security Through Economics</h3>
              <p className="text-blue-200 mb-3">
                Vouchers have skin in the game:
              </p>
              <ul className="space-y-2 text-blue-100 text-sm">
                <li>• Earn passive income from quality skills</li>
                <li>• Lose stake if vouching for bad actors</li>
                <li>• Economic incentive to vouch wisely</li>
                <li>• Self-policing marketplace</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
