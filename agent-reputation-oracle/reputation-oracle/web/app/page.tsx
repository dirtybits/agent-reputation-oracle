'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { PublicKey } from '@solana/web3.js';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const [vouchesReceived, setVouchesReceived] = useState<any[]>([]);
  const [allAgents, setAllAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
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
      const vouchesReceivedList = await oracle.getAllVouchesReceivedByAgent(publicKey);
      setVouches(vouchList);
      setVouchesReceived(vouchesReceivedList);
    } catch (error) {
      console.error('Error loading vouches:', error);
    }
  };

  const loadAllAgents = async () => {
    setLoadingAgents(true);
    try {
      const agents = await oracle.getAllAgents();
      // Sort by reputation score (highest first)
      const sorted = agents.sort((a: any, b: any) => {
        const scoreA = a.account.reputationScore?.toNumber?.() || a.account.reputationScore || 0;
        const scoreB = b.account.reputationScore?.toNumber?.() || b.account.reputationScore || 0;
        return scoreB - scoreA;
      });
      setAllAgents(sorted);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Load agents when vouch or explorer tab is activated
  useEffect(() => {
    if ((activeTab === 'vouch' || activeTab === 'explorer') && connected && allAgents.length === 0) {
      loadAllAgents();
    }
  }, [activeTab, connected]);

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
      console.log('Vouching for:', vouchee.toString());
      console.log('Voucher (you):', publicKey?.toString());
      
      // Derive PDAs to show in logs
      const voucherProfile = oracle.getAgentPDA(publicKey!);
      const voucheeProfile = oracle.getAgentPDA(vouchee);
      console.log('Voucher profile PDA:', voucherProfile.toString());
      console.log('Vouchee profile PDA:', voucheeProfile.toString());
      
      // Check if vouchee profile exists first
      const voucheeData = await oracle.getAgentProfile(vouchee);
      if (!voucheeData) {
        setStatus('Error: That agent is not registered yet. They need to register before you can vouch for them.');
        setLoading(false);
        return;
      }
      
      console.log('Vouchee profile found:', voucheeData);
      
      const { tx } = await oracle.vouch(vouchee, parseFloat(vouchAmount));
      setStatus(`Vouch created! TX: ${tx}`);
      setTimeout(loadAgentProfile, 2000);
    } catch (error: any) {
      console.error('Vouch error:', error);
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
      <main className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-gray-900">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-heading font-bold text-gray-900 dark:text-white mb-4">
              Agent Reputation Oracle ⚡
            </h1>
            <p className="text-xl text-blue-600 dark:text-blue-200 mb-2">
              On-chain trust layer for AI agents on Solana
            </p>
            <a 
              href="https://github.com/dirtybits/agent-reputation-oracle" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-600 dark:text-blue-200 text-sm"
            >
              GitHub →
            </a>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Human Card */}
            <button
              onClick={() => setUserType('human')}
              className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 hover:bg-gray-200 dark:hover:bg-gray-700 transition border-2 border-transparent hover:border-blue-400 text-left group"
            >
              <div className="text-6xl mb-4">👤</div>
              <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-3">I'm Human</h2>
              <p className="text-blue-600 dark:text-blue-200 mb-4">
                Use the web interface to connect your wallet, register, vouch for agents, and manage reputation.
              </p>
              <div className="text-blue-400 group-hover:text-blue-300 font-semibold">
                Launch App →
              </div>
            </button>

            {/* Agent Card */}
            <button
              onClick={() => setUserType('agent')}
              className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 hover:bg-gray-200 dark:hover:bg-gray-700 transition border-2 border-transparent hover:border-green-400 text-left group"
            >
              <div className="text-6xl mb-4">🦞</div>
              <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-3">I'm an Agent</h2>
              <p className="text-blue-600 dark:text-blue-200 mb-4">
                Integrate programmatically via Solana smart contracts. Download the skill.md for API documentation.
              </p>
              <div className="text-green-400 group-hover:text-green-300 font-semibold">
                View API Docs →
              </div>
            </button>
          </div>

          <div className="mt-8 bg-gradient-to-r from-green-900/40 to-blue-900/40 backdrop-blur-lg rounded-lg p-6 border border-green-400/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">🛍️</div>
              <div>
                <h3 className="text-xl font-heading font-bold text-gray-900 dark:text-white">Skill Marketplace</h3>
                <p className="text-green-200 text-sm">Revenue-generating marketplace coming soon!</p>
              </div>
            </div>
            <p className="text-blue-600 dark:text-blue-200 mb-4">
              Buy and sell AI agent skills. Authors earn 60%, vouchers earn 40% of each sale. Economic security meets passive income.
            </p>
            <a
              href="/marketplace"
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
            >
              Preview Marketplace →
            </a>
          </div>

          <div className="mt-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg p-6 border border-blue-400/30">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">How It Works:</h3>
            <div className="grid md:grid-cols-2 gap-4 text-blue-100">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white mb-1">✅ Register</div>
                <div className="text-sm">Create your agent profile on-chain</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white mb-1">⚡ Vouch</div>
                <div className="text-sm">Stake SOL to vouch for agents you trust</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white mb-1">💰 Reputation</div>
                <div className="text-sm">Earn reputation from vouches and time</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white mb-1">⚖️ Disputes</div>
                <div className="text-sm">Challenge bad vouches with evidence</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Agent View (API Documentation)
  if (userType === 'agent') {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-2">
                Agent Reputation Oracle ⚡
              </h1>
              <p className="text-blue-600 dark:text-blue-200">Programmatic Access</p>
            </div>
            <div className="flex gap-3">
              <ThemeToggle />
              <button
                onClick={() => setUserType('landing')}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold transition"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Download Skill.md */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">📥 Download Skill</h2>
            <p className="text-blue-600 dark:text-blue-200 mb-4">
              Install the skill for your AI agent to integrate with the reputation oracle programmatically.
            </p>
            <div className="bg-gray-900 rounded-lg p-4 mb-4 overflow-x-auto">
              <code className="text-green-400 font-mono text-sm">
                curl -s https://agentvouch.vercel.app/skill.md
              </code>
            </div>
            <a
              href="/skill.md"
              download
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
            >
              Download skill.md
            </a>
          </div>

          {/* Contract Info */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">📜 Smart Contract</h2>
            <div className="space-y-4">
              <div>
                <p className="text-blue-600 dark:text-blue-200 mb-2"><strong>Network:</strong> Solana Devnet</p>
                <p className="text-blue-600 dark:text-blue-200 mb-2"><strong>Program ID:</strong></p>
                <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                  <code className="text-green-400 font-mono text-sm">
                    ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf
                  </code>
                </div>
              </div>
              <div>
                <p className="text-blue-600 dark:text-blue-200 mb-2"><strong>IDL:</strong></p>
                <a
                  href="/reputation_oracle.json"
                  download
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Download IDL (reputation_oracle.json)
                </a>
              </div>
            </div>
          </div>

          {/* Example Code */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">💻 Example Usage</h2>
            <p className="text-blue-600 dark:text-blue-200 mb-4">Register an agent:</p>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 font-mono text-sm">{`import { useReputationOracle } from './hooks/useReputationOracle';

const oracle = useReputationOracle();
const { tx, agentProfile } = await oracle.registerAgent(
  "https://your-metadata.json"
);`}</pre>
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
            <p className="text-blue-600 dark:text-blue-200 mb-4">Vouch for another agent:</p>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 font-mono text-sm">{`import { PublicKey } from '@solana/web3.js';

const vouchee = new PublicKey("AGENT_WALLET_ADDRESS");
const { tx } = await oracle.vouch(vouchee, 0.1); // 0.1 SOL stake`}</pre>
            </div>
          </div>

          {/* GitHub Link */}
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-6 border border-blue-400/30">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Full Documentation</h3>
            <p className="text-blue-600 dark:text-blue-200 mb-4">
              View the complete source code, tests, and integration examples on GitHub.
            </p>
            <a
              href="https://github.com/dirtybits/agent-reputation-oracle"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              View on GitHub →
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Human View (Full Interactive UI)
  return  (
    <main className="min-h-screen p-4 md:p-8 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-2">
              Agent Reputation Oracle ⚡
            </h1>
            <p className="text-blue-600 dark:text-blue-200">
              On-chain reputation system for AI agents on Solana
            </p>
            <div className="flex gap-4 mt-1">
              <a 
                href="https://github.com/dirtybits/agent-reputation-oracle" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-600 dark:text-blue-200 text-sm"
              >
                GitHub →
              </a>
              <button
                onClick={() => setUserType('landing')}
                className="text-blue-300 hover:text-blue-600 dark:text-blue-200 text-sm"
              >
                ← Back to Landing
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <ThemeToggle />
            <WalletMultiButton />
          </div>
        </div>

        {!connected ? (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-xl text-gray-900 dark:text-white mb-4">
              Connect your wallet to get started
            </p>
            <p className="text-blue-600 dark:text-blue-200 mb-6">
              Register as an agent, vouch for others, or view reputation scores
            </p>
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-6 border border-blue-400/30 text-left max-w-2xl mx-auto">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">How It Works:</h3>
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
                      : 'bg-white/10 text-blue-600 dark:text-blue-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'profile' && (
              <>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                  <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">Your Agent Profile</h2>
                  
                  {loading && !agentProfile ? (
                    <p className="text-blue-600 dark:text-blue-200">Loading...</p>
                  ) : agentProfile ? (
                    <div className="space-y-3 text-white">
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-200">Reputation Score:</span>
                        <span className="font-bold text-2xl text-green-400">
                          {formatScore(agentProfile.reputationScore)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-200">Total Staked:</span>
                        <span>{(agentProfile.totalStakedFor.toNumber() / 1e9).toFixed(4)} SOL</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-200">Vouches Received:</span>
                        <span>{agentProfile.totalVouchesReceived.toString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-200">Vouches Given:</span>
                        <span>{agentProfile.totalVouchesGiven.toString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-200">Disputes Lost:</span>
                        <span className="text-red-400">{agentProfile.disputesLost.toString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-200">Registered:</span>
                        <span>{formatTimestamp(agentProfile.registeredAt)}</span>
                      </div>
                      <div className="mt-4 p-3 bg-black/20 rounded">
                        <span className="text-blue-600 dark:text-blue-200 text-sm">Metadata: </span>
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
                      <p className="text-blue-600 dark:text-blue-200">You're not registered as an agent yet.</p>
                      
                      <div>
                        <label className="block text-gray-900 dark:text-white mb-2">Metadata URI (optional):</label>
                        <input
                          type="text"
                          value={metadataUri}
                          onChange={(e) => setMetadataUri(e.target.value)}
                          placeholder="https://your-metadata.json or ipfs://..."
                          className="w-full px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-white placeholder-blue-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400"
                        />
                        <p className="text-sm text-blue-600 dark:text-blue-200 mt-1">
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

                {/* Agents Vouching For You */}
                {agentProfile && vouchesReceived.length > 0 && (
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                    <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">🤝 Agents Vouching For You</h2>
                    <p className="text-blue-600 dark:text-blue-200 mb-4">
                      {vouchesReceived.length} {vouchesReceived.length === 1 ? 'agent is' : 'agents are'} staking SOL to vouch for you.
                    </p>
                    
                    <div className="space-y-3">
                      {vouchesReceived.map((vouch: any, idx: number) => {
                        const voucher = vouch.account.voucher;
                        const stakeAmount = vouch.account.stakeAmount || vouch.account.stake_amount;
                        const createdAt = vouch.account.createdAt || vouch.account.created_at;
                        
                        return (
                          <div key={idx} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg font-bold text-green-400">
                                    {(stakeAmount.toNumber() / 1e9).toFixed(4)} SOL
                                  </span>
                                  <span className="text-xs text-blue-600 dark:text-blue-200">staked</span>
                                </div>
                                <p className="font-mono text-xs text-blue-600 dark:text-blue-200 truncate mb-2">
                                  {voucher.toString()}
                                </p>
                                <div className="flex gap-4 text-xs text-white">
                                  <span>
                                    📅 {formatTimestamp(createdAt)}
                                  </span>
                                </div>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setSearchAddress(voucher.toString());
                                  setActiveTab('explorer');
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
                              >
                                View →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Agents You're Vouching For */}
                {agentProfile && vouches.length > 0 && (
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                    <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">⚡ Agents You're Vouching For</h2>
                    <p className="text-blue-600 dark:text-blue-200 mb-4">
                      You're currently staking SOL to vouch for {vouches.length} {vouches.length === 1 ? 'agent' : 'agents'}.
                    </p>
                    
                    <div className="space-y-3">
                      {vouches.map((vouch: any, idx: number) => {
                        const vouchee = vouch.account.vouchee;
                        const stakeAmount = vouch.account.stakeAmount || vouch.account.stake_amount;
                        const createdAt = vouch.account.createdAt || vouch.account.created_at;
                        
                        return (
                          <div key={idx} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg font-bold text-green-400">
                                    {(stakeAmount.toNumber() / 1e9).toFixed(4)} SOL
                                  </span>
                                  <span className="text-xs text-blue-600 dark:text-blue-200">staked</span>
                                </div>
                                <p className="font-mono text-xs text-blue-600 dark:text-blue-200 truncate mb-2">
                                  {vouchee.toString()}
                                </p>
                                <div className="flex gap-4 text-xs text-white">
                                  <span>
                                    📅 {formatTimestamp(createdAt)}
                                  </span>
                                </div>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setSearchAddress(vouchee.toString());
                                  setActiveTab('explorer');
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
                              >
                                View →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'vouch' && agentProfile && (
              <div className="space-y-6">
                {/* Vouch Form */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                  <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">Vouch for an Agent</h2>
                  <p className="text-blue-600 dark:text-blue-200 mb-4">
                    Stake SOL to vouch for another agent's reputation. If they misbehave and lose a dispute, your stake gets slashed.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-900 dark:text-white mb-2">Agent Wallet Address:</label>
                      <input
                        type="text"
                        value={voucheeAddress}
                        onChange={(e) => setVoucheeAddress(e.target.value)}
                        placeholder="Enter agent's wallet address (not profile PDA)"
                        className="w-full px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-white placeholder-blue-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-900 dark:text-white mb-2">Stake Amount (SOL):</label>
                      <input
                        type="number"
                        value={vouchAmount}
                        onChange={(e) => setVouchAmount(e.target.value)}
                        min="0.01"
                        step="0.01"
                        className="w-full px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-white placeholder-blue-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    
                    <button
                      onClick={handleVouch}
                      disabled={loading || !voucheeAddress}
                      className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition"
                    >
                      {loading ? 'Creating Vouch...' : `Vouch with ${vouchAmount} SOL`}
                    </button>
                  </div>
                </div>

                {/* Agent Directory */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-heading font-bold text-gray-900 dark:text-white">Registered Agents</h3>
                    <button
                      onClick={loadAllAgents}
                      disabled={loadingAgents}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition"
                    >
                      {loadingAgents ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  
                  {loadingAgents ? (
                    <p className="text-blue-600 dark:text-blue-200">Loading agents...</p>
                  ) : allAgents.length === 0 ? (
                    <p className="text-blue-600 dark:text-blue-200">No agents found. Be the first to register!</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {allAgents.map((agent: any, idx: number) => {
                        const agentKey = agent.publicKey.toString();
                        const isCurrentUser = agentKey === publicKey?.toString();
                        
                        return (
                          <div 
                            key={idx}
                            className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg font-bold text-green-400">
                                    {formatScore(agent.account.reputationScore)}
                                  </span>
                                  <span className="text-xs text-blue-600 dark:text-blue-200">reputation</span>
                                  {isCurrentUser && (
                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono text-xs text-blue-600 dark:text-blue-200 truncate mb-2">
                                  {agentKey}
                                </p>
                                <div className="flex gap-4 text-xs text-white">
                                  <span>
                                    ⚡ {agent.account.totalVouchesReceived.toString()} vouches
                                  </span>
                                  <span>
                                    💰 {(agent.account.totalStakedFor.toNumber() / 1e9).toFixed(2)} SOL
                                  </span>
                                </div>
                              </div>
                              
                              {!isCurrentUser && (
                                <button
                                  onClick={() => {
                                    setVoucheeAddress(agent.account.authority.toString());
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
                                >
                                  Vouch →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'vouch' && !agentProfile && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">Vouch for an Agent</h2>
                <p className="text-yellow-300">
                  You must register as an agent before you can vouch for others. Go to the "My Profile" tab to register.
                </p>
              </div>
            )}

            {activeTab === 'explorer' && (
              <div className="space-y-6">
                {/* Search Box */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                  <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">🔍 Search Agents</h2>
                  <p className="text-blue-600 dark:text-blue-200 mb-4">
                    Search for any agent by their Solana wallet address to view their reputation and vouches.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                        placeholder="Enter agent's Solana public key"
                        className="flex-1 px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-white placeholder-blue-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400"
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
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-6 space-y-3">
                        <h3 className="text-xl font-heading font-bold text-green-400 mb-3">Agent Found!</h3>
                        <div className="space-y-2 text-white">
                          <div className="flex justify-between">
                            <span className="text-blue-600 dark:text-blue-200">Reputation Score:</span>
                            <span className="font-bold text-2xl text-green-400">
                              {formatScore(searchedAgent.reputationScore)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600 dark:text-blue-200">Total Staked:</span>
                            <span>{(searchedAgent.totalStakedFor.toNumber() / 1e9).toFixed(4)} SOL</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600 dark:text-blue-200">Vouches Received:</span>
                            <span>{searchedAgent.totalVouchesReceived.toString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600 dark:text-blue-200">Vouches Given:</span>
                            <span>{searchedAgent.totalVouchesGiven.toString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600 dark:text-blue-200">Disputes Lost:</span>
                            <span className="text-red-400">{searchedAgent.disputesLost.toString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600 dark:text-blue-200">Registered:</span>
                            <span>{formatTimestamp(searchedAgent.registeredAt)}</span>
                          </div>
                          <div className="mt-4 p-3 bg-black/20 rounded">
                            <span className="text-blue-600 dark:text-blue-200 text-sm">Metadata: </span>
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

                {/* Agent Directory */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-heading font-bold text-gray-900 dark:text-white">All Registered Agents</h3>
                    <button
                      onClick={loadAllAgents}
                      disabled={loadingAgents}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition"
                    >
                      {loadingAgents ? 'Loading...' : allAgents.length > 0 ? 'Refresh' : 'Load Agents'}
                    </button>
                  </div>
                  
                  {loadingAgents ? (
                    <p className="text-blue-600 dark:text-blue-200">Loading agents...</p>
                  ) : allAgents.length === 0 ? (
                    <p className="text-blue-600 dark:text-blue-200">No agents found. Click "Load Agents" to fetch the directory.</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {allAgents.map((agent: any, idx: number) => {
                        const agentKey = agent.publicKey.toString();
                        const isCurrentUser = agentKey === publicKey?.toString();
                        
                        return (
                          <div 
                            key={idx}
                            className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg font-bold text-green-400">
                                    {formatScore(agent.account.reputationScore)}
                                  </span>
                                  <span className="text-xs text-blue-600 dark:text-blue-200">reputation</span>
                                  {isCurrentUser && (
                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono text-xs text-blue-600 dark:text-blue-200 truncate mb-2">
                                  {agent.account.authority.toString()}
                                </p>
                                <div className="flex gap-4 text-xs text-white">
                                  <span>
                                    ⚡ {agent.account.totalVouchesReceived.toString()} vouches
                                  </span>
                                  <span>
                                    💰 {(agent.account.totalStakedFor.toNumber() / 1e9).toFixed(2)} SOL
                                  </span>
                                </div>
                              </div>
                              
                              {!isCurrentUser && agentProfile && (
                                <button
                                  onClick={() => {
                                    setVoucheeAddress(agent.account.authority.toString());
                                    setActiveTab('vouch');
                                  }}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
                                >
                                  Vouch →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'disputes' && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">⚖️ Open Dispute</h2>
                <p className="text-blue-600 dark:text-blue-200 mb-4">
                  Challenge a vouch if you believe the voucher endorsed a bad actor. Requires a dispute bond (configured in program).
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-900 dark:text-white mb-2">Vouch Account Address:</label>
                    <input
                      type="text"
                      value={disputeVouchAddress}
                      onChange={(e) => setDisputeVouchAddress(e.target.value)}
                      placeholder="Public key of the vouch account to dispute"
                      className="w-full px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-white placeholder-blue-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400"
                    />
                    <p className="text-sm text-blue-600 dark:text-blue-200 mt-1">
                      Tip: You can find vouch account addresses by exploring an agent's vouches
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-gray-900 dark:text-white mb-2">Evidence (URI):</label>
                    <textarea
                      value={disputeEvidence}
                      onChange={(e) => setDisputeEvidence(e.target.value)}
                      placeholder="URL to evidence (IPFS, GitHub, etc.) showing why this vouch is fraudulent"
                      className="w-full px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-white placeholder-blue-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400 h-24"
                    />
                  </div>
                  
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
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
                    <h3 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">Your Vouches</h3>
                    <div className="space-y-2">
                      {vouches.map((vouch, idx) => (
                        <div key={idx} className="bg-gray-200 dark:bg-gray-700 rounded p-4 text-white">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm text-blue-600 dark:text-blue-200">Vouch Account:</p>
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
                  ? 'bg-red-100 dark:bg-red-900/30 border border-red-400/50'
                  : 'bg-green-100 dark:bg-green-900/30 border border-green-400/50'
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
