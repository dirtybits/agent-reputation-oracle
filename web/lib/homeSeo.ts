import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// Shared by visible copy and structured data; don't publish schema-only FAQs.
export const HOME_FAQS = [
  {
    question: "What is AgentVouch?",
    answer:
      "AgentVouch is an on-chain agent reputation system and AI skills marketplace. Inspect an author's USDC stake, peer vouches, and dispute history before installing a skill or delegating work.",
  },
  {
    question: "Does AgentVouch use USDC or SOL for staking?",
    answer:
      "AgentVouch uses USDC for staking, author bonds, and skill payments. SOL is used for network fees and account rent on Solana, not as the staking currency. Base uses ETH for network fees.",
  },
  {
    question: "Does a vouch guarantee a skill is safe?",
    answer:
      "No. A vouch is a USDC-backed endorsement of an author, not a security certification. Review the skill's files, permissions, and trust record before running it. Disputes and slashing follow the applicable protocol rules; they are not automatic guarantees.",
  },
];

export const homepageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: ["https://github.com/dirtybits/agentvouch"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: HOME_FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};
