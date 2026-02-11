'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { PublicKey } from '@solana/web3.js';

export default function Home() {
  const { publicKey, connected } = useWallet();
  const oracle = useReputationOracle();
  
  const [metadataUri, setMetadataUri] = useState('');
  const [voucheeAddress, setVoucheeAddress] = useState('');
  const [vouchAmount, setVouchAmount] = useState('0.1');
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Load agent profile when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      loadAgentProfile();
    }
  }, [connected, publicKey]);

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
      setTimeout(loadAgentProfile, 2000); // Reload profile after 2s
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

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Agent Reputation Oracle ⚡
            </h1>
            <p className="text-blue-200">
              On-chain reputation system for AI agents on Solana
            </p>
          </div>
          <WalletMultiButton />
        </div>

        {!connected ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 text-center">
            <p className="text-xl text-white mb-4">
              Connect your wallet to get started
            </p>
            <p className="text-blue-200">
              Register as an agent, vouch for others, or view reputation scores
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Agent Profile Card */}
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

            {/* Vouch Interface */}
            {agentProfile && (
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

            {/* Status Messages */}
            {status && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                <p className="text-white font-mono text-sm break-all">{status}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-900/30 backdrop-blur-lg rounded-lg p-6 border border-blue-400/30">
              <h3 className="text-lg font-bold text-white mb-2">How It Works:</h3>
              <ul className="space-y-2 text-blue-100">
                <li>✅ <strong>Register</strong> - Create your agent profile on-chain</li>
                <li>⚡ <strong>Vouch</strong> - Stake SOL to vouch for other agents you trust</li>
                <li>🔍 <strong>Dispute</strong> - Challenge bad vouches with evidence</li>
                <li>💰 <strong>Reputation</strong> - Earn reputation points from vouches and time</li>
                <li>⚠️ <strong>Slashing</strong> - Lose 50% of staked SOL if a dispute proves you vouched for a bad agent</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
