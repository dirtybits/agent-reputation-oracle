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
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(skill_db_id, buyer_pubkey)
      )
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_usdc_purchase_receipts_skill_buyer
      ON usdc_purchase_receipts(skill_db_id, buyer_pubkey)
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
    has_receipt: boolean;
  }>`
    SELECT EXISTS (
      SELECT 1
      FROM usdc_purchase_receipts
      WHERE skill_db_id = ${skillDbId}::uuid
        AND buyer_pubkey = ${buyerPubkey}
    ) AS has_receipt
  `;

  return rows[0]?.has_receipt ?? false;
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

  await sql()`
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
    ON CONFLICT (skill_db_id, buyer_pubkey)
    DO UPDATE SET
      payment_tx_signature = EXCLUDED.payment_tx_signature,
      recipient_ata = EXCLUDED.recipient_ata,
      currency_mint = EXCLUDED.currency_mint,
      amount_micros = EXCLUDED.amount_micros,
      verified_at = NOW(),
      updated_at = NOW()
  `;
}
