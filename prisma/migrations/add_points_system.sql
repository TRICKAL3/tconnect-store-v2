-- Migration: Add Points System
-- Run this SQL on your production database

-- Add pointsBalance column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pointsBalance" INTEGER NOT NULL DEFAULT 0;

-- Create PointsTransaction table
CREATE TABLE IF NOT EXISTS "PointsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PointsTransaction_userId_fkey'
    ) THEN
        ALTER TABLE "PointsTransaction" 
        ADD CONSTRAINT "PointsTransaction_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "PointsTransaction_userId_idx" ON "PointsTransaction"("userId");
CREATE INDEX IF NOT EXISTS "PointsTransaction_orderId_idx" ON "PointsTransaction"("orderId");

