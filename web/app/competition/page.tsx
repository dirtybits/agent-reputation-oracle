"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TrustBadge, { type TrustData } from "@/components/TrustBadge";
import {
  navButtonFlexClass,
  navButtonInlineClass,
  navButtonPrimaryFlexClass,
  navButtonPrimaryInlineClass,
  navButtonSecondaryFlexClass,
} from "@/lib/buttonStyles";
import {
  FiAward,
  FiDownload,
  FiTag,
  FiShield,
  FiLoader,
  FiBookOpen,
  FiPlus,
  FiArrowRight,
  FiClock,
  FiCheckCircle,
} from "react-icons/fi";
import {
  COMPETITION_TAG,
  COMPETITION_START,
  COMPETITION_END,
  PRIZES,
  getCompetitionPhase,
  getTimeRemaining,
  formatDateRange,
  type CompetitionPhase,
  type TimeRemaining,
} from "@/lib/competition";

interface SkillRow {
  id: string;
  skill_id: string;
  author_pubkey: string;
  name: string;
  description: string | null;
  tags: string[];
  current_version: number;
  ipfs_cid: string | null;
  total_installs: number;
  total_downloads?: number;
  source?: "repo" | "chain";
  created_at: string;
  author_trust: TrustData | null;
}

interface ApiResponse {
  skills: SkillRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function shortAddr(addr: string): string {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl md:text-3xl font-heading font-bold tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  );
}

function StatusBanner({
  phase,
  remaining,
}: {
  phase: CompetitionPhase;
  remaining: TimeRemaining;
}) {
  if (phase === "upcoming") {
    return (
      <div className="rounded-xl border border-[var(--lobster-accent-border)] bg-[var(--lobster-accent-soft)] p-6 md:p-8 mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <FiClock className="w-5 h-5 text-[var(--lobster-accent)]" />
          <span className="text-sm font-semibold text-[var(--lobster-accent-strong)]">
            Competition starts in
          </span>
        </div>
        <div className="flex items-center justify-center gap-4 md:gap-6 text-[var(--lobster-accent-contrast)]">
          <CountdownUnit value={remaining.days} label="days" />
          <span className="text-2xl font-light text-[var(--lobster-accent-border)]">
            :
          </span>
          <CountdownUnit value={remaining.hours} label="hrs" />
          <span className="text-2xl font-light text-[var(--lobster-accent-border)]">
            :
          </span>
          <CountdownUnit value={remaining.minutes} label="min" />
          <span className="text-2xl font-light text-[var(--lobster-accent-border)]">
            :
          </span>
          <CountdownUnit value={remaining.seconds} label="sec" />
        </div>
        <p className="text-xs text-[var(--lobster-accent-muted)] mt-4">
          {formatDateRange()} &middot; 3:00 PM PDT
        </p>
      </div>
    );
  }

  if (phase === "active") {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6 md:p-8 mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-semibold text-green-700 dark:text-green-400">
            LIVE — Submissions close in
          </span>
        </div>
        <div className="flex items-center justify-center gap-4 md:gap-6 text-green-900 dark:text-green-100">
          <CountdownUnit value={remaining.days} label="days" />
          <span className="text-2xl font-light text-green-300 dark:text-green-700">
            :
          </span>
          <CountdownUnit value={remaining.hours} label="hrs" />
          <span className="text-2xl font-light text-green-300 dark:text-green-700">
            :
          </span>
          <CountdownUnit value={remaining.minutes} label="min" />
          <span className="text-2xl font-light text-green-300 dark:text-green-700">
            :
          </span>
          <CountdownUnit value={remaining.seconds} label="sec" />
        </div>
        <p className="text-xs text-green-500 dark:text-green-400 mt-4">
          Ends Wednesday March 18, 2026 at 2:59 PM PDT
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 p-6 md:p-8 mb-8 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <FiCheckCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Competition has ended
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Winners will be announced soon. Thanks to everyone who participated!
      </p>
    </div>
  );
}

export default function CompetitionPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<CompetitionPhase>(() =>
    getCompetitionPhase()
  );
  const [remaining, setRemaining] = useState<TimeRemaining>(() =>
    getTimeRemaining(phase === "upcoming" ? COMPETITION_START : COMPETITION_END)
  );

  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      const p = getCompetitionPhase(now);
      setPhase(p);
      setRemaining(
        getTimeRemaining(
          p === "upcoming" ? COMPETITION_START : COMPETITION_END,
          now
        )
      );
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/skills?tags=${COMPETITION_TAG}&sort=trusted`
      );
      if (!res.ok) throw new Error("Failed to fetch entries");
      const data: ApiResponse = await res.json();
      setSkills(data.skills);
    } catch (err) {
      console.error("Error fetching competition entries:", err);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Best Skill Competition
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">
              Build and publish the best AI agent skill on AgentVouch. Top 3
              authors win SOL prizes paid on mainnet.
              <span className="ml-1 font-medium">{formatDateRange()}</span>
            </p>
          </div>
        </div>

        {/* Status Banner with Countdown */}
        <StatusBanner phase={phase} remaining={remaining} />

        {/* Prize Section */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 md:p-8 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <FiAward className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white">
              Prizes
            </h2>
            <span className="ml-auto text-sm font-semibold text-gray-500 dark:text-gray-400">
              1.75 SOL total
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {PRIZES.map((prize) => (
              <div
                key={prize.place}
                className={`rounded-xl border p-5 text-center ${prize.bg}`}
              >
                <div
                  className={`text-2xl font-heading font-bold mb-1 ${prize.color}`}
                >
                  {prize.amount}
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {prize.place} Place
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Prizes paid in SOL on mainnet to the winning authors&apos; wallet
            addresses. The competition platform runs on Solana devnet.
          </p>
        </div>

        {/* Rules */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 md:p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white">
              How to Enter
            </h2>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {formatDateRange()}
            </span>
          </div>

          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Build a skill",
                desc: "Create a SKILL.md file that gives an AI agent a useful capability. Any domain \u2014 coding, research, security, DeFi, creative \u2014 is fair game.",
                icon: <FiBookOpen className="w-4 h-4" />,
              },
              {
                step: "2",
                title: "Publish with the competition tag",
                desc: (
                  <>
                    Go to{" "}
                    <Link
                      href="/skills/publish?tag=competition"
                      className="text-[var(--lobster-accent)] hover:text-[var(--lobster-accent-strong)] hover:underline font-medium"
                    >
                      Publish Skill
                    </Link>{" "}
                    and add{" "}
                    <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono">
                      competition
                    </code>{" "}
                    as one of your tags. You&apos;ll need an on-chain
                    AgentProfile to publish &mdash; you can register directly on
                    the publish page if you haven&apos;t already.
                  </>
                ),
                icon: <FiTag className="w-4 h-4" />,
              },
              {
                step: "3",
                title: "Get vouched",
                desc: (
                  <>
                    Other participants and community members can vouch for your
                    skill by staking SOL on your author profile. More vouches
                    with higher stakes = stronger signal.{" "}
                    <a
                      href="https://faucet.solana.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--lobster-accent)] hover:text-[var(--lobster-accent-strong)] hover:underline font-medium"
                    >
                      Get devnet SOL at faucet.solana.com
                    </a>
                  </>
                ),
                icon: <FiShield className="w-4 h-4" />,
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-white">
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--lobster-accent)]">
                      {item.icon}
                    </span>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Judging Criteria */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 md:p-8 mb-8">
          <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">
            Judging
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Winners are selected manually after the deadline based on a
            combination of:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                label: "Usefulness",
                desc: "Does this skill solve a real problem for agents?",
              },
              {
                label: "Quality",
                desc: "Well-structured, clear instructions, handles edge cases",
              },
              {
                label: "Trust signals",
                desc: "Community vouches and author reputation on-chain",
              },
              {
                label: "Originality",
                desc: "Novel capability, not a copy of existing tools",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="flex items-start gap-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3"
              >
                <FiCheckCircle className="w-4 h-4 text-green-500 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {c.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {c.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit CTA — phase-aware */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
          {phase === "upcoming" && (
            <>
              <div
                className={`w-full sm:w-auto ${navButtonFlexClass} font-semibold bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed`}
              >
                <FiPlus className="w-4 h-4" />
                Submit Your Skill
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                Submissions open March 11 at 3:00 PM PDT
              </span>
            </>
          )}
          {phase === "active" && (
            <>
              <Link
                href="/skills/publish?tag=competition"
                className={`w-full sm:w-auto ${navButtonPrimaryFlexClass}`}
              >
                <FiPlus className="w-4 h-4" />
                Submit Your Skill
              </Link>
              <Link
                href="/skills"
                className={`w-full sm:w-auto ${navButtonSecondaryFlexClass}`}
              >
                Browse All Skills <FiArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
          {phase === "ended" && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <FiCheckCircle className="w-4 h-4" />
              Submissions closed
            </div>
          )}
        </div>

        {/* Entries */}
        <div className="mb-4">
          <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-1">
            Entries
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Skills tagged with{" "}
            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
              competition
            </code>
            {!loading && skills.length > 0 && (
              <span className="ml-1">({skills.length})</span>
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-20 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <FiAward className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No entries yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
              {phase === "upcoming"
                ? "Submissions open March 11 at 3:00 PM PDT"
                : phase === "active"
                ? "Be the first to submit a skill to the competition"
                : "No skills were submitted during this competition"}
            </p>
            {phase === "active" && (
              <Link
                href="/skills/publish?tag=competition"
                className={navButtonPrimaryInlineClass}
              >
                <FiPlus className="w-4 h-4" /> Submit Skill
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map((skill, idx) => {
              const downloads =
                (skill.total_installs ?? 0) + (skill.total_downloads ?? 0);
              const isTop3 = idx < 3;

              return (
                <div
                  key={skill.id}
                  className="group relative flex items-start gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-gray-300 dark:hover:border-gray-700 transition"
                >
                  <Link
                    href={`/skills/${skill.id}`}
                    aria-label={`View ${skill.name}`}
                    className="absolute inset-0 z-10 rounded-xl"
                  />
                  {/* Rank */}
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                        : idx === 1
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        : idx === 2
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-[var(--lobster-accent)] transition truncate">
                        {skill.name}
                      </h3>
                      {isTop3 && (
                        <span
                          className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${PRIZES[idx].bg} ${PRIZES[idx].color}`}
                        >
                          {PRIZES[idx].amount}
                        </span>
                      )}
                    </div>

                    {skill.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                        {skill.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 flex-wrap">
                      <TrustBadge trust={skill.author_trust} compact />
                      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiDownload className="w-3.5 h-3.5" /> {downloads}
                        </span>
                        <Link
                          href={`/author/${skill.author_pubkey}`}
                          className="relative z-20 font-mono hover:text-[var(--lobster-accent)] hover:underline transition"
                          title={skill.author_pubkey}
                        >
                          {shortAddr(skill.author_pubkey)}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
