'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import TrustBadge, { type TrustData } from '@/components/TrustBadge';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import {
  FiArrowLeft,
  FiDownload,
  FiTag,
  FiClock,
  FiShield,
  FiCopy,
  FiCheck,
  FiLoader,
  FiExternalLink,
  FiFileText,
  FiGitCommit,
} from 'react-icons/fi';

interface SkillVersion {
  id: string;
  version: number;
  ipfs_cid: string | null;
  changelog: string | null;
  created_at: string;
}

interface ContentVerification {
  has_ipfs: boolean;
  all_versions_pinned: boolean;
  current_cid_consistent: boolean;
  status: 'verified' | 'drift_detected' | 'unverified';
}

interface SkillDetail {
  id: string;
  skill_id: string;
  author_pubkey: string;
  name: string;
  description: string | null;
  tags: string[];
  current_version: number;
  ipfs_cid: string | null;
  on_chain_address: string | null;
  total_installs: number;
  created_at: string;
  updated_at: string;
  versions: SkillVersion[];
  author_trust: TrustData | null;
  content_verification: ContentVerification | null;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSkill() {
      try {
        const [detailRes, rawRes] = await Promise.all([
          fetch(`/api/skills/${id}?include=trust`),
          fetch(`/api/skills/${id}/raw`),
        ]);

        if (!detailRes.ok) throw new Error('Skill not found');
        const data = await detailRes.json();
        setSkill(data);

        if (rawRes.ok) {
          setContent(await rawRes.text());
        }
      } catch (err) {
        console.error('Error fetching skill:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSkill();
  }, [id]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const installCommand = `curl -sL ${typeof window !== 'undefined' ? window.location.origin : 'https://agentvouch.xyz'}/api/skills/${id}/raw -o SKILL.md`;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
      </main>
    );
  }

  if (!skill) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Skill not found</p>
          <Link href="/skills" className="text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to skills
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/skills"
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition flex items-center gap-1"
              >
                <FiArrowLeft className="w-3.5 h-3.5" />
                Skills
              </Link>
              <span className="text-gray-300 dark:text-gray-700">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{skill.name}</span>
            </div>
            <h1 className="text-3xl font-heading font-bold text-gray-900 dark:text-white">
              {skill.name}
            </h1>
            {skill.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{skill.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ClientWalletButton />
          </div>
        </div>

        {/* Trust Section */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FiShield className="w-4 h-4" />
            Author Trust Signals
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">Author:</span>
            <button
              onClick={() => copyToClipboard(skill.author_pubkey, 'author')}
              className="flex items-center gap-1.5 font-mono text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              {shortAddr(skill.author_pubkey)}
              {copied === 'author' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
            </button>
            {skill.author_trust?.registeredAt ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Registered {formatDate(new Date(skill.author_trust.registeredAt * 1000).toISOString())}
              </span>
            ) : null}
          </div>
          <TrustBadge trust={skill.author_trust} />
        </div>

        {/* Meta Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">v{skill.current_version}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Version</div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1">
              <FiDownload className="w-4 h-4" />
              {skill.total_installs}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Installs</div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
            <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(skill.created_at)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Published</div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
            <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(skill.updated_at)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Updated</div>
          </div>
        </div>

        {/* Tags */}
        {skill.tags?.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <FiTag className="w-4 h-4 text-gray-400" />
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Install Command */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Install
            </span>
            <button
              onClick={() => copyToClipboard(installCommand, 'install')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              {copied === 'install' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
              {copied === 'install' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-sm bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-100 dark:border-gray-700">
            <code>{installCommand}</code>
          </pre>
        </div>

        {/* IPFS CID */}
        {skill.ipfs_cid && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiShield className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Content Hash (IPFS)
                </span>
              </div>
              <a
                href={`https://ipfs.io/ipfs/${skill.ipfs_cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Verify on IPFS <FiExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button
              onClick={() => copyToClipboard(skill.ipfs_cid!, 'cid')}
              className="mt-2 font-mono text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition"
            >
              {skill.ipfs_cid}
              {copied === 'cid' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Content Verification */}
        {skill.content_verification && (
          <div className={`rounded-xl border p-4 mb-6 ${
            skill.content_verification.status === 'verified'
              ? 'border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10'
              : skill.content_verification.status === 'drift_detected'
              ? 'border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-900/10'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900'
          }`}>
            <div className="flex items-center gap-2">
              {skill.content_verification.status === 'verified' ? (
                <>
                  <FiShield className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Content hash verified
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-500 ml-1">
                    — All versions pinned to IPFS, current CID consistent
                  </span>
                </>
              ) : skill.content_verification.status === 'drift_detected' ? (
                <>
                  <FiShield className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Content updated since last pin
                  </span>
                  <span className="text-xs text-yellow-600 dark:text-yellow-500 ml-1">
                    — Current version may differ from previously vouched content
                  </span>
                </>
              ) : (
                <>
                  <FiShield className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Content not yet pinned to IPFS
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Marketplace Link */}
        {skill.on_chain_address && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6">
            <Link
              href={`/marketplace`}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <FiExternalLink className="w-4 h-4" />
              This skill is also listed on the Marketplace
            </Link>
          </div>
        )}

        {/* SKILL.md Content */}
        {content && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <FiFileText className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                SKILL.md Content
              </span>
            </div>
            <MarkdownRenderer content={content} />
          </div>
        )}

        {/* Version History */}
        {skill.versions?.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <FiGitCommit className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Version History
              </span>
            </div>
            <div className="space-y-3">
              {skill.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        v{ver.version}
                      </span>
                      {ver.version === skill.current_version && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs">
                          latest
                        </span>
                      )}
                    </div>
                    {ver.changelog && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ver.changelog}</p>
                    )}
                    {ver.ipfs_cid && (
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1 block">
                        CID: {ver.ipfs_cid.slice(0, 16)}...
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <FiClock className="w-3 h-3" />
                    {formatDate(ver.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
