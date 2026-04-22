import { sql } from "@/lib/db";

let schemaReady: Promise<void> | null = null;

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
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
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
        first_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (skill_db_id, buyer_pubkey)
      )
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
}) {
  await ensureUsdcPurchaseSchema();

  const db = sql();
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
      NOW(),
      NOW()
    )
    ON CONFLICT (payment_tx_signature)
    DO UPDATE SET
      recipient_ata = EXCLUDED.recipient_ata,
      currency_mint = EXCLUDED.currency_mint,
      amount_micros = EXCLUDED.amount_micros,
      verified_at = GREATEST(
        usdc_purchase_receipts.verified_at,
        EXCLUDED.verified_at
      ),
      updated_at = NOW()
    RETURNING id, verified_at::text
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
