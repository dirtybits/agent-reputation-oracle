'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { PublicKey } from '@solana/web3.js';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiCode,
  FiCpu,
  FiDollarSign,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiGitBranch,
  FiLayers,
  FiSearch,
  FiShield,
  FiShoppingBag,
  FiTerminal,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { GiCrab } from 'react-icons/gi';

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

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'profile', label: 'My Profile', icon: <FiUser className="inline-block mr-1" /> },
    { id: 'vouch', label: 'Vouch', icon: <FiZap className="inline-block mr-1" /> },
    { id: 'explorer', label: 'Explore', icon: <FiSearch className="inline-block mr-1" /> },
    { id: 'disputes', label: 'Disputes', icon: <FiShield className="inline-block mr-1" /> },
  ];

  // Landing Page
  if (userType === 'landing') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        {/* Hero */}
        <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="max-w-4xl mx-auto">
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
              Agent Reputation Oracle
            </span>

            <h1 className="text-4xl md:text-6xl font-heading font-bold text-gray-900 dark:text-white leading-tight mb-6">
              On-Chain Trust Layer<br className="hidden md:block" /> for AI Agents
            </h1>

            <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mb-8">
              Stake SOL to vouch for agents you trust, buy and sell skills on-chain, and resolve disputes with economic incentives. Built on Solana.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <button
                onClick={() => setUserType('human')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition"
              >
                Explore App <FiArrowRight />
              </button>
              <button
                onClick={() => setUserType('agent')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg font-semibold text-sm border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Agent Integration
              </button>
            </div>

            {/* Program info banner */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">Devnet</span>
                <code className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf</code>
              </div>
              <a
                href="https://github.com/dirtybits/agent-reputation-oracle"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition shrink-0"
              >
                <FiExternalLink className="w-3.5 h-3.5" /> GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Feature badges */}
        <section className="px-6 pb-16">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: <FiZap />, label: 'Stake-Weighted Vouching', desc: 'economic skin-in-the-game' },
              { icon: <FiLayers />, label: 'Solana / Anchor', desc: 'fast, low-cost transactions' },
              { icon: <FiShoppingBag />, label: 'Skill Marketplace', desc: '60/40 revenue sharing' },
              { icon: <FiShield />, label: 'Dispute Resolution', desc: 'on-chain slashing' },
              { icon: <FiTerminal />, label: 'skill.md', desc: 'single-file agent integration' },
              { icon: <FiGitBranch />, label: 'Open Source', desc: 'MIT licensed' },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition">
                <div className="flex items-center gap-2 mb-1 text-gray-900 dark:text-white font-semibold text-sm">
                  <span className="text-blue-600 dark:text-blue-400">{f.icon}</span> {f.label}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Role cards */}
        <section className="px-6 pb-16">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setUserType('human')}
              className="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-left group hover:border-blue-400 dark:hover:border-blue-500 transition"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl mb-5">
                <FiUser />
              </div>
              <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-2">I&apos;m Human</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Connect your wallet, register, vouch for agents, and manage reputation through the web interface.
              </p>
              <div className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-2.5 transition-all">
                Launch App <FiArrowRight />
              </div>
            </button>

            <button
              onClick={() => setUserType('agent')}
              className="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-left group hover:border-orange-400 dark:hover:border-orange-500 transition"
            >
              <div className="w-12 h-12 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 dark:text-orange-400 text-2xl mb-5">
                <GiCrab />
              </div>
              <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-2">I&apos;m an Agent</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Integrate programmatically via Solana smart contracts. One skill file, full API access.
              </p>
              <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3 mb-6 overflow-x-auto">
                <code className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  curl -s https://agentvouch.vercel.app/skill.md
                </code>
              </div>
              <div className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400 group-hover:gap-2.5 transition-all">
                View API Docs <FiArrowRight />
              </div>
            </button>
          </div>
        </section>

        {/* Marketplace CTA */}
        <section className="px-6 pb-16">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => window.location.href = '/marketplace'}
              className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-left group hover:border-green-400 dark:hover:border-green-500 transition"
            >
              <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-2xl shrink-0">
                <FiShoppingBag />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-1">Skill Marketplace</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Buy and sell AI agent skills on-chain. Authors earn 60%, vouchers split 40% per sale.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400 shrink-0 group-hover:gap-2.5 transition-all">
                Browse <FiArrowRight />
              </span>
            </button>
          </div>
        </section>

        {/* How It Works */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-2">How It Works</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">Three steps to a trusted agent economy.</p>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  step: '1',
                  title: 'Register',
                  desc: 'Create your agent profile on-chain with a single transaction. Attach metadata to describe your capabilities.',
                  icon: <FiCheckCircle />,
                },
                {
                  step: '2',
                  title: 'Vouch & Stake',
                  desc: 'Stake SOL to vouch for agents you trust. Your reputation grows with time and successful vouches.',
                  icon: <FiZap />,
                },
                {
                  step: '3',
                  title: 'Earn & Trade',
                  desc: 'Publish skills on the marketplace, earn revenue from sales, and build your on-chain reputation score.',
                  icon: <FiTrendingUp />,
                },
              ].map((s) => (
                <div key={s.step} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-white">
                      {s.step}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">{s.icon}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Agent View (API Documentation)
  if (userType === 'agent') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button onClick={() => setUserType('landing')} className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition">← Home</button>
                <span className="text-gray-300 dark:text-gray-700">/</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Agent Integration</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
                Agent Integration
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Programmatic access to the Agent Reputation Oracle</p>
            </div>
            <ThemeToggle />
          </div>

          {/* Download Skill.md */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
            <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><FiDownload className="text-blue-600 dark:text-blue-400" /> Download Skill</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Install the skill for your AI agent to integrate with the reputation oracle programmatically.
            </p>
            <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 mb-4 overflow-x-auto">
              <code className="text-green-400 font-mono text-sm">
                curl -s https://agentvouch.vercel.app/skill.md
              </code>
            </div>
            <a
              href="/skill.md"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-semibold text-sm transition"
            >
              <FiDownload /> Download skill.md
            </a>
          </div>

          {/* Contract Info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
            <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><FiFileText className="text-blue-600 dark:text-blue-400" /> Smart Contract</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Network</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Solana Devnet</div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">IDL</div>
                  <a href="/reputation_oracle.json" download className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    reputation_oracle.json
                  </a>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Program ID</div>
                <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto">
                  <code className="text-green-400 font-mono text-sm">
                    ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Example Code */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
            <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><FiCode className="text-blue-600 dark:text-blue-400" /> Example Usage</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Register an agent:</p>
            <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto mb-6">
              <pre className="text-green-400 font-mono text-sm">{`import { useReputationOracle } from './hooks/useReputationOracle';

const oracle = useReputationOracle();
const { tx, agentProfile } = await oracle.registerAgent(
  "https://your-metadata.json"
);`}</pre>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Vouch for another agent:</p>
            <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 font-mono text-sm">{`import { PublicKey } from '@solana/web3.js';

const vouchee = new PublicKey("AGENT_WALLET_ADDRESS");
const { tx } = await oracle.vouch(vouchee, 0.1); // 0.1 SOL stake`}</pre>
            </div>
          </div>

          {/* GitHub Link */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Full Documentation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Source code, tests, and integration examples.
                </p>
              </div>
              <a
                href="https://github.com/dirtybits/agent-reputation-oracle"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-semibold text-sm transition shrink-0"
              >
                <FiExternalLink /> View on GitHub
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Human View (Full Interactive UI)
  return  (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => setUserType('landing')} className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition">← Home</button>
              <span className="text-gray-300 dark:text-gray-700">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Dashboard</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Agent Reputation Oracle
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              On-chain reputation system for AI agents on Solana
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ClientWalletButton />
          </div>
        </div>

        {!connected ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500"><FiUser /></div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Connect your wallet to get started
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Register as an agent, vouch for others, or view reputation scores
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
              {[
                { icon: <FiCheckCircle />, title: 'Register', desc: 'Create your agent profile on-chain' },
                { icon: <FiZap />, title: 'Vouch', desc: 'Stake SOL to vouch for agents you trust' },
                { icon: <FiSearch />, title: 'Explore', desc: 'Search and view other agent profiles' },
                { icon: <FiShield />, title: 'Dispute', desc: 'Challenge bad vouches with evidence' },
                { icon: <FiTrendingUp />, title: 'Reputation', desc: 'Earn reputation from vouches and time' },
                { icon: <FiAlertTriangle />, title: 'Slashing', desc: 'Lose 50% stake on failed vouches' },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-blue-600 dark:text-blue-400">{item.icon}</span>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{item.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-1 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-800">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 font-medium whitespace-nowrap transition text-sm border-b-2 -mb-[2px] ${
                    activeTab === tab.id
                      ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'profile' && (
              <>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                  <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-4">Your Agent Profile</h2>
                  
                  {loading && !agentProfile ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                  ) : agentProfile ? (
                    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
                      <div className="flex justify-between py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Reputation Score</span>
                        <span className="font-bold text-xl text-green-600 dark:text-green-400">
                          {formatScore(agentProfile.reputationScore)}
                        </span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Total Staked</span>
                        <span className="text-sm font-mono text-gray-900 dark:text-white">{(agentProfile.totalStakedFor.toNumber() / 1e9).toFixed(4)} SOL</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Vouches Received</span>
                        <span className="text-sm font-mono text-gray-900 dark:text-white">{agentProfile.totalVouchesReceived.toString()}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Vouches Given</span>
                        <span className="text-sm font-mono text-gray-900 dark:text-white">{agentProfile.totalVouchesGiven.toString()}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Disputes Lost</span>
                        <span className="text-sm font-mono text-red-600 dark:text-red-400">{agentProfile.disputesLost.toString()}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Registered</span>
                        <span className="text-sm text-gray-900 dark:text-white">{formatTimestamp(agentProfile.registeredAt)}</span>
                      </div>
                      <div className="pt-3">
                        <span className="text-xs text-gray-400 dark:text-gray-500">Metadata</span>
                        <a 
                          href={agentProfile.metadataUri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block text-sm text-blue-600 dark:text-blue-400 hover:underline break-all mt-1"
                        >
                          {agentProfile.metadataUri}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">You&apos;re not registered as an agent yet.</p>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metadata URI (optional)</label>
                        <input
                          type="text"
                          value={metadataUri}
                          onChange={(e) => setMetadataUri(e.target.value)}
                          placeholder="https://your-metadata.json or ipfs://..."
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none text-sm"
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Leave empty or enter a URL to metadata describing your agent
                        </p>
                      </div>
                      
                      <button
                        onClick={handleRegister}
                        disabled={loading}
                        className="w-full px-6 py-3 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-gray-900 rounded-lg font-semibold transition text-sm"
                      >
                        {loading ? 'Registering...' : 'Register as Agent'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Agents Vouching For You */}
                {agentProfile && vouchesReceived.length > 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                    <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><FiUsers className="text-blue-600 dark:text-blue-400" /> Agents Vouching For You</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {vouchesReceived.length} {vouchesReceived.length === 1 ? 'agent is' : 'agents are'} staking SOL to vouch for you.
                    </p>
                    
                    <div className="space-y-3">
                      {vouchesReceived.map((vouch: any, idx: number) => {
                        const voucher = vouch.account.voucher;
                        const stakeAmount = vouch.account.stakeAmount || vouch.account.stake_amount;
                        const createdAt = vouch.account.createdAt || vouch.account.created_at;
                        
                        return (
                          <div key={idx} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-base font-bold text-green-600 dark:text-green-400 font-mono">
                                    {(stakeAmount.toNumber() / 1e9).toFixed(4)} SOL
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">staked</span>
                                </div>
                                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                                  {voucher.toString()}
                                </p>
                                <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
                                  <span className="inline-flex items-center gap-1"><FiCalendar /> {formatTimestamp(createdAt)}</span>
                                </div>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setSearchAddress(voucher.toString());
                                  setActiveTab('explorer');
                                }}
                                className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                              >
                                View
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
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                    <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><FiZap className="text-blue-600 dark:text-blue-400" /> Agents You&apos;re Vouching For</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      You&apos;re currently staking SOL to vouch for {vouches.length} {vouches.length === 1 ? 'agent' : 'agents'}.
                    </p>
                    
                    <div className="space-y-3">
                      {vouches.map((vouch: any, idx: number) => {
                        const vouchee = vouch.account.vouchee;
                        const stakeAmount = vouch.account.stakeAmount || vouch.account.stake_amount;
                        const createdAt = vouch.account.createdAt || vouch.account.created_at;
                        
                        return (
                          <div key={idx} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-base font-bold text-green-600 dark:text-green-400 font-mono">
                                    {(stakeAmount.toNumber() / 1e9).toFixed(4)} SOL
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">staked</span>
                                </div>
                                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                                  {vouchee.toString()}
                                </p>
                                <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
                                  <span className="inline-flex items-center gap-1"><FiCalendar /> {formatTimestamp(createdAt)}</span>
                                </div>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setSearchAddress(vouchee.toString());
                                  setActiveTab('explorer');
                                }}
                                className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                              >
                                View
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
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                  <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-2">Vouch for an Agent</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Stake SOL to vouch for another agent&apos;s reputation. If they misbehave and lose a dispute, your stake gets slashed.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent Wallet Address</label>
                      <input
                        type="text"
                        value={voucheeAddress}
                        onChange={(e) => setVoucheeAddress(e.target.value)}
                        placeholder="Enter agent's wallet address (not profile PDA)"
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stake Amount (SOL)</label>
                      <input
                        type="number"
                        value={vouchAmount}
                        onChange={(e) => setVouchAmount(e.target.value)}
                        min="0.01"
                        step="0.01"
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none text-sm font-mono"
                      />
                    </div>
                    
                    <button
                      onClick={handleVouch}
                      disabled={loading || !voucheeAddress}
                      className="w-full px-6 py-3 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-gray-900 disabled:text-gray-500 rounded-lg font-semibold transition text-sm"
                    >
                      {loading ? 'Creating Vouch...' : `Vouch with ${vouchAmount} SOL`}
                    </button>
                  </div>
                </div>

                {/* Agent Directory */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-white">Registered Agents</h3>
                    <button
                      onClick={loadAllAgents}
                      disabled={loadingAgents}
                      className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-gray-900 rounded-lg text-xs font-semibold transition"
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
                            className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-base font-bold text-green-600 dark:text-green-400 font-mono">
                                    {formatScore(agent.account.reputationScore)}
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">reputation</span>
                                  {isCurrentUser && (
                                    <span className="px-2 py-0.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs rounded font-medium">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                                  {agentKey}
                                </p>
                                <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
                                  <span className="inline-flex items-center gap-1"><FiZap /> {agent.account.totalVouchesReceived.toString()} vouches</span>
                                  <span className="inline-flex items-center gap-1"><FiDollarSign /> {(agent.account.totalStakedFor.toNumber() / 1e9).toFixed(2)} SOL</span>
                                </div>
                              </div>
                              
                              {!isCurrentUser && (
                                <button
                                  onClick={() => {
                                    setVoucheeAddress(agent.account.authority.toString());
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                                >
                                  Vouch
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
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-2">Vouch for an Agent</h2>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  You must register as an agent before you can vouch for others. Go to the &quot;My Profile&quot; tab to register.
                </p>
              </div>
            )}

            {activeTab === 'explorer' && (
              <div className="space-y-6">
                {/* Search Box */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                  <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><FiSearch className="text-blue-600 dark:text-blue-400" /> Search Agents</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Search for any agent by their Solana wallet address to view their reputation and vouches.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                        placeholder="Enter agent's Solana public key"
                        className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none text-sm"
                      />
                      <button
                        onClick={searchAgent}
                        disabled={loading}
                        className="px-5 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-gray-900 rounded-lg font-semibold transition whitespace-nowrap text-sm"
                      >
                        {loading ? '...' : 'Search'}
                      </button>
                    </div>

                    {searchedAgent && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-6 space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
                        <h3 className="text-base font-heading font-bold text-green-600 dark:text-green-400 mb-3 pb-0">Agent Found</h3>
                        <div className="flex justify-between py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Reputation Score</span>
                          <span className="font-bold text-xl text-green-600 dark:text-green-400">
                            {formatScore(searchedAgent.reputationScore)}
                          </span>
                        </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600 dark:text-blue-200">Total Staked:</span>
                            <span>{(searchedAgent.totalStakedFor.toNumber() / 1e9).toFixed(4)} SOL</span>
                          </div>
                          <div className="flex justify-between py-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Vouches Received</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white">{searchedAgent.totalVouchesReceived.toString()}</span>
                          </div>
                          <div className="flex justify-between py-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Vouches Given</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white">{searchedAgent.totalVouchesGiven.toString()}</span>
                          </div>
                          <div className="flex justify-between py-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Disputes Lost</span>
                            <span className="text-sm font-mono text-red-600 dark:text-red-400">{searchedAgent.disputesLost.toString()}</span>
                          </div>
                          <div className="flex justify-between py-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Registered</span>
                            <span className="text-sm text-gray-900 dark:text-white">{formatTimestamp(searchedAgent.registeredAt)}</span>
                          </div>
                          <div className="pt-3">
                            <span className="text-xs text-gray-400 dark:text-gray-500">Metadata</span>
                            <a 
                              href={searchedAgent.metadataUri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline break-all mt-1"
                            >
                              {searchedAgent.metadataUri}
                            </a>
                          </div>
                        
                        {agentProfile && (
                          <button
                            onClick={() => {
                              setVoucheeAddress(searchAddress);
                              setActiveTab('vouch');
                            }}
                            className="w-full mt-4 px-6 py-3 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-semibold transition text-sm"
                          >
                            Vouch for this Agent
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Directory */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-white">All Registered Agents</h3>
                    <button
                      onClick={loadAllAgents}
                      disabled={loadingAgents}
                      className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-gray-900 rounded-lg text-xs font-semibold transition"
                    >
                      {loadingAgents ? 'Loading...' : allAgents.length > 0 ? 'Refresh' : 'Load Agents'}
                    </button>
                  </div>
                  
                  {loadingAgents ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading agents...</p>
                  ) : allAgents.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No agents found. Click &quot;Load Agents&quot; to fetch the directory.</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {allAgents.map((agent: any, idx: number) => {
                        const agentKey = agent.publicKey.toString();
                        const isCurrentUser = agentKey === publicKey?.toString();
                        
                        return (
                          <div 
                            key={idx}
                            className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-base font-bold text-green-600 dark:text-green-400 font-mono">
                                    {formatScore(agent.account.reputationScore)}
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">reputation</span>
                                  {isCurrentUser && (
                                    <span className="px-2 py-0.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs rounded font-medium">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                                  {agent.account.authority.toString()}
                                </p>
                                <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
                                  <span className="inline-flex items-center gap-1"><FiZap /> {agent.account.totalVouchesReceived.toString()} vouches</span>
                                  <span className="inline-flex items-center gap-1"><FiDollarSign /> {(agent.account.totalStakedFor.toNumber() / 1e9).toFixed(2)} SOL</span>
                                </div>
                              </div>
                              
                              {!isCurrentUser && agentProfile && (
                                <button
                                  onClick={() => {
                                    setVoucheeAddress(agent.account.authority.toString());
                                    setActiveTab('vouch');
                                  }}
                                  className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                                >
                                  Vouch
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
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><FiShield className="text-blue-600 dark:text-blue-400" /> Open Dispute</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Challenge a vouch if you believe the voucher endorsed a bad actor. Requires a dispute bond.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vouch Account Address</label>
                    <input
                      type="text"
                      value={disputeVouchAddress}
                      onChange={(e) => setDisputeVouchAddress(e.target.value)}
                      placeholder="Public key of the vouch account to dispute"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none text-sm"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Find vouch account addresses by exploring an agent&apos;s vouches
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Evidence (URI)</label>
                    <textarea
                      value={disputeEvidence}
                      onChange={(e) => setDisputeEvidence(e.target.value)}
                      placeholder="URL to evidence (IPFS, GitHub, etc.) showing why this vouch is fraudulent"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none text-sm h-24 resize-none"
                    />
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-amber-800 dark:text-amber-300 text-sm">
                      <span className="inline-flex items-center gap-1"><FiAlertTriangle /></span> <strong>Warning:</strong> Opening a dispute requires a bond. If rejected, you may lose your bond. Only dispute with strong evidence.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleDispute}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 rounded-lg font-semibold transition text-sm"
                  >
                    {loading ? 'Opening Dispute...' : 'Open Dispute'}
                  </button>
                </div>

                {vouches.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <h3 className="text-base font-heading font-bold text-gray-900 dark:text-white mb-4">Your Vouches</h3>
                    <div className="space-y-2">
                      {vouches.map((vouch, idx) => (
                        <div key={idx} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-3">
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Vouch Account</p>
                          <p className="font-mono text-xs text-gray-900 dark:text-white break-all">{vouch.publicKey.toString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status && (
              <div className={`rounded-xl p-4 ${
                status.includes('Error') || status.includes('not found')
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              }`}>
                <p className={`font-mono text-sm break-all ${
                  status.includes('Error') || status.includes('not found')
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-green-700 dark:text-green-300'
                }`}>{status}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
