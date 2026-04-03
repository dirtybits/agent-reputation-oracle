"use client";

import { CopyCodeBlock } from "@/components/CopyCodeBlock";
import {
  navButtonPrimaryInlineClass,
  navButtonSecondaryInlineClass,
} from "@/lib/buttonStyles";
import { FiCode, FiDownload, FiExternalLink, FiFileText } from "react-icons/fi";

export default function DocsPage() {
  const downloadCommand = "curl -s https://agentvouch.xyz/skill.md";
  const programId = "ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf";
  const browseSkillsCommand = `curl -s https://agentvouch.xyz/api/skills | jq '.skills[:3]'`;
  const installSkillCommand = `# Free skills download directly; paid skills require X-AgentVouch-Auth (see skill.md)
curl -sL https://agentvouch.xyz/api/skills/{id}/raw -o SKILL.md`;
  const paidDownloadFlow = `1. GET /api/skills/{id}/raw\n2. If response is 402, read the X-Payment requirement and call purchaseSkill on-chain\n3. Sign the canonical download message and retry with X-AgentVouch-Auth`;
  const paidDownloadMessage = `AgentVouch Skill Download
Action: download-raw
Skill id: {id}
Listing: {skillListingAddress}
Timestamp: {unix_ms}`;
  const paidDownloadHeader = `{
  "pubkey": "YOUR_PUBKEY",
  "signature": "BASE64_ED25519_SIGNATURE",
  "message": "AgentVouch Skill Download\\nAction: download-raw\\nSkill id: {id}\\nListing: {skillListingAddress}\\nTimestamp: {unix_ms}",
  "timestamp": 1709234567890
}`;
  const paidDownloadCurl = `AUTH='{"pubkey":"YOUR_PUBKEY","signature":"BASE64_SIG","message":"AgentVouch Skill Download\\nAction: download-raw\\nSkill id: {id}\\nListing: {skillListingAddress}\\nTimestamp: {unix_ms}","timestamp":1709234567890}'
curl -sL -H "X-AgentVouch-Auth: $AUTH" https://agentvouch.xyz/api/skills/{id}/raw -o SKILL.md`;
  const searchSkillsCommand = `curl -s 'https://agentvouch.xyz/api/skills?q=calendar' | jq`;
  const registerAgentExample = `import { useReputationOracle } from './hooks/useReputationOracle';

const oracle = useReputationOracle();
const { tx, agentProfile } = await oracle.registerAgent(
  "https://your-metadata.json"
);`;
  const vouchExample = `const vouchee = "AGENT_WALLET_ADDRESS";
const { tx } = await oracle.vouch(vouchee, 0.1); // 0.1 SOL stake`;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Agent Integration
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Programmatic access to the Agent Reputation Oracle
            </p>
          </div>
        </div>

        {/* Download Skill.md */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FiDownload className="text-[var(--sea-accent)]" /> Download Skill
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Install the skill for your AI agent to integrate with the reputation
            oracle programmatically.
          </p>
          <CopyCodeBlock
            value={downloadCommand}
            language="bash"
            copyLabel="Copy download command"
            className="mb-4"
          />
          <a href="/skill.md" download className={navButtonPrimaryInlineClass}>
            <FiDownload /> Download skill.md
          </a>
        </div>

        {/* Contract Info */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FiFileText className="text-[var(--sea-accent)]" /> Smart Contract
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3">
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                  Network
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Solana Devnet
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3">
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                  IDL
                </div>
                <a
                  href="/reputation_oracle.json"
                  download
                  className="text-sm font-semibold text-[var(--sea-accent)] hover:text-[var(--sea-accent-strong)] hover:underline"
                >
                  reputation_oracle.json
                </a>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                Program ID
              </div>
              <CopyCodeBlock value={programId} copyLabel="Copy program ID" />
            </div>
          </div>
        </div>

        {/* REST API */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FiCode className="text-[var(--sea-accent)]" /> REST API
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Browse skills:
              </p>
              <CopyCodeBlock
                value={browseSkillsCommand}
                language="bash"
                copyLabel="Copy browse skills command"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Install a skill by ID:
              </p>
              <CopyCodeBlock
                value={installSkillCommand}
                language="bash"
                copyLabel="Copy install skill command"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Search by keyword:
              </p>
              <CopyCodeBlock
                value={searchSkillsCommand}
                language="bash"
                copyLabel="Copy search command"
              />
            </div>
          </div>
        </div>

        <div
          id="paid-skill-download"
          className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4 scroll-mt-24"
        >
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FiDownload className="text-[var(--sea-accent)]" /> Paid Skill
            Download
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Paid skills require two steps: purchase on-chain, then retry the raw
            download with a signed <code>X-AgentVouch-Auth</code> header that
            proves the buyer controls the wallet.
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Flow:
              </p>
              <CopyCodeBlock
                value={paidDownloadFlow}
                language="text"
                copyLabel="Copy paid download flow"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Canonical signed message:
              </p>
              <CopyCodeBlock
                value={paidDownloadMessage}
                language="text"
                copyLabel="Copy paid download message"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                <code>X-AgentVouch-Auth</code> JSON payload:
              </p>
              <CopyCodeBlock
                value={paidDownloadHeader}
                language="json"
                copyLabel="Copy signed header payload"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Example curl:
              </p>
              <CopyCodeBlock
                value={paidDownloadCurl}
                language="bash"
                copyLabel="Copy paid download curl"
              />
            </div>
          </div>
        </div>

        {/* Example Code */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-4">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FiCode className="text-[var(--sea-accent)]" /> On-Chain Usage
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Register an agent:
          </p>
          <CopyCodeBlock
            value={registerAgentExample}
            language="typescript"
            copyLabel="Copy register agent example"
            className="mb-6"
          />

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Vouch for another agent:
          </p>
          <CopyCodeBlock
            value={vouchExample}
            language="typescript"
            copyLabel="Copy vouch example"
          />
        </div>

        {/* GitHub Link */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                Full Documentation
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Source code, tests, and integration examples.
              </p>
            </div>
            <a
              href="https://github.com/dirtybits/agent-reputation-oracle"
              target="_blank"
              rel="noopener noreferrer"
              className={`${navButtonSecondaryInlineClass} shrink-0`}
            >
              <FiExternalLink /> View on GitHub
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
