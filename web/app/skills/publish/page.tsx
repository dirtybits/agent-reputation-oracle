'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { useWalletConnection } from '@solana/react-hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { PRICING, DEFAULT_CURRENCY, formatMinPrice, toLamports } from '@/lib/pricing';
import {
  FiUpload,
  FiEye,
  FiEdit3,
  FiTag,
  FiLoader,
  FiCheckCircle,
  FiXCircle,
  FiX,
  FiShield,
  FiDollarSign,
  FiArrowRight,
} from 'react-icons/fi';
import type { Address } from '@solana/kit';

function parseFrontmatter(content: string): {
  name: string;
  description: string;
  body: string;
} {
  const lines = content.split('\n');

  // Try to extract name from first H1
  let name = '';
  let description = '';
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ') && !name) {
      name = trimmed.slice(2).trim();
      bodyStart = i;
      continue;
    }

    if (name && !description && !trimmed.startsWith('#')) {
      description = trimmed;
      break;
    }
  }

  return { name, description, body: content };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function ProfileSetupStep({
  registering,
  onRegister,
  error,
}: {
  registering: boolean;
  onRegister: () => void;
  error: string | null;
}) {
  return (
    <div className="max-w-md mx-auto mt-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-8">
        <span className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
          <span className="w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-xs font-bold">1</span>
          Create profile
        </span>
        <FiArrowRight className="w-3.5 h-3.5" />
        <span className="flex items-center gap-1.5 opacity-50">
          <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs">2</span>
          Publish skill
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-5">
          <FiShield className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Create your author profile
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Before publishing, set up your on-chain author profile. This links your skills to the reputation system so others can vouch for your work.
        </p>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        <button
          onClick={onRegister}
          disabled={registering}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-40"
        >
          {registering ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              Creating profile…
            </>
          ) : (
            <>
              <FiShield className="w-4 h-4" />
              Create Profile
            </>
          )}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
          One-time on-chain transaction (~0.003 SOL rent)
        </p>
      </div>
    </div>
  );
}

function PublishReadiness({
  connected,
  profileLoading,
  hasProfile,
  hasContent,
  hasName,
  hasSkillId,
}: {
  connected: boolean;
  profileLoading: boolean;
  hasProfile: boolean;
  hasContent: boolean;
  hasName: boolean;
  hasSkillId: boolean;
}) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        Connect wallet to publish
      </span>
    );
  }

  if (profileLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <FiLoader className="w-3 h-3 animate-spin" />
        Checking profile…
      </span>
    );
  }

  const issues: string[] = [];
  if (!hasContent) issues.push('skill content');
  if (!hasName) issues.push('name');
  if (!hasSkillId) issues.push('skill ID');
  if (!hasProfile) issues.push('author profile');

  if (issues.length > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Needs {issues.join(', ')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
      <FiCheckCircle className="w-3 h-3" />
      Ready to publish
    </span>
  );
}

export default function PublishSkillPage() {
  return (
    <Suspense>
      <PublishSkillPageInner />
    </Suspense>
  );
}

function PublishSkillPageInner() {
  const { wallet, status } = useWalletConnection();
  const connected = status === 'connected' && !!wallet;
  const publicKey = wallet?.account.address ?? null;
  const signMessage = wallet?.signMessage ?? null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const oracle = useReputationOracle();

  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [skillId, setSkillId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>(() => {
    const initial = searchParams.get('tag');
    return initial ? [initial.toLowerCase()] : [];
  });
  const [tagInput, setTagInput] = useState('');
  const [contact, setContact] = useState('');
  const [price, setPrice] = useState(String(PRICING.SOL.defaultPrice));
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<'idle' | 'repo' | 'chain'>('idle');
  const [result, setResult] = useState<{ success: boolean; message: string; id?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [pendingPublishAfterRegister, setPendingPublishAfterRegister] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      setAgentProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    oracle.getAgentProfile(publicKey)
      .then(setAgentProfile)
      .catch(() => setAgentProfile(null))
      .finally(() => setProfileLoading(false));
  }, [connected, publicKey]);

  async function publishSkill(skipProfileCheck = false) {
    if (!skillId || !name || !content) {
      setResult({ success: false, message: 'Skill ID, name, and content are required' });
      return;
    }

    if (!connected || !publicKey || !signMessage) {
      setResult({ success: false, message: 'Connect your wallet to publish. Use the button in the top right.' });
      return;
    }

    if (!skipProfileCheck && profileLoading) {
      setResult({ success: false, message: 'Checking your author profile. Try publishing again in a moment.' });
      return;
    }

    if (!skipProfileCheck && !agentProfile) {
      setPendingPublishAfterRegister(true);
      setShowProfileGate(true);
      setResult({ success: false, message: 'Create your author profile before publishing your first skill.' });
      return;
    }

    setPublishing(true);
    setPublishStep('repo');
    setResult(null);

    try {
      const timestamp = Date.now();
      const message = `AgentVouch Skill Repo\nAction: publish-skill\nTimestamp: ${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString('base64');
      const auth = { pubkey: publicKey!, signature, message, timestamp };

      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, skill_id: skillId, name, description, tags, content, contact: contact || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, message: data.error || 'Failed to publish' });
        return;
      }

      const skillDbId: string = data.id;
      const ipfsCid: string | null = data.ipfs_cid;
      const skillUri = ipfsCid
        ? `${window.location.origin}/api/skills/${skillDbId}/raw`
        : '';

      setPublishStep('chain');
      try {
        const priceLamports = toLamports(parseFloat(price || '0'));
        await oracle.createSkillListing(skillId, skillUri, name, description, priceLamports);

        const onChainAddress = await oracle.getSkillListingPDA(publicKey as Address, skillId);

        const patchTimestamp = Date.now();
        const patchMessage = `AgentVouch Skill Repo\nAction: publish-skill\nTimestamp: ${patchTimestamp}`;
        const patchMsgBytes = new TextEncoder().encode(patchMessage);
        const patchSigBytes = await signMessage(patchMsgBytes);
        const patchSignature = Buffer.from(patchSigBytes).toString('base64');

        const patchRes = await fetch(`/api/skills/${skillDbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth: { pubkey: publicKey!, signature: patchSignature, message: patchMessage, timestamp: patchTimestamp },
            on_chain_address: onChainAddress,
          }),
        });

        if (!patchRes.ok) {
          const patchData = await patchRes.json().catch(() => null);
          throw new Error(patchData?.error || 'Skill saved, but failed to link the on-chain listing');
        }
      } catch (chainErr: any) {
        setResult({
          success: true,
          message: `Skill saved to repo — on-chain listing failed: ${chainErr.message}. Visit the skill page to retry.`,
          id: skillDbId,
        });
        setTimeout(() => router.push(`/skills/${skillDbId}`), 3000);
        return;
      }

      setResult({
        success: true,
        message: 'Skill published and listed on-chain!',
        id: skillDbId,
      });

      setTimeout(() => router.push(`/skills/${skillDbId}`), 1500);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setPublishing(false);
      setPublishStep('idle');
      setPendingPublishAfterRegister(false);
    }
  }

  const handleRegister = async () => {
    if (!connected || !publicKey) return;
    setRegistering(true);
    setRegisterError(null);
    try {
      await oracle.registerAgent('');
      const profile = await oracle.getAgentProfile(publicKey);
      setAgentProfile(profile);
      setShowProfileGate(false);
      if (profile && pendingPublishAfterRegister) {
        await publishSkill(true);
      }
    } catch (err: any) {
      const cause = err?.cause?.message ?? err?.context?.message ?? '';
      const msg = cause || err.message || String(err);
      const alreadyExists =
        /already in use|already exists|0x0|account already initialized/i.test(msg);
      if (alreadyExists) {
        const profile = await oracle.getAgentProfile(publicKey).catch(() => null);
        if (profile) {
          setAgentProfile(profile);
          setShowProfileGate(false);
          if (pendingPublishAfterRegister) {
            await publishSkill(true);
          }
          return;
        }
      }
      setRegisterError(`Profile creation failed: ${msg}`);
    } finally {
      setRegistering(false);
    }
  };

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    const parsed = parseFrontmatter(text);
    if (parsed.name && !name) {
      setName(parsed.name);
      setSkillId(slugify(parsed.name));
    }
    if (parsed.description && !description) {
      setDescription(parsed.description);
    }
  }, [name, description]);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.md') || file.type === 'text/markdown')) {
        const reader = new FileReader();
        reader.onload = () => handleContentChange(reader.result as string);
        reader.readAsText(file);
      }
    },
    [handleContentChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => handleContentChange(reader.result as string);
        reader.readAsText(file);
      }
    },
    [handleContentChange]
  );

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handlePublish = async () => {
    await publishSkill();
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/skills"
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
              >
                ← Skills
              </Link>
              <span className="text-gray-300 dark:text-gray-700">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Publish</span>
            </div>
            <h1 className="text-3xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Publish a Skill
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Upload a SKILL.md file. It will be pinned to IPFS and stored in the repository.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {!connected && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Fill in your skill — you&apos;ll connect a wallet to publish.
              </p>
            )}
          </div>
        </div>

        {/* Result toast */}
        {result && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
              result.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {result.success ? (
                <FiCheckCircle className="text-green-600 dark:text-green-400" />
              ) : (
                <FiXCircle className="text-red-600 dark:text-red-400" />
              )}
              <span
                className={`text-sm ${
                  result.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}
              >
                {result.message}
              </span>
            </div>
            <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600">
              <FiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Profile setup modal — shown inline when user tries to publish without a profile */}
        {showProfileGate && connected && !profileLoading && !agentProfile && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="relative">
              <button
                onClick={() => setShowProfileGate(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
              >
                <FiX className="w-4 h-4" />
              </button>
              <ProfileSetupStep
                registering={registering}
                onRegister={handleRegister}
                error={registerError}
              />
            </div>
          </div>
        )}

        {/* Publish form — always visible so users can fill it before connecting */}
        <>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => !content && fileInputRef.current?.click()}
          className={`mb-6 rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
              : content
              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            onChange={handleFileSelect}
            className="hidden"
          />
          {content ? (
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
              <FiCheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                SKILL.md loaded ({content.length} characters)
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setContent(''); setName(''); setSkillId(''); setDescription(''); }}
                className="ml-2 text-gray-400 hover:text-red-500 transition"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <FiUpload className="w-8 h-8 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Drop your SKILL.md file here, or click to select
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Or paste content directly below
              </p>
            </>
          )}
        </div>

        {/* Content editor / preview toggle */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mb-6 overflow-hidden">
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setShowPreview(false)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition ${
                !showPreview
                  ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <FiEdit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition ${
                showPreview
                  ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <FiEye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
          <div className="p-4">
            {showPreview ? (
              content ? (
                <MarkdownRenderer content={content} />
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
                  Nothing to preview yet
                </p>
              )
            ) : (
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="# My Skill\n\nDescribe what this skill does...\n\n## When to Use\n\n- Use when..."
                className="w-full min-h-[300px] bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none resize-y font-mono"
              />
            )}
          </div>
        </div>

        {/* Metadata form */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Skill Metadata
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Skill Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (!skillId) setSkillId(slugify(e.target.value)); }}
                placeholder="Solana Developer Skill"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Skill ID *
              </label>
              <input
                type="text"
                value={skillId}
                onChange={(e) => setSkillId(slugify(e.target.value))}
                placeholder="solana-dev-skill"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this skill teaches agents..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={256}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Tags (up to 5)
            </label>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition">
                    <FiX className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addTag}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <FiTag className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Contact Handle <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="@twitter, discord#1234, t.me/handle, etc."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={128}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              So we can reach you about competitions, features, or issues.
            </p>
          </div>
        </div>

        {/* Price + publish */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FiDollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Marketplace Price</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Every skill is listed on-chain so it can be vouched for and disputed. Minimum price is {formatMinPrice()}.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={PRICING.SOL.minPrice}
              step={PRICING.SOL.step}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={String(PRICING.SOL.minPrice)}
              className="w-32 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">SOL</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <PublishReadiness
            connected={connected}
            profileLoading={profileLoading}
            hasProfile={!!agentProfile}
            hasContent={!!content}
            hasName={!!name}
            hasSkillId={!!skillId}
          />
          <button
            onClick={handlePublish}
            disabled={publishing || !content || !name || !skillId || (connected && profileLoading)}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {publishing ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                {publishStep === 'chain' ? 'Creating on-chain listing…' : 'Saving to repo…'}
              </>
            ) : (
              <>
                <FiUpload className="w-4 h-4" />
                Publish Skill
              </>
            )}
          </button>
        </div>

          </>
      </div>
    </main>
  );
}
