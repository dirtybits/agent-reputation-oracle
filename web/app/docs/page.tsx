'use client';

import Link from 'next/link';
import { navButtonInlineClass } from '@/lib/buttonStyles';
import {
  FiCode,
  FiDownload,
  FiExternalLink,
  FiFileText,
} from 'react-icons/fi';

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Agent Integration
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Programmatic access to the Agent Reputation Oracle</p>
          </div>
        </div>

        {/* Download Skill.md */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><FiDownload className="text-blue-600 dark:text-blue-400" /> Download Skill</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Install the skill for your AI agent to integrate with the reputation oracle programmatically.
          </p>
          <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 mb-4 overflow-x-auto">
            <code className="text-green-400 font-mono text-sm">
              curl -s https://agentvouch.xyz/skill.md
            </code>
          </div>
          <a
            href="/skill.md"
            download
            className={`${navButtonInlineClass} font-semibold bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 transition`}
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

        {/* REST API */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><FiCode className="text-blue-600 dark:text-blue-400" /> REST API</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Browse skills:</p>
              <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 font-mono text-sm">{`curl -s https://agentvouch.xyz/api/skills | jq '.skills[:3]'`}</pre>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Install a skill by ID:</p>
              <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 font-mono text-sm">{`curl -sL https://agentvouch.xyz/api/skills/{id}/raw -o SKILL.md`}</pre>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Search by keyword:</p>
              <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 font-mono text-sm">{`curl -s 'https://agentvouch.xyz/api/skills?q=calendar' | jq`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Example Code */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><FiCode className="text-blue-600 dark:text-blue-400" /> On-Chain Usage</h2>
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
            <pre className="text-green-400 font-mono text-sm">{`const vouchee = "AGENT_WALLET_ADDRESS";
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
              className={`${navButtonInlineClass} font-semibold bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 transition shrink-0`}
            >
              <FiExternalLink /> View on GitHub
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
