-- Spin product prizes: configurable USD amount per wheel segment
ALTER TABLE "SpinPrize" ADD COLUMN IF NOT EXISTS "prizeAmountUsd" DOUBLE PRECISION;
