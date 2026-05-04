import { sql } from "@/lib/db";

let schemaReady: Promise<void> | null = null;

export const REPO_X402_PAYMENT_FLOW = "repo-x402-usdc";
export const DIRECT_PURCHASE_PAYMENT_FLOW = "direct-purchase-skill";

export async function ensureUsdcPurchaseSchema() {
  if (schemaReady) {
    return schemaReady;
  }

  schemaReady = (async () => {
    const db = sql();

    await db`
      CREATE TABLE IF NOT EXISTS usdc_purchase_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        skill_db_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        buyer_pubkey VARCHAR(44) NOT NULL,
        payment_tx_signature VARCHAR(128) NOT NULL UNIQUE,
        recipient_ata VARCHAR(44) NOT NULL,
        currency_mint VARCHAR(44) NOT NULL,
        amount_micros BIGINT NOT NULL,
        payment_flow VARCHAR(64),
        protocol_version VARCHAR(16),
        on_chain_program_id VARCHAR(44),
        chain_context VARCHAR(64),
        on_chain_address VARCHAR(44),
        purchase_pda VARCHAR(44),
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await db`
      ALTER TABLE usdc_purchase_receipts
      ADD COLUMN IF NOT EXISTS payment_flow VARCHAR(64)
    `;

    await db`
      ALTER TABLE usdc_purchase_receipts
      ADD COLUMN IF NOT EXISTS protocol_version VARCHAR(16)
    `;

    await db`
      ALTER TABLE usdc_purchase_receipts
      ADD COLUMN IF NOT EXISTS on_chain_program_id VARCHAR(44)
    `;

    await db`
      ALTER TABLE usdc_purchase_receipts
      ADD COLUMN IF NOT EXISTS chain_context VARCHAR(64)
    `;

    await db`
      ALTER TABLE usdc_purchase_receipts
      ADD COLUMN IF NOT EXISTS on_chain_address VARCHAR(44)
    `;

    await db`
      ALTER TABLE usdc_purchase_receipts
      ADD COLUMN IF NOT EXISTS purchase_pda VARCHAR(44)
    `;

    await db`
      UPDATE usdc_purchase_receipts
      SET payment_flow = COALESCE(payment_flow, ${REPO_X402_PAYMENT_FLOW})
      WHERE payment_flow IS NULL
    `;

    await db`
      ALTER TABLE usdc_purchase_receipts
      DROP CONSTRAINT IF EXISTS usdc_purchase_receipts_skill_db_id_buyer_pubkey_key
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_usdc_purchase_receipts_skill_buyer
      ON usdc_purchase_receipts(skill_db_id, buyer_pubkey)
    `;

    await db`
      CREATE TABLE IF NOT EXISTS usdc_purchase_entitlements (
        skill_db_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        buyer_pubkey VARCHAR(44) NOT NULL,
        latest_receipt_id UUID NOT NULL REFERENCES usdc_purchase_receipts(id) ON DELETE CASCADE,
        payment_tx_signature VARCHAR(128) NOT NULL,
        recipient_ata VARCHAR(44) NOT NULL,
        currency_mint VARCHAR(44) NOT NULL,
        amount_micros BIGINT NOT NULL,
        payment_flow VARCHAR(64),
        protocol_version VARCHAR(16),
        on_chain_program_id VARCHAR(44),
        chain_context VARCHAR(64),
        on_chain_address VARCHAR(44),
        purchase_pda VARCHAR(44),
        first_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (skill_db_id, buyer_pubkey)
      )
    `;

    await db`
      ALTER TABLE usdc_purchase_entitlements
      ADD COLUMN IF NOT EXISTS payment_flow VARCHAR(64)
    `;

    await db`
      ALTER TABLE usdc_purchase_entitlements
      ADD COLUMN IF NOT EXISTS protocol_version VARCHAR(16)
    `;

    await db`
      ALTER TABLE usdc_purchase_entitlements
      ADD COLUMN IF NOT EXISTS on_chain_program_id VARCHAR(44)
    `;

    await db`
      ALTER TABLE usdc_purchase_entitlements
      ADD COLUMN IF NOT EXISTS chain_context VARCHAR(64)
    `;

    await db`
      ALTER TABLE usdc_purchase_entitlements
      ADD COLUMN IF NOT EXISTS on_chain_address VARCHAR(44)
    `;

    await db`
      ALTER TABLE usdc_purchase_entitlements
      ADD COLUMN IF NOT EXISTS purchase_pda VARCHAR(44)
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_usdc_purchase_entitlements_buyer
      ON usdc_purchase_entitlements(buyer_pubkey)
    `;

    await db`
      INSERT INTO usdc_purchase_entitlements (
        skill_db_id,
        buyer_pubkey,
        latest_receipt_id,
        payment_tx_signature,
        recipient_ata,
        currency_mint,
        amount_micros,
        payment_flow,
        protocol_version,
        on_chain_program_id,
        chain_context,
        on_chain_address,
        purchase_pda,
        first_verified_at,
        last_verified_at,
        created_at,
        updated_at
      )
      SELECT DISTINCT ON (r.skill_db_id, r.buyer_pubkey)
        r.skill_db_id,
        r.buyer_pubkey,
        r.id,
        r.payment_tx_signature,
        r.recipient_ata,
        r.currency_mint,
        r.amount_micros,
        r.payment_flow,
        r.protocol_version,
        r.on_chain_program_id,
        r.chain_context,
        r.on_chain_address,
        r.purchase_pda,
        r.verified_at,
        r.verified_at,
        NOW(),
        NOW()
      FROM usdc_purchase_receipts r
      ORDER BY
        r.skill_db_id,
        r.buyer_pubkey,
        r.verified_at DESC,
        r.created_at DESC,
        r.id DESC
      ON CONFLICT (skill_db_id, buyer_pubkey)
      DO UPDATE SET
        latest_receipt_id = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.latest_receipt_id
          ELSE usdc_purchase_entitlements.latest_receipt_id
        END,
        payment_tx_signature = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.payment_tx_signature
          ELSE usdc_purchase_entitlements.payment_tx_signature
        END,
        recipient_ata = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.recipient_ata
          ELSE usdc_purchase_entitlements.recipient_ata
        END,
        currency_mint = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.currency_mint
          ELSE usdc_purchase_entitlements.currency_mint
        END,
        amount_micros = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.amount_micros
          ELSE usdc_purchase_entitlements.amount_micros
        END,
        payment_flow = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.payment_flow
          ELSE usdc_purchase_entitlements.payment_flow
        END,
        protocol_version = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.protocol_version
          ELSE usdc_purchase_entitlements.protocol_version
        END,
        on_chain_program_id = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.on_chain_program_id
          ELSE usdc_purchase_entitlements.on_chain_program_id
        END,
        chain_context = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.chain_context
          ELSE usdc_purchase_entitlements.chain_context
        END,
        on_chain_address = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.on_chain_address
          ELSE usdc_purchase_entitlements.on_chain_address
        END,
        purchase_pda = CASE
          WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
            THEN EXCLUDED.purchase_pda
          ELSE usdc_purchase_entitlements.purchase_pda
        END,
        first_verified_at = LEAST(
          usdc_purchase_entitlements.first_verified_at,
          EXCLUDED.first_verified_at
        ),
        last_verified_at = GREATEST(
          usdc_purchase_entitlements.last_verified_at,
          EXCLUDED.last_verified_at
        ),
        updated_at = NOW()
    `;
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

export async function hasUsdcPurchaseEntitlement(
  skillDbId: string,
  buyerPubkey: string
): Promise<boolean> {
  await ensureUsdcPurchaseSchema();

  const rows = await sql()<{
    has_entitlement: boolean;
  }>`
    SELECT EXISTS (
      SELECT 1
      FROM usdc_purchase_entitlements
      WHERE skill_db_id = ${skillDbId}::uuid
        AND buyer_pubkey = ${buyerPubkey}
    ) AS has_entitlement
  `;

  return rows[0]?.has_entitlement ?? false;
}

export async function recordUsdcPurchaseReceipt(input: {
  skillDbId: string;
  buyerPubkey: string;
  paymentTxSignature: string;
  recipientAta: string;
  currencyMint: string;
  amountMicros: string;
  paymentFlow?: string;
  protocolVersion?: string | null;
  onChainProgramId?: string | null;
  chainContext?: string | null;
  onChainAddress?: string | null;
  purchasePda?: string | null;
}) {
  await ensureUsdcPurchaseSchema();

  const db = sql();
  const paymentFlow = input.paymentFlow ?? REPO_X402_PAYMENT_FLOW;
  const protocolVersion = input.protocolVersion ?? null;
  const onChainProgramId = input.onChainProgramId ?? null;
  const chainContext = input.chainContext ?? null;
  const onChainAddress = input.onChainAddress ?? null;
  const purchasePda = input.purchasePda ?? null;
  const [receipt] = await db<{
    id: string;
    verified_at: string;
  }>`
    INSERT INTO usdc_purchase_receipts (
      skill_db_id,
      buyer_pubkey,
      payment_tx_signature,
      recipient_ata,
      currency_mint,
      amount_micros,
      payment_flow,
      protocol_version,
      on_chain_program_id,
      chain_context,
      on_chain_address,
      purchase_pda,
      verified_at,
      updated_at
    )
    VALUES (
      ${input.skillDbId}::uuid,
      ${input.buyerPubkey},
      ${input.paymentTxSignature},
      ${input.recipientAta},
      ${input.currencyMint},
      ${input.amountMicros},
      ${paymentFlow},
      ${protocolVersion},
      ${onChainProgramId},
      ${chainContext},
      ${onChainAddress},
      ${purchasePda},
      NOW(),
      NOW()
    )
    ON CONFLICT (payment_tx_signature)
    DO UPDATE SET
      recipient_ata = EXCLUDED.recipient_ata,
      currency_mint = EXCLUDED.currency_mint,
      amount_micros = EXCLUDED.amount_micros,
      payment_flow = EXCLUDED.payment_flow,
      protocol_version = EXCLUDED.protocol_version,
      on_chain_program_id = EXCLUDED.on_chain_program_id,
      chain_context = EXCLUDED.chain_context,
      on_chain_address = EXCLUDED.on_chain_address,
      purchase_pda = EXCLUDED.purchase_pda,
      verified_at = GREATEST(
        usdc_purchase_receipts.verified_at,
        EXCLUDED.verified_at
      ),
      updated_at = NOW()
    WHERE usdc_purchase_receipts.skill_db_id = EXCLUDED.skill_db_id
      AND usdc_purchase_receipts.buyer_pubkey = EXCLUDED.buyer_pubkey
    RETURNING id, verified_at::text
  `;

  if (!receipt) {
    throw new Error(
      "Payment transaction signature is already recorded for another skill or buyer"
    );
  }

  await db`
    INSERT INTO usdc_purchase_entitlements (
      skill_db_id,
      buyer_pubkey,
      latest_receipt_id,
      payment_tx_signature,
      recipient_ata,
      currency_mint,
      amount_micros,
      payment_flow,
      protocol_version,
      on_chain_program_id,
      chain_context,
      on_chain_address,
      purchase_pda,
      first_verified_at,
      last_verified_at,
      created_at,
      updated_at
    )
    VALUES (
      ${input.skillDbId}::uuid,
      ${input.buyerPubkey},
      ${receipt.id}::uuid,
      ${input.paymentTxSignature},
      ${input.recipientAta},
      ${input.currencyMint},
      ${input.amountMicros},
      ${paymentFlow},
      ${protocolVersion},
      ${onChainProgramId},
      ${chainContext},
      ${onChainAddress},
      ${purchasePda},
      ${receipt.verified_at}::timestamptz,
      ${receipt.verified_at}::timestamptz,
      NOW(),
      NOW()
    )
    ON CONFLICT (skill_db_id, buyer_pubkey)
    DO UPDATE SET
      latest_receipt_id = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.latest_receipt_id
        ELSE usdc_purchase_entitlements.latest_receipt_id
      END,
      payment_tx_signature = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.payment_tx_signature
        ELSE usdc_purchase_entitlements.payment_tx_signature
      END,
      recipient_ata = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.recipient_ata
        ELSE usdc_purchase_entitlements.recipient_ata
      END,
      currency_mint = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.currency_mint
        ELSE usdc_purchase_entitlements.currency_mint
      END,
      amount_micros = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.amount_micros
        ELSE usdc_purchase_entitlements.amount_micros
      END,
      payment_flow = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.payment_flow
        ELSE usdc_purchase_entitlements.payment_flow
      END,
      protocol_version = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.protocol_version
        ELSE usdc_purchase_entitlements.protocol_version
      END,
      on_chain_program_id = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.on_chain_program_id
        ELSE usdc_purchase_entitlements.on_chain_program_id
      END,
      chain_context = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.chain_context
        ELSE usdc_purchase_entitlements.chain_context
      END,
      on_chain_address = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.on_chain_address
        ELSE usdc_purchase_entitlements.on_chain_address
      END,
      purchase_pda = CASE
        WHEN EXCLUDED.last_verified_at >= usdc_purchase_entitlements.last_verified_at
          THEN EXCLUDED.purchase_pda
        ELSE usdc_purchase_entitlements.purchase_pda
      END,
      first_verified_at = LEAST(
        usdc_purchase_entitlements.first_verified_at,
        EXCLUDED.first_verified_at
      ),
      last_verified_at = GREATEST(
        usdc_purchase_entitlements.last_verified_at,
        EXCLUDED.last_verified_at
      ),
      updated_at = NOW()
  `;
}
