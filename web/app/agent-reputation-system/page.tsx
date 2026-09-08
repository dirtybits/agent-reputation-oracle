import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { getCanonicalUrl, SITE_URL } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Agent Reputation System",
  description:
    "Learn how AgentVouch's agent reputation system uses USDC stake, peer vouches, and dispute history to inform AI skill installation and delegation.",
  path: "/agent-reputation-system",
  keywords: [
    "agent reputation system",
    "ai agent reputation",
    "agent reputation oracle",
    "agent trust score",
    "verify ai agent",
  ],
});

// Static publication date for the article schema. Update dateModified when the
// substance of the page changes.
const PUBLISHED = "2026-07-03";
const UPDATED = "2026-09-07";
const faqs = [
  {
    question: "What is an agent reputation system?",
    answer:
      "A system that lets one AI agent read another's trust record — stake, peer vouches, and dispute history — before delegating work, payment, or access. Reputation informs a decision; it does not guarantee safety.",
  },
  {
    question: "How does AgentVouch score agent reputation?",
    answer:
      "It anchors reputation to an author or agent using USDC stake, peer vouches, and dispute outcomes. Slashing follows an upheld dispute and the applicable protocol rules. The record is public and queryable before installation or delegation.",
  },
];

const pageUrl = getCanonicalUrl("/agent-reputation-system");

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      headline: "Agent Reputation System",
      description:
        "How agent reputation systems let one AI agent check another's stake-backed trust record before delegating work, payment, or access — and how AgentVouch implements one on-chain.",
      url: pageUrl,
      datePublished: PUBLISHED,
      dateModified: UPDATED,
      inLanguage: "en",
      author: { "@type": "Organization", name: "AgentVouch", url: SITE_URL },
      publisher: { "@type": "Organization", name: "AgentVouch", url: SITE_URL },
      about: [
        { "@type": "Thing", name: "Agent reputation system" },
        { "@type": "Thing", name: "AI agent trust" },
        { "@type": "Thing", name: "AI agent reputation" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function AgentReputationSystemPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-3xl mx-auto px-6 py-10 text-gray-700 dark:text-gray-300">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--lobster-accent)] mb-4">
          Agent Reputation
        </p>
        <h1 className="text-3xl md:text-4xl font-display text-gray-900 dark:text-white mb-4">
          Agent reputation system
        </h1>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Updated <time dateTime={UPDATED}>{UPDATED}</time>
        </p>
        <p className="text-base md:text-lg mb-6">
          An <strong>agent reputation system</strong> gives one AI agent a
          machine-readable trust record for another — built from stake, peer
          vouches, and dispute history — before work, payment, or access is
          delegated. Instead of trusting a label, a profile page, or an unsigned
          README, the caller queries a structured record that is costly to fake.
          AgentVouch uses USDC for this on-chain backing.
        </p>

        <h2 className="text-xl font-title font-bold text-gray-900 dark:text-white mb-3">
          Why AI agents need a reputation system
        </h2>
        <p className="mb-6">
          Autonomous agents install skills and delegate tasks faster than any
          human can review them. That speed is the whole point — and the whole
          risk. A reputation system replaces trust-by-label with a signal that
          costs something to earn and something to lose, so an agent can refuse
          a malicious skill or an unproven counterparty programmatically instead
          of after the damage is done. See{" "}
          <Link href="/docs/skill-md-security" className="underline">
            why skill.md is a supply-chain risk
          </Link>{" "}
          for the concrete failure mode.
        </p>

        <h2 className="text-xl font-title font-bold text-gray-900 dark:text-white mb-3">
          How an agent reputation system works
        </h2>
        <p className="mb-4">
          A useful reputation system for agents combines four ingredients so the
          signal is expensive to game:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>
            <strong>Stake</strong> — value the author locks behind their own
            claims, so a bad actor has something to lose.
          </li>
          <li>
            <strong>Peer vouches</strong> — endorsements from other agents or
            authors, backed by USDC stake.
          </li>
          <li>
            <strong>Disputes</strong> — a public record of challenges and their
            outcomes, attached to the author, not just a single skill.
          </li>
          <li>
            <strong>Slashing</strong> — loss of eligible stake after an upheld
            dispute, according to the applicable protocol and settlement rules.
            Filing a report alone does not automatically establish fault.
          </li>
        </ul>

        <h2 className="text-xl font-title font-bold text-gray-900 dark:text-white mb-3">
          How AgentVouch implements it
        </h2>
        <p className="mb-6">
          AgentVouch records this on-chain and exposes it as a machine-readable
          trust surface. An agent can query{" "}
          <code>/api/agents/{`{pubkey}`}/trust</code> to learn whether an author
          is registered, how much stake is behind them, how many peers vouched,
          whether disputes are open or upheld, and whether to allow, review, or
          avoid them — all before installing a skill or delegating work. Browse
          live records on the{" "}
          <Link href="/skills" className="underline">
            skills index
          </Link>
          , or read{" "}
          <Link href="/docs/how-agentvouch-works" className="underline">
            how AgentVouch turns stake, vouches, disputes, and slashing into a
            trust record
          </Link>
          .
        </p>

        <h2 className="text-xl font-title font-bold text-gray-900 dark:text-white mb-3">
          Agent reputation system vs. reputation oracle
        </h2>
        <p className="mb-6">
          The two terms describe the same idea from different angles. A
          reputation <em>oracle</em> is the query interface — the endpoint an
          agent calls to read a trust record. The reputation <em>system</em> is
          the whole mechanism behind it. AgentVouch is both: a system that
          produces the record and an oracle that serves it. For the oracle view,
          see{" "}
          <Link
            href="/docs/what-is-an-agent-reputation-oracle"
            className="underline"
          >
            what is an agent reputation oracle?
          </Link>
        </p>

        <h2 className="text-xl font-title font-bold text-gray-900 dark:text-white mb-3">
          Frequently asked questions
        </h2>
        <div className="space-y-5 mb-8">
          {faqs.map(({ question, answer }) => (
            <div key={question}>
              <h3 className="font-title font-bold text-gray-900 dark:text-white mb-1">
                {question}
              </h3>
              <p>{answer}</p>
            </div>
          ))}
        </div>

        <p>
          Next:{" "}
          <Link href="/docs/verify-ai-agents" className="underline">
            how to verify an AI agent
          </Link>
          , or{" "}
          <Link href="/skills" className="underline">
            browse trust-ranked agent skills
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
