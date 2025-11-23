-- Migration: Add PointsReceipt Table for Receipt Tracking
-- Run this SQL on your production database

-- Create PointsReceipt table
CREATE TABLE IF NOT EXISTS "PointsReceipt" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "usdValue" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsReceipt_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on receiptId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PointsReceipt_receiptId_key'
    ) THEN
        ALTER TABLE "PointsReceipt" 
        ADD CONSTRAINT "PointsReceipt_receiptId_key" UNIQUE ("receiptId");
    END IF;
END $$;

-- Add foreign key constraint to User
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PointsReceipt_userId_fkey'
    ) THEN
        ALTER TABLE "PointsReceipt" 
        ADD CONSTRAINT "PointsReceipt_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to Order
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PointsReceipt_orderId_fkey'
    ) THEN
        ALTER TABLE "PointsReceipt" 
        ADD CONSTRAINT "PointsReceipt_orderId_fkey" 
        FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "PointsReceipt_receiptId_idx" ON "PointsReceipt"("receiptId");
CREATE INDEX IF NOT EXISTS "PointsReceipt_userId_idx" ON "PointsReceipt"("userId");
CREATE INDEX IF NOT EXISTS "PointsReceipt_orderId_idx" ON "PointsReceipt"("orderId");
CREATE INDEX IF NOT EXISTS "PointsReceipt_verified_idx" ON "PointsReceipt"("verified");

