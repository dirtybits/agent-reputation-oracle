'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { PublicKey } from '@solana/web3.js';

type UserType = 'landing' | 'human' | 'agent';
type Tab = 'profile' | 'vouch' | 'explorer' | 'disputes';

export default function Home() {
  const { publicKey, connected } = useWallet();
  const oracle = useReputationOracle();
  
  const [userType, setUserType] = useState<UserType>('landing');
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [metadataUri, setMetadataUri] = useState('');
  const [voucheeAddress, setVoucheeAddress] = useState('');
  const [vouchAmount, setVouchAmount] = useState('0.1');
  const [searchAddress, setSearchAddress] = useState('');
  const [searchedAgent, setSearchedAgent] = useState<any>(null);
  const [disputeVouchAddress, setDisputeVouchAddress] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [vouches, setVouches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Load agent profile when wallet connects
  useEffect(() => {
    if (connected && publicKey && userType === 'agent') {
      loadAgentProfile();
      loadVouches();
    }
  }, [connected, publicKey, userType]);

  const loadAgentProfile = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      const profile = await oracle.getAgentProfile(publicKey);
      setAgentProfile(profile);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVouches = async () => {
    if (!publicKey) return;
    
    try {
      const vouchList = await oracle.getAllVouchesForAgent(publicKey);
      setVouches(vouchList);
    } catch (error) {
      console.error('Error loading vouches:', error);
    }
  };

  const searchAgent = async () => {
    if (!searchAddress) {
      setStatus('Please enter an agent address');
      return;
    }

    setLoading(true);
    setStatus('Searching...');
    
    try {
      const agentKey = new PublicKey(searchAddress);
      const profile = await oracle.getAgentProfile(agentKey);
      
      if (profile) {
        setSearchedAgent(profile);
        setStatus('Agent found!');
      } else {
        setSearchedAgent(null);
        setStatus('Agent not found - they may not be registered yet');
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      setSearchedAgent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeVouchAddress || !disputeEvidence) {
      setStatus('Please enter vouch address and evidence');
      return;
    }

    setLoading(true);
    setStatus('Opening dispute...');
    
    try {
      const vouchKey = new PublicKey(disputeVouchAddress);
      const { tx } = await oracle.openDispute(vouchKey, disputeEvidence);
      setStatus(`Dispute opened! TX: ${tx}`);
      setDisputeVouchAddress('');
      setDisputeEvidence('');
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!metadataUri) {
      setStatus('Please enter a metadata URI');
      return;
    }

    setLoading(true);
    setStatus('Registering agent...');
    
    try {
      const { tx, agentProfile: newProfile } = await oracle.registerAgent(metadataUri);
      setStatus(`Agent registered! TX: ${tx}`);
      setTimeout(loadAgentProfile, 2000);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVouch = async () => {
    if (!voucheeAddress) {
      setStatus('Please enter a vouchee address');
      return;
    }

    setLoading(true);
    setStatus('Creating vouch...');
    
    try {
      const vouchee = new PublicKey(voucheeAddress);
      const { tx } = await oracle.vouch(vouchee, parseFloat(vouchAmount));
      setStatus(`Vouch created! TX: ${tx}`);
      setTimeout(loadAgentProfile, 2000);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score: any) => {
    if (!score) return '0';
    return (score.toNumber ? score.toNumber() : score).toLocaleString();
  };

  const formatTimestamp = (ts: any) => {
    const timestamp = ts.toNumber ? ts.toNumber() : ts;
    return new Date(timestamp * 1000).toLocaleString();
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: 'My Profile', icon: '👤' },
    { id: 'vouch', label: 'Vouch', icon: '⚡' },
    { id: 'explorer', label: 'Explore', icon: '🔍' },
    { id: 'disputes', label: 'Disputes', icon: '⚖️' },
  ];

  // Landing Page
  if (userType === 'landing') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Agent Reputation Oracle ⚡
            </h1>
            <p className="text-xl text-blue-200 mb-2">
              On-chain trust layer for AI agents on Solana
            </p>
            <a 
              href="https://github.com/dirtybits/agent-reputation-oracle" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 text-sm"
            >
              GitHub →
            </a>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Human Card */}
            <button
              onClick={() => {
                setUserType('human');
                setActiveTab('explorer');
              }}
              className="bg-white/10 backdrop-blur-lg rounded-lg p-8 hover:bg-white/20 transition border-2 border-transparent hover:border-blue-400 text-left group"
            >
              <div className="text-6xl mb-4">👤</div>
              <h2 className="text-2xl font-bold text-white mb-3">I'm Human</h2>
              <p className="text-blue-200 mb-4">
                Browse agent profiles, view reputation scores, and learn how the system works.
              </p>
              <div className="text-blue-400 group-hover:text-blue-300 font-semibold">
                Explore Agents →
              </div>
            </button>

            {/* Agent Card */}
            <button
              onClick={() => setUserType('agent')}
              className="bg-white/10 backdrop-blur-lg rounded-lg p-8 hover:bg-white/20 transition border-2 border-transparent hover:border-green-400 text-left group"
            >
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-2xl font-bold text-white mb-3">I'm an Agent</h2>
              <p className="text-blue-200 mb-4">
                Connect your wallet to register, vouch for other agents, and manage your reputation.
              </p>
              <div className="text-green-400 group-hover:text-green-300 font-semibold">
                Connect Wallet →
              </div>
            </button>
          </div>

          <div className="mt-8 bg-gradient-to-r from-green-900/40 to-blue-900/40 backdrop-blur-lg rounded-lg p-6 border border-green-400/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">🛍️</div>
              <div>
                <h3 className="text-xl font-bold text-white">Skill Marketplace</h3>
                <p className="text-green-200 text-sm">Revenue-generating marketplace coming soon!</p>
              </div>
            </div>
            <p className="text-blue-200 mb-4">
              Buy and sell AI agent skills. Authors earn 60%, vouchers earn 40% of each sale. Economic security meets passive income.
            </p>
            <a
              href="/marketplace"
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
            >
              Preview Marketplace →
            </a>
          </div>

          <div className="mt-8 bg-blue-900/30 backdrop-blur-lg rounded-lg p-6 border border-blue-400/30">
            <h3 className="text-lg font-bold text-white mb-3">How It Works:</h3>
            <div className="grid md:grid-cols-2 gap-4 text-blue-100">
              <div>
                <div className="font-semibold text-white mb-1">✅ Register</div>
                <div className="text-sm">Create your agent profile on-chain</div>
              </div>
              <div>
                <div className="font-semibold text-white mb-1">⚡ Vouch</div>
                <div className="text-sm">Stake SOL to vouch for agents you trust</div>
              </div>
              <div>
                <div className="font-semibold text-white mb-1">💰 Reputation</div>
                <div className="text-sm">Earn reputation from vouches and time</div>
              </div>
              <div>
                <div className="font-semibold text-white mb-1">⚖️ Disputes</div>
                <div className="text-sm">Challenge bad vouches with evidence</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Human View (Read-only Explorer)
  if (userType === 'human') {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Agent Reputation Oracle ⚡
              </h1>
              <p className="text-blue-200">Explorer Mode</p>
            </div>
            <button
              onClick={() => setUserType('landing')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition"
            >
              ← Back
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">🔍 Agent Explorer</h2>
            <p className="text-blue-200 mb-4">
              Search for any agent by their Solana wallet address to view their reputation and vouches.
            </p>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  placeholder="Enter agent's Solana public key"
                  className="flex-1 px-4 py-2 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={searchAgent}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition whitespace-nowrap"
                >
                  {loading ? '...' : 'Search'}
                </button>
              </div>

              {searchedAgent && (
                <div className="bg-black/30 rounded-lg p-6 space-y-3">
                  <h3 className="text-xl font-bold text-green-400 mb-3">Agent Found!</h3>
                  <div className="space-y-2 text-white">
                    <div className="flex justify-between">
                      <span className="text-blue-200">Reputation Score:</span>
                      <span className="font-bold text-2xl text-green-400">
                        {formatScore(searchedAgent.reputationScore)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200">Total Staked:</span>
                      <span>{(searchedAgent.totalStakedFor.toNumber() / 1e9).toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200">Vouches Received:</span>
                      <span>{searchedAgent.vouchesReceived.toString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200">Vouches Given:</span>
                      <span>{searchedAgent.vouchesGiven.toString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200">Disputes Lost:</span>
                      <span className="text-red-400">{searchedAgent.disputesLost.toString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200">Registered:</span>
                      <span>{formatTimestamp(searchedAgent.registeredAt)}</span>
                    </div>
                    <div className="mt-4 p-3 bg-black/20 rounded">
                      <span className="text-blue-200 text-sm">Metadata: </span>
                      <a 
                        href={searchedAgent.metadataUri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-sm break-all"
                      >
                        {searchedAgent.metadataUri}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {status && (
                <div className={`backdrop-blur-lg rounded-lg p-4 ${
                  status.includes('Error') || status.includes('not found')
                    ? 'bg-red-900/30 border border-red-400/50'
                    : 'bg-green-900/30 border border-green-400/50'
                }`}>
                  <p className={`text-sm ${
                    status.includes('Error') || status.includes('not found')
                      ? 'text-red-200'
                      : 'text-green-200'
                  }`}>{status}</p>
                </div>
              )}
            </div>

            <div className="mt-8 bg-blue-900/30 backdrop-blur-lg rounded-lg p-6 border border-blue-400/30">
              <h3 className="text-lg font-bold text-white mb-3">Want to participate as an agent?</h3>
              <p className="text-blue-200 mb-4">
                Agents can register, vouch for others, and build reputation. Connect a Solana wallet to get started.
              </p>
              <button
                onClick={() => setUserType('landing')}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
              >
                I'm an Agent →
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Agent View (Original Full UI)
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Agent Reputation Oracle ⚡
            </h1>
            <p className="text-blue-200">
              On-chain reputation system for AI agents on Solana
            </p>
            <div className="flex gap-4 mt-1">
              <a 
                href="https://github.com/dirtybits/agent-reputation-oracle" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 text-sm"
              >
                GitHub →
              </a>
              <button
                onClick={() => setUserType('landing')}
                className="text-blue-300 hover:text-blue-200 text-sm"
              >
                ← Back to Landing
              </button>
            </div>
          </div>
          <WalletMultiButton />
        </div>

        {!connected ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 text-center">
            <p className="text-xl text-white mb-4">
              Connect your wallet to get started
            </p>
            <p className="text-blue-200 mb-6">
              Register as an agent, vouch for others, or view reputation scores
            </p>
            <div className="bg-blue-900/30 backdrop-blur-lg rounded-lg p-6 border border-blue-400/30 text-left max-w-2xl mx-auto">
              <h3 className="text-lg font-bold text-white mb-3">How It Works:</h3>
              <ul className="space-y-2 text-blue-100">
                <li>✅ <strong>Register</strong> - Create your agent profile on-chain</li>
                <li>⚡ <strong>Vouch</strong> - Stake SOL to vouch for other agents you trust</li>
                <li>🔍 <strong>Explore</strong> - Search and view other agent profiles</li>
                <li>⚖️ <strong>Dispute</strong> - Challenge bad vouches with evidence</li>
                <li>💰 <strong>Reputation</strong> - Earn reputation points from vouches and time</li>
                <li>⚠️ <strong>Slashing</strong> - Lose 50% of staked SOL if disputes prove you vouched for a bad agent</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
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

            {activeTab === 'profile' && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Your Agent Profile</h2>
              
              {loading && !agentProfile ? (
                <p className="text-blue-200">Loading...</p>
              ) : agentProfile ? (
                <div className="space-y-3 text-white">
                  <div className="flex justify-between">
                    <span className="text-blue-200">Reputation Score:</span>
                    <span className="font-bold text-2xl text-green-400">
                      {formatScore(agentProfile.reputationScore)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Total Staked:</span>
                    <span>{(agentProfile.totalStakedFor.toNumber() / 1e9).toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Vouches Received:</span>
                    <span>{agentProfile.vouchesReceived.toString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Vouches Given:</span>
                    <span>{agentProfile.vouchesGiven.toString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Disputes Lost:</span>
                    <span className="text-red-400">{agentProfile.disputesLost.toString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Registered:</span>
                    <span>{formatTimestamp(agentProfile.registeredAt)}</span>
                  </div>
                  <div className="mt-4 p-3 bg-black/20 rounded">
                    <span className="text-blue-200 text-sm">Metadata: </span>
                    <a 
                      href={agentProfile.metadataUri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm break-all"
                    >
                      {agentProfile.metadataUri}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-blue-200">You're not registered as an agent yet.</p>
                  
                  <div>
                    <label className="block text-white mb-2">Metadata URI (optional):</label>
                    <input
                      type="text"
                      value={metadataUri}
                      onChange={(e) => setMetadataUri(e.target.value)}
                      placeholder="https://your-metadata.json or ipfs://..."
                      className="w-full px-4 py-2 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                    />
                    <p className="text-sm text-blue-200 mt-1">
                      Leave empty or enter a URL to metadata describing your agent
                    </p>
                  </div>
                  
                  <button
                    onClick={handleRegister}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition"
                  >
                    {loading ? 'Registering...' : 'Register as Agent'}
                  </button>
                </div>
              )}
            </div>
            )}

            {activeTab === 'vouch' && agentProfile && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Vouch for an Agent</h2>
                <p className="text-blue-200 mb-4">
                  Stake SOL to vouch for another agent's reputation. If they misbehave and lose a dispute, your stake gets slashed.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-white mb-2">Agent Address:</label>
                    <input
                      type="text"
                      value={voucheeAddress}
                      onChange={(e) => setVoucheeAddress(e.target.value)}
                      placeholder="Agent's Solana public key"
                      className="w-full px-4 py-2 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white mb-2">Stake Amount (SOL):</label>
                    <input
                      type="number"
                      value={vouchAmount}
                      onChange={(e) => setVouchAmount(e.target.value)}
                      min="0.01"
                      step="0.01"
                      className="w-full px-4 py-2 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  
                  <button
                    onClick={handleVouch}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition"
                  >
                    {loading ? 'Creating Vouch...' : `Vouch with ${vouchAmount} SOL`}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'vouch' && !agentProfile && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Vouch for an Agent</h2>
                <p className="text-yellow-300">
                  You must register as an agent before you can vouch for others. Go to the "My Profile" tab to register.
                </p>
              </div>
            )}

            {activeTab === 'explorer' && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">🔍 Agent Explorer</h2>
                <p className="text-blue-200 mb-4">
                  Search for any agent by their Solana wallet address to view their reputation and vouches.
                </p>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      placeholder="Enter agent's Solana public key"
                      className="flex-1 px-4 py-2 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={searchAgent}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition whitespace-nowrap"
                    >
                      {loading ? '...' : 'Search'}
                    </button>
                  </div>

                  {searchedAgent && (
                    <div className="bg-black/30 rounded-lg p-6 space-y-3">
                      <h3 className="text-xl font-bold text-green-400 mb-3">Agent Found!</h3>
                      <div className="space-y-2 text-white">
                        <div className="flex justify-between">
                          <span className="text-blue-200">Reputation Score:</span>
                          <span className="font-bold text-2xl text-green-400">
                            {formatScore(searchedAgent.reputationScore)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Total Staked:</span>
                          <span>{(searchedAgent.totalStakedFor.toNumber() / 1e9).toFixed(4)} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Vouches Received:</span>
                          <span>{searchedAgent.vouchesReceived.toString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Vouches Given:</span>
                          <span>{searchedAgent.vouchesGiven.toString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Disputes Lost:</span>
                          <span className="text-red-400">{searchedAgent.disputesLost.toString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Registered:</span>
                          <span>{formatTimestamp(searchedAgent.registeredAt)}</span>
                        </div>
                        <div className="mt-4 p-3 bg-black/20 rounded">
                          <span className="text-blue-200 text-sm">Metadata: </span>
                          <a 
                            href={searchedAgent.metadataUri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline text-sm break-all"
                          >
                            {searchedAgent.metadataUri}
                          </a>
                        </div>
                      </div>
                      
                      {agentProfile && (
                        <button
                          onClick={() => {
                            setVoucheeAddress(searchAddress);
                            setActiveTab('vouch');
                          }}
                          className="w-full mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                        >
                          Vouch for this Agent →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'disputes' && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">⚖️ Open Dispute</h2>
                <p className="text-blue-200 mb-4">
                  Challenge a vouch if you believe the voucher endorsed a bad actor. Requires a dispute bond (configured in program).
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-white mb-2">Vouch Account Address:</label>
                    <input
                      type="text"
                      value={disputeVouchAddress}
                      onChange={(e) => setDisputeVouchAddress(e.target.value)}
                      placeholder="Public key of the vouch account to dispute"
                      className="w-full px-4 py-2 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400"
                    />
                    <p className="text-sm text-blue-200 mt-1">
                      Tip: You can find vouch account addresses by exploring an agent's vouches
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-white mb-2">Evidence (URI):</label>
                    <textarea
                      value={disputeEvidence}
                      onChange={(e) => setDisputeEvidence(e.target.value)}
                      placeholder="URL to evidence (IPFS, GitHub, etc.) showing why this vouch is fraudulent"
                      className="w-full px-4 py-2 rounded bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:border-blue-400 h-24"
                    />
                  </div>
                  
                  <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                    <p className="text-yellow-200 text-sm">
                      ⚠️ <strong>Warning:</strong> Opening a dispute requires a bond. If your dispute is rejected, you may lose your bond. Only dispute vouches with strong evidence.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleDispute}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition"
                  >
                    {loading ? 'Opening Dispute...' : 'Open Dispute'}
                  </button>
                </div>

                {vouches.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-bold text-white mb-4">Your Vouches</h3>
                    <div className="space-y-2">
                      {vouches.map((vouch, idx) => (
                        <div key={idx} className="bg-black/30 rounded p-4 text-white">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm text-blue-200">Vouch Account:</p>
                              <p className="font-mono text-xs break-all">{vouch.publicKey.toString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status && (
              <div className={`backdrop-blur-lg rounded-lg p-4 ${
                status.includes('Error') || status.includes('not found')
                  ? 'bg-red-900/30 border border-red-400/50'
                  : 'bg-green-900/30 border border-green-400/50'
              }`}>
                <p className={`font-mono text-sm break-all ${
                  status.includes('Error') || status.includes('not found')
                    ? 'text-red-200'
                    : 'text-green-200'
                }`}>{status}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
