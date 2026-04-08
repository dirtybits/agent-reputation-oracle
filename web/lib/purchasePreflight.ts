import { createSolanaRpc, type Address } from "@solana/kit";
import { DEFAULT_SOLANA_RPC_URL } from "./solanaRpc";

const DEFAULT_RPC_URL = DEFAULT_SOLANA_RPC_URL;

export const PURCHASE_ACCOUNT_SPACE = 8 + 32 + 32 + 8 + 8 + 1;
export const PURCHASE_FEE_BUFFER_LAMPORTS = 50_000n;

export type PurchasePreflightStatus =
  | "ok"
  | "buyerInsufficientBalance"
  | "authorPayoutRentBlocked"
  | "estimateUnavailable";

export type BlockingPurchasePreflightStatus = Extract<
  PurchasePreflightStatus,
  "buyerInsufficientBalance" | "authorPayoutRentBlocked"
>;

export type SerializedPurchaseBlockError = {
  code: BlockingPurchasePreflightStatus;
  message: string;
};

export type SerializedPurchasePreflight = {
  creatorPriceLamports: number;
  estimatedPurchaseRentLamports: number;
  feeBufferLamports: number;
  estimatedBuyerTotalLamports: number;
  purchasePreflightStatus: PurchasePreflightStatus;
  purchasePreflightMessage: string | null;
  purchaseBlocked: boolean;
  purchaseBlockError: SerializedPurchaseBlockError | null;
  priceDisclosure: string | null;
};

export type PurchasePreflightAssessment = {
  creatorPriceLamports: bigint;
  estimatedPurchaseRentLamports: bigint;
  feeBufferLamports: bigint;
  estimatedBuyerTotalLamports: bigint;
  purchasePreflightStatus: PurchasePreflightStatus;
  purchasePreflightMessage: string | null;
  priceDisclosure: string | null;
  buyerBalanceLamports: bigint | null;
  authorBalanceLamports: bigint | null;
  authorShareLamports: bigint;
  systemAccountRentExemptLamports: bigint | null;
};

export type PurchasePreflightContext = {
  buyer: Address | null;
  buyerBalanceLamports: bigint | null;
  purchaseRentLamports: bigint | null;
  systemAccountRentExemptLamports: bigint | null;
  authorBalanceLamportsByAddress: Map<string, bigint | null>;
};

type PurchasePreflightRpc = ReturnType<typeof createSolanaRpc>;

function coerceLamports(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    (value as { value?: unknown }).value !== undefined
  ) {
    return coerceLamports((value as { value: unknown }).value);
  }
  throw new Error("Unexpected lamports response from RPC");
}

function toSafeLamportsNumber(value: bigint): number {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > maxSafe) {
    throw new Error("Lamports value exceeds Number.MAX_SAFE_INTEGER");
  }
  return Number(value);
}

function buildAuthorRentBlockedMessage(
  authorBalanceLamports: bigint,
  systemAccountRentExemptLamports: bigint
) {
  if (authorBalanceLamports === 0n) {
    return "This low-priced listing cannot currently be purchased because the author's payout wallet is empty and the payout would be below Solana's rent minimum. The author needs a small amount of SOL in their wallet first.";
  }
  return `This low-priced listing cannot currently be purchased because the author's payout wallet would still sit below Solana's rent minimum after the payout. The author needs at least ${toSafeLamportsNumber(
    systemAccountRentExemptLamports - authorBalanceLamports
  )} more lamports in their wallet first.`;
}

function buildBuyerInsufficientMessage(
  buyerBalanceLamports: bigint,
  totalLamports: bigint
) {
  return `Connected wallet has ${toSafeLamportsNumber(
    buyerBalanceLamports
  )} lamports available, but this purchase needs about ${toSafeLamportsNumber(
    totalLamports
  )} lamports including the on-chain purchase receipt rent.`;
}

export function createFreePurchasePreflight(): PurchasePreflightAssessment {
  return {
    creatorPriceLamports: 0n,
    estimatedPurchaseRentLamports: 0n,
    feeBufferLamports: 0n,
    estimatedBuyerTotalLamports: 0n,
    purchasePreflightStatus: "ok",
    purchasePreflightMessage: null,
    priceDisclosure: null,
    buyerBalanceLamports: null,
    authorBalanceLamports: null,
    authorShareLamports: 0n,
    systemAccountRentExemptLamports: null,
  };
}

export async function createPurchasePreflightContext({
  rpc = createSolanaRpc(DEFAULT_RPC_URL),
  buyer = null,
  authors = [],
}: {
  rpc?: PurchasePreflightRpc;
  buyer?: Address | null;
  authors?: Address[];
}): Promise<PurchasePreflightContext> {
  const uniqueAuthors = [...new Set(authors.map(String))] as Address[];

  const [
    buyerBalanceLamports,
    purchaseRentLamports,
    systemAccountRentExemptLamports,
  ] = await Promise.all([
    buyer
      ? rpc
          .getBalance(buyer)
          .send()
          .then(coerceLamports)
          .catch(() => null)
      : Promise.resolve(null),
    rpc
      .getMinimumBalanceForRentExemption(BigInt(PURCHASE_ACCOUNT_SPACE))
      .send()
      .then(coerceLamports)
      .catch(() => null),
    rpc
      .getMinimumBalanceForRentExemption(0n)
      .send()
      .then(coerceLamports)
      .catch(() => null),
  ]);

  const authorBalanceLamportsByAddress = new Map<string, bigint | null>();

  await Promise.all(
    uniqueAuthors.map(async (author) => {
      const balance = await rpc
        .getBalance(author)
        .send()
        .then(coerceLamports)
        .catch(() => null);
      authorBalanceLamportsByAddress.set(String(author), balance);
    })
  );

  return {
    buyer,
    buyerBalanceLamports,
    purchaseRentLamports,
    systemAccountRentExemptLamports,
    authorBalanceLamportsByAddress,
  };
}

export function assessPurchasePreflight({
  context,
  priceLamports,
  author,
}: {
  context: PurchasePreflightContext;
  priceLamports: bigint;
  author: Address | null;
}): PurchasePreflightAssessment {
  if (priceLamports <= 0n) {
    return createFreePurchasePreflight();
  }

  const estimatedPurchaseRentLamports = context.purchaseRentLamports ?? 0n;
  const estimatedBuyerTotalLamports =
    priceLamports +
    estimatedPurchaseRentLamports +
    PURCHASE_FEE_BUFFER_LAMPORTS;
  const authorShareLamports = (priceLamports * 60n) / 100n;
  const authorBalanceLamports = author
    ? context.authorBalanceLamportsByAddress.get(String(author)) ?? null
    : null;
  const priceDisclosure =
    "Buying this skill creates an on-chain receipt account, so your wallet total is higher than the creator price.";

  if (
    context.purchaseRentLamports === null ||
    context.systemAccountRentExemptLamports === null ||
    authorBalanceLamports === null
  ) {
    return {
      creatorPriceLamports: priceLamports,
      estimatedPurchaseRentLamports,
      feeBufferLamports: 0n,
      estimatedBuyerTotalLamports: priceLamports,
      purchasePreflightStatus: "estimateUnavailable",
      purchasePreflightMessage:
        "Purchase availability could not be fully checked right now. Final wallet total may be higher because this purchase creates an on-chain receipt account.",
      priceDisclosure,
      buyerBalanceLamports: context.buyerBalanceLamports,
      authorBalanceLamports,
      authorShareLamports,
      systemAccountRentExemptLamports: context.systemAccountRentExemptLamports,
    };
  }

  const projectedAuthorBalance = authorBalanceLamports + authorShareLamports;
  if (
    projectedAuthorBalance > 0n &&
    projectedAuthorBalance < context.systemAccountRentExemptLamports
  ) {
    return {
      creatorPriceLamports: priceLamports,
      estimatedPurchaseRentLamports,
      feeBufferLamports: PURCHASE_FEE_BUFFER_LAMPORTS,
      estimatedBuyerTotalLamports,
      purchasePreflightStatus: "authorPayoutRentBlocked",
      purchasePreflightMessage: buildAuthorRentBlockedMessage(
        authorBalanceLamports,
        context.systemAccountRentExemptLamports
      ),
      priceDisclosure,
      buyerBalanceLamports: context.buyerBalanceLamports,
      authorBalanceLamports,
      authorShareLamports,
      systemAccountRentExemptLamports: context.systemAccountRentExemptLamports,
    };
  }

  if (
    context.buyerBalanceLamports !== null &&
    context.buyerBalanceLamports < estimatedBuyerTotalLamports
  ) {
    return {
      creatorPriceLamports: priceLamports,
      estimatedPurchaseRentLamports,
      feeBufferLamports: PURCHASE_FEE_BUFFER_LAMPORTS,
      estimatedBuyerTotalLamports,
      purchasePreflightStatus: "buyerInsufficientBalance",
      purchasePreflightMessage: buildBuyerInsufficientMessage(
        context.buyerBalanceLamports,
        estimatedBuyerTotalLamports
      ),
      priceDisclosure,
      buyerBalanceLamports: context.buyerBalanceLamports,
      authorBalanceLamports,
      authorShareLamports,
      systemAccountRentExemptLamports: context.systemAccountRentExemptLamports,
    };
  }

  return {
    creatorPriceLamports: priceLamports,
    estimatedPurchaseRentLamports,
    feeBufferLamports: PURCHASE_FEE_BUFFER_LAMPORTS,
    estimatedBuyerTotalLamports,
    purchasePreflightStatus: "ok",
    purchasePreflightMessage: null,
    priceDisclosure,
    buyerBalanceLamports: context.buyerBalanceLamports,
    authorBalanceLamports,
    authorShareLamports,
    systemAccountRentExemptLamports: context.systemAccountRentExemptLamports,
  };
}

export function serializePurchasePreflight(
  assessment: PurchasePreflightAssessment
): SerializedPurchasePreflight {
  let purchaseBlockError: SerializedPurchaseBlockError | null = null;
  if (
    isPurchasePreflightBlocking(assessment.purchasePreflightStatus) &&
    assessment.purchasePreflightMessage
  ) {
    purchaseBlockError = {
      code: assessment.purchasePreflightStatus,
      message: assessment.purchasePreflightMessage,
    };
  }

  const purchaseBlocked = purchaseBlockError !== null;

  return {
    creatorPriceLamports: toSafeLamportsNumber(assessment.creatorPriceLamports),
    estimatedPurchaseRentLamports: toSafeLamportsNumber(
      assessment.estimatedPurchaseRentLamports
    ),
    feeBufferLamports: toSafeLamportsNumber(assessment.feeBufferLamports),
    estimatedBuyerTotalLamports: toSafeLamportsNumber(
      assessment.estimatedBuyerTotalLamports
    ),
    purchasePreflightStatus: assessment.purchasePreflightStatus,
    purchasePreflightMessage: assessment.purchasePreflightMessage,
    purchaseBlocked,
    purchaseBlockError,
    priceDisclosure: assessment.priceDisclosure,
  };
}

export function isPurchasePreflightBlocking(
  status: PurchasePreflightStatus | null | undefined
): status is BlockingPurchasePreflightStatus {
  return (
    status === "buyerInsufficientBalance" ||
    status === "authorPayoutRentBlocked"
  );
}
