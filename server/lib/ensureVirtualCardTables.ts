import type { PrismaClient } from '@prisma/client';

let shared: Promise<void> | undefined;

/** Postgres: ensure virtual card + transaction tables exist. */
export function ensureVirtualCardTables(prisma: PrismaClient): Promise<void> {
  const url = process.env.DATABASE_URL || '';

  if (url.startsWith('file:')) {
    shared = Promise.resolve();
    return shared;
  }

  if (!shared) {
    shared = runEnsures(prisma).catch((err: unknown) => {
      shared = undefined;
      throw err;
    });
  }
  return shared;
}

async function runEnsures(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "user_virtual_cards" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT,
  "order_item_id" TEXT,
  "unit_index" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  "card_type" TEXT DEFAULT 'TConnect',
  "card_last4" TEXT,
  "balance_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "card_value_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_fees_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_spendings_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "initial_balance_usd" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "swype_card_id" TEXT,
  "activation_url" TEXT,
  "user_notes" TEXT,
  "admin_notes" TEXT,
  "last_synced_at" TIMESTAMP(3),
  "update_requested_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "user_virtual_card_transactions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "card_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount_usd" DOUBLE PRECISION NOT NULL,
  "fee_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_usd" DOUBLE PRECISION,
  "merchant" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "swype_txn_id" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await prisma.$executeRawUnsafe(`
ALTER TABLE "user_virtual_card_transactions"
  ADD COLUMN IF NOT EXISTS "fee_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;
`);

  await prisma.$executeRawUnsafe(`
ALTER TABLE "user_virtual_card_transactions"
  ADD COLUMN IF NOT EXISTS "total_usd" DOUBLE PRECISION;
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "user_virtual_card_transactions_card_id_occurred_at_idx"
  ON "user_virtual_card_transactions"("card_id", "occurred_at");
`);

  console.log('[user-cards] virtual card tables ready');
}
