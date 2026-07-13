-- Virtual cards + transaction history (My Cards / admin sync)

CREATE TABLE IF NOT EXISTS "user_virtual_cards" (
  "id" TEXT NOT NULL,
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
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_virtual_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_virtual_cards_user_id_created_at_idx"
  ON "user_virtual_cards"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "user_virtual_cards_order_id_idx"
  ON "user_virtual_cards"("order_id");
CREATE INDEX IF NOT EXISTS "user_virtual_cards_order_item_id_unit_index_idx"
  ON "user_virtual_cards"("order_item_id", "unit_index");

CREATE TABLE IF NOT EXISTS "user_virtual_card_transactions" (
  "id" TEXT NOT NULL,
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
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_virtual_card_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_virtual_card_transactions_card_id_occurred_at_idx"
  ON "user_virtual_card_transactions"("card_id", "occurred_at");

ALTER TABLE "user_virtual_card_transactions"
  ADD COLUMN IF NOT EXISTS "fee_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "user_virtual_card_transactions"
  ADD COLUMN IF NOT EXISTS "total_usd" DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_virtual_card_transactions_card_id_fkey'
  ) THEN
    ALTER TABLE "user_virtual_card_transactions"
      ADD CONSTRAINT "user_virtual_card_transactions_card_id_fkey"
      FOREIGN KEY ("card_id") REFERENCES "user_virtual_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
